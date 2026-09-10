# Vectors Enhanced - SillyTavern 高级向量化扩展


Vectors Enhanced 是 SillyTavern 的向量化扩展插件，提语义搜索、智能记忆管理和内容处理功能。

discord社区链接：https://ptb.discord.com/channels/1134557553011998840/1390957251023343636
详细使用教程：https://docs.google.com/document/d/1Gc-xWEKApKtfhzxwuG9XeBEio8zah8yurpPQzWGvqo4/edit?usp=sharing


### 1.  多引擎向量化系统
- **6种向量化引擎支持**：
  - Transformers.js - 浏览器本地运行
  - Ollama - 本地模型服务器
  - vLLM - 高性能推理引擎
  - WebLLM - WebGPU加速
  - OpenAI - 云端嵌入API
  - Cohere - 专业向量化服务
- **智能批量处理**：自动优化批次大小，提升处理效率
- **去重机制**：文本级、任务级、文件级三重去重
- **两阶段架构**：数据准备与向量化分离，提高灵活性

### 2.  记忆管理系统
- **AI智能总结**：
  - 支持 OpenAI 兼容 API 和 Google Gemini API
  - 自动生成对话摘要和关键信息提取
- **世界书集成**：
  - 自动创建 chat lore 绑定的世界书条目
  - 记忆内容与角色世界观无缝融合
- **自动化处理**：
  - 每N层楼自动触发总结
  - 支持隐藏已总结楼层，保持界面整洁
  - 防并发机制确保稳定运行

### 3.  外挂任务系统
- **跨聊天共享**：通过引用机制避免数据重复
- **循环引用保护**：智能检测并防止A引用B，B又引用A的情况
- **智能解析**：自动提取角色名、格式化显示、性能优化
- **孤儿任务处理**：源聊天删除后自动标记并处理

### 4.  内容注入系统
- **语义匹配**：基于相似度的智能内容检索
- **灵活配置**：
  - 多种注入位置（系统提示、角色描述后、聊天历史等）
  - 可调节的注入深度和优先级
- **标签触发**：支持复杂的包含/排除/正则表达式规则

### 5. 🏷️ 高级标签提取
- **直观UI设计**：无需编写复杂命令，通过图形界面配置规则
- **三种规则类型**：
  - 包含规则：提取匹配标签的内容
  - 排除规则：预先移除不需要的内容
  - 正则表达式：高级模式匹配和提取
- **智能处理流程**：固定的"先排除，后提取"顺序，确保结果一致性

## 🏗️ 技术架构

### 分层设计
```
应用层 (Application Layer)
├── 业务逻辑协调
├── 任务管理
└── 工作流控制

核心层 (Core Layer)
├── 实体定义 (Content, Vector, Task)
├── 提取器系统 (ChatExtractor, FileExtractor, WorldInfoExtractor)
├── 处理管道 (VectorizationAdapter, StorageAdapter)
└── 查询系统 (EnhancedQuerySystem)

UI层 (UI Layer)
├── 15+ 独立组件
├── 状态管理 (StateManager)
├── 事件系统 (EventManager)
└── 响应式设计

基础设施层 (Infrastructure Layer)
├── 存储适配 (StorageAdapter)
├── API封装 (VectorizationAdapter)
├── 事件总线 (EventBus)
└── 配置管理 (ConfigManager)
```

### 设计模式应用
- **工厂模式**：TaskFactory、ProcessorFactory 处理对象创建
- **适配器模式**：统一不同向量化引擎和存储后端的接口
- **观察者模式**：EventBus 实现组件间松耦合通信
- **策略模式**：动态切换不同的向量化引擎和处理策略

### 性能优化
- **批量处理**：智能分批，减少API调用次数
- **缓存机制**：hashCache 避免重复计算
- **延迟加载**：外挂任务仅在需要时解析
- **事件防抖**：高频操作优化，提升UI响应性

## 📦 安装与设置

### 前置要求
- SillyTavern 1.18.0 或更高版本
- 现代浏览器（Chrome/Firefox/Edge）
- 至少一个向量化引擎的访问权限

### 安装步骤
1. 将扩展文件夹复制到 SillyTavern 的扩展目录：
   ```
   SillyTavern/public/scripts/extensions/third-party/vectors-enhanced/
   ```

2. 在 SillyTavern 中启用扩展：
   - 打开 SillyTavern
   - 进入"扩展"设置
 

3. 配置向量化引擎：
   - 在扩展设置中选择您要使用的向量化源
   - 配置必要的API密钥或服务地址

### 从旧版升级后第一次使用

升级后如果看到下面两条橙色提示，这是正常的迁移保护，不是初始化失败：

- `检测到旧版总结明文 Key：它已停止使用`：旧版曾把总结 Key 保存在扩展设置中。新版不会再使用或自动写入这个明文 Key。
- `Rerank 已暂时关闭`：旧版 Rerank Key 不能安全地自动判断应迁移到哪种服务，因此插件先关闭 Rerank，避免误用其他 active Key。

旧 URL、模型和其他参数仍会保留。完成下面的设置后即可重新启用功能；旧总结字段仍存在时，刷新页面后可能再次看到提醒，但它不会再被用于请求。

#### 总结：选择已有的 Custom Key

