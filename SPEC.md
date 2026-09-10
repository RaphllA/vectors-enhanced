# SillyTavern 1.18.0 服务端代理与密钥改造 SPEC

状态：已实现；NAS → Mac 的 LAN Rerank 已完成端到端验收
目标版本：SillyTavern 1.18.0（tag `1.18.0`，commit `51ad27fb86d39a3daca3adaa970375c9670c12df`）

## 1. 背景与目标

本次改造解决两个问题：

1. Rerank 当前由浏览器直接请求配置的 URL，因此 HTTPS 酒馆访问 HTTP LAN API 时会被 Mixed Content/CORS 拦截，并且浏览器会直接持有和发送 Rerank API Key。
2. OpenAI 兼容总结在请求前调用 `/api/secrets/write`，会创建新的 Custom Key、切换 active Key，并在页面重载后重复发生。

最终边界如下：

- 浏览器只请求当前 SillyTavern 同源接口。
- 只有 SillyTavern 服务端向 Rerank 或总结上游发送 API Key。
- 插件不再调用 `/api/secrets/write`、`/rotate` 或 `/delete`。
- Rerank 的 URL、模型、`top_n`、混合权重、去重指令以及上游请求/响应格式保持兼容。
- 公网 Rerank API 和 HTTP LAN Rerank API 使用同一条代理路径。

## 2. 已确认的 SillyTavern 1.18.0 能力

- `/api/backends/chat-completions/generate` 的 Custom 分支使用
  `readSecret(..., SECRET_KEYS.CUSTOM, request.body.secret_id)`，因此一次请求可以选择一个既有 Custom Key，不需要切换 active Key。
- `/api/backends/chat-completions/status` 同样接受 `secret_id`，可用于获取模型列表。
- 服务端插件通过 `init(router)` 注册路由，并挂载到 `/api/plugins/{plugin-id}`。
- SillyTavern 的私网请求过滤器作用于全局 HTTP/HTTPS agent。启用过滤器后，LAN Rerank 地址必须加入 `privateAddressWhitelist.allowedRanges`。

## 3. 总结 API 设计

### 3.1 配置

OpenAI 兼容总结配置保留：

- `url`
- `model`
- 自定义模型开关与名称

密钥配置改为：

- `secretId`: SillyTavern `api_key_custom` 条目 UUID；空值表示使用当前 active Custom Key。

旧字段 `apiKey` 不再读取、不再加入 DOM、不再发送。升级前需要先在 SillyTavern 的 Custom API 密钥管理器中保存总结 Key，再在插件中选择对应条目。插件不自动迁移旧明文 Key，避免再次创建或切换 active Key。

### 3.2 请求

生成请求继续发送到：

`POST /api/backends/chat-completions/generate`

请求体保留 `chat_completion_source: "custom"` 与 `custom_url`，新增 `secret_id`。移除：

- `reverse_proxy`
- `proxy_password`

模型列表请求对 `/api/backends/chat-completions/status` 做相同修改。

### 3.3 不在本次范围内

Google 总结模式的现有行为不在本问题的改造范围内；本次只修改用户报告中会写入 `api_key_custom` 的 OpenAI 兼容总结路径。

## 4. Rerank 服务端代理设计

### 4.1 组件与路由

仓库新增 `server-plugin/`，作为 SillyTavern server plugin 安装，plugin id 为 `vectors-enhanced`。

浏览器固定请求：

`POST /api/plugins/vectors-enhanced/rerank`

不增加端口、域名或独立容器。

### 4.2 浏览器请求体

```json
{
  "url": "http://192.168.3.x:port/v1/rerank",
  "secretKey": "api_key_vllm",
  "secretId": "optional-uuid",
  "query": "query text",
  "documents": ["document 1", "document 2"],
  "model": "model-name",
  "top_n": 20,
  "instruct": "optional instruction"
}
```

`secretKey` 只允许：

- `api_key_vllm`：默认，空 `secretId` 时复用 active vLLM Key。
- `api_key_generic`：独立或其他厂商 Rerank Key。
- `api_key_siliconflow`：硅基流动 Rerank Key。
- `api_key_cohere`：Cohere Rerank Key。

浏览器只保存密钥类型和 UUID，不读取或提交密钥值。

### 4.3 上游请求

服务端从当前 SillyTavern 用户的 secrets 中读取对应密钥，向配置 URL 发送与旧版相同的请求：

- `Content-Type: application/json`
- `Authorization: Bearer <server-side secret>`
- body: `query`、`documents`、`model`、`top_n`，以及可选 `instruct`

成功响应的 JSON 原样返回给浏览器，因此现有 `results[].index`、`relevance_score` 和 `score` 兼容逻辑不变。

### 4.4 校验与安全

服务端必须：

- 只允许 `http:` 和 `https:`，拒绝 URL 中的用户名/密码。
- 限制密钥类型为上述 allowlist。
- 校验 `query`、`documents`、`model`、`top_n` 和可选 `instruct` 的类型与大小。
- 限制文档数量为 100；限制单个文本与总请求字符数，防止误配置拖垮 NAS。
- 设置上游超时，并在浏览器断开时取消上游请求。
- 不记录 Authorization、密钥值、完整文档或完整上游响应。
- 依赖 SillyTavern 1.18.0 的全局私网请求过滤器处理 DNS 解析和私网白名单，避免自行实现一套不完整的 SSRF 判断。