1. 在 SillyTavern 的 API 密钥管理器中，将总结专用 Key 保存到 **Custom** 类型。已有条目可以直接复用，不需要重复创建。
2. 打开 Vectors Enhanced → **总结设置**，API 来源选择 **OpenAI 兼容**。
3. 填写总结 API 地址，在 **SillyTavern Custom Key** 中选择刚才的条目。
4. 刷新或填写模型，然后执行一次手动总结测试。

选择具体条目后，总结只使用该条目，不会切换当前 active Custom Key，也不会自动创建新 Key。选择“使用当前 active Custom Key”则会跟随酒馆当前的 active 条目。

#### Rerank：最省事的家庭 Tiny-LLM/vLLM 用法

如果向量化和 Rerank 访问的是同一套家庭服务，并且可以共用同一个 Key：

1. 先按下方“Rerank 服务端插件”章节完成服务端安装。
2. 打开 Vectors Enhanced → **Rerank 设置**。
3. 填写 Mac 上 Rerank API 的地址与模型。
4. **Rerank 密钥类型**选择 `vLLM（默认，与向量化共用）`。
5. **Rerank API Key**选择“使用该类型的 active Key”，或明确选择某个 vLLM Key 条目。
6. 重新开启 **启用 Rerank**。

这样浏览器只请求 SillyTavern；再由 NAS 上的 SillyTavern 请求 Mac。人在内网或外网使用酒馆，浏览器都不需要直接访问 Mac，也不会直接拿到 Rerank Key。

#### Rerank：独立或公网 API

- 独立 Rerank Key：在酒馆中保存为 **Generic**，密钥类型选择 `Generic（独立 Rerank Key）`，再选择对应条目。
- SiliconFlow / Cohere：选择对应的密钥类型和条目。
- 公网 Rerank URL 的填写方式不变；请求同样经 SillyTavern 服务端发出。

密钥列表没有显示新条目时，点击字段旁边的刷新按钮。钥匙按钮用于打开 SillyTavern 的密钥管理器。

### Rerank 服务端插件

Rerank 现在与向量化一样由 SillyTavern 服务端访问上游，解决 HTTPS 页面访问 HTTP LAN API 的 Mixed Content/CORS 问题。它不需要新增端口或域名，但需要安装本仓库的配套 server plugin：

1. 将 `server-plugin/` 挂载或复制到 SillyTavern 容器的 `/home/node/app/plugins/vectors-enhanced`。
2. 在 `config.yaml` 中设置 `enableServerPlugins: true`。
3. 启用 `privateAddressWhitelist`，并将运行 Rerank 的 Mac/LAN 主机 IP 以 `/32` 加入 `allowedRanges`。
4. 重启 SillyTavern。在扩展的 Rerank 设置中选择服务端密钥：默认复用 vLLM active Key，也可以选择 Generic、SiliconFlow 或 Cohere 中的指定 UUID。

公网 Rerank API 仍填写原 URL；请求也会经同一个服务端路由发出。完整接口、安全限制、迁移和回滚说明见 [SPEC.md](SPEC.md)。

### NAS 版本管理边界

版本管理只在本地开发仓库和 GitHub 进行。NAS 的 `extensions/vectors-enhanced` 是部署副本，不保留 `.git`，不要在酒馆扩展管理器中对它执行 Git 更新；发布时从已验证的本地版本覆盖，回滚时使用对应的部署备份。

## 🚀 快速开始

### 1. 向量化聊天记录
1. 打开任意聊天界面
2. 选择要处理的消息范围
3. 配置标签规则（可选）
4. 点击"开始向量化"

### 2. 设置记忆管理
1. 进入记忆管理设置
2. 选择AI总结API（OpenAI或Gemini）
3. OpenAI 兼容模式先在 SillyTavern Custom Keys 中保存密钥，再在插件中选择对应 UUID
4. 设置自动总结参数：
   - 触发间隔（每N层楼）
   - 总结深度（最近M层）
   - 是否自动隐藏已总结内容

### 3. 创建外挂任务
1. 在源聊天中创建向量化任务
2. 在目标聊天中点击"添加外挂任务"
3. 选择要引用的源聊天和任务
4. 确认添加，任务会自动同步

## 📋 使用教程

### 标签提取功能
查看 [标签提取示例.md](标签提取示例.md) 了解详细的标签规则配置方法。

#### 示例场景
1. **提取特定标签内容**
   - 添加"包含"规则：`content`
   - 系统会提取所有 `<content>` 标签中的内容

2. **排除敏感信息**
   - 添加"排除"规则：`private`
   - 系统会在提取前移除所有 `<private>` 标签内容

3. **复杂模式匹配**
   - 添加"正则包含"规则：`<summary>重要</summary>([\s\S]*?)</details>`
   - 提取所有标记为"重要"的详情内容

### 记忆管理最佳实践
1. **合理设置触发间隔**
   - 日常对话：10-20层楼
   - 角色扮演：20-30层楼
   - 长篇创作：30-50层楼

2. **选择合适的总结深度**
   - 建议为触发间隔的一半
   - 确保上下文连贯性

3. **世界书集成**
   - 启用自动创建世界书
   - 定期检查和编辑生成的条目
   - 调整关键词匹配规则

### 外挂任务使用技巧
1. **组织任务结构**
   - 为不同类型的信息创建独立任务
   - 使用清晰的命名规则

2. **避免循环引用**
   - 系统会自动检测，但建议规划好引用关系
   - 使用树状结构而非网状结构

3. **性能考虑**
   - 限制引用链深度（建议不超过3层）
   - 定期清理不再需要的任务