### 4.5 错误约定

代理错误统一返回：

```json
{
  "error": {
    "code": "stable_machine_code",
    "message": "safe user-facing message",
    "upstreamStatus": 401
  }
}
```

- 参数错误：HTTP 400
- 密钥不存在或引用无效：HTTP 400
- 上游超时：HTTP 504
- 上游非 2xx：HTTP 502，并携带 `upstreamStatus`
- 非 JSON 或响应格式错误：HTTP 502
- 未预期服务端错误：HTTP 500

浏览器端保持原有“Rerank 失败时回退到向量相似度排序”行为，并显示包含 HTTP 状态的简明错误。

## 5. 配置兼容与迁移

保留原有 Rerank 字段：

- `rerank_enabled`
- `rerank_url`
- `rerank_model`
- `rerank_top_n`
- `rerank_hybrid_alpha`
- `rerank_success_notify`
- `rerank_deduplication_enabled`
- `rerank_deduplication_instruction`

新增：

- `rerank_secret_key`，默认 `api_key_vllm`
- `rerank_secret_id`，默认空字符串（使用该类型的 active Key）

旧 `rerank_apiKey` 不再用于请求或显示。部署前应将它保存到 SillyTavern 的相应密钥抽屉；完成迁移后可从扩展设置中清除。

若升级时检测到旧 `rerank_apiKey` 且 Rerank 正在启用，插件必须先自动关闭 Rerank。用户明确选择新的服务端密钥后再手动开启，避免把默认 vLLM Key 误发到旧配置中的公网 URL。URL、模型和排序参数不清除。

## 6. 部署要求

SillyTavern `config.yaml`：

```yaml
enableServerPlugins: true
privateAddressWhitelist:
  enabled: true
  allowedRanges:
    - '127.0.0.0/8'
    - '::1/128'
    - '<Mac 或 LAN Rerank 主机的单个 IP>/32'
```

将本仓库 `server-plugin/` 挂载或复制到容器：

`/home/node/app/plugins/vectors-enhanced`

修改 server plugin 或 `config.yaml` 后只需重启 SillyTavern 容器；前端扩展文件更新后刷新页面。

NAS 上的 `extensions/vectors-enhanced` 仅作为运行时部署副本，不保留 `.git`。提交、分支和回滚基线由本地开发仓库及 GitHub 管理；每次覆盖 NAS 前，应先在 `deployment-backups` 中保存上一版运行文件。

## 7. 验收标准

1. 代码中不存在从 Rerank 路径执行 `fetch(config.url)`，浏览器只请求同源插件路由。
2. OpenAI 兼容总结和模型列表不调用 `/api/secrets/write`，请求包含所选 `secret_id`，且不含 `proxy_password`。
3. 选择非 active Custom Key 后，总结使用该 Key，active Key 不改变，也不产生新条目。
4. Rerank 默认可使用 active vLLM Key；选择独立密钥 UUID 后使用指定 Key。
5. HTTP LAN URL 在 HTTPS 酒馆页面可工作；公网 SiliconFlow/Cohere/兼容 API 仍可工作。
6. Rerank 上游失败、超时、非 JSON 和插件未安装时均回退原始排序，不中断聊天生成。
7. 浏览器请求、扩展日志和服务端日志中均不出现明文 API Key。
8. `git diff --check` 通过；前端模块语法检查、服务端插件测试和关键请求体测试通过。

## 8.1 本地验证记录

- `npm test`：前端/请求体/安全不变量 10 项、服务端代理 11 项通过。
- 变更涉及的 JavaScript 文件均通过 `node --check`。
- 仓库历史文件使用 CRLF；以 `git -c core.whitespace=cr-at-eol diff --check` 检查变更，通过且无实际尾随空格错误。
- 将 `server-plugin/` 只读挂载进正式的 SillyTavern 1.18.0 镜像后，容器成功启动并报告 `1 server plugin(s) are currently loaded`；私网请求过滤器同时成功启用。
- NAS 已启用 Server Plugin 和私网白名单，真实请求已从 HTTPS 酒馆经 NAS 转发到 `192.168.3.96:8025` 的 Mac Rerank 服务；使用 active vLLM Key 成功返回重排结果，实际查询显示“查询到 22 个块，重排后注入 5 个块”。

尚未完成的环境验收：真实公网 Rerank 请求，以及使用非 active Custom Key 的实际总结请求。这些步骤需要部署后使用现有密钥完成，不应在仓库测试中伪造为已通过。

## 9. 回滚

- 禁用 Rerank，或将前端扩展回滚到旧版本。
- 从 `plugins/vectors-enhanced` 移除/取消挂载 server plugin，并重启 SillyTavern。
- 本次实现不修改、删除或轮换 SillyTavern secrets，因此回滚不会改变现有 active Key。
