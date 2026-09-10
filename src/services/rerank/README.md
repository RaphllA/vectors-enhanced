# Rerank 模块

## 概述

Rerank 模块提供了对向量搜索结果进行重新排序的功能，通过调用外部 Rerank API 来提高搜索结果的相关性。

## 模块结构

```
rerank/
├── index.js           # 模块导出
├── RerankService.js   # 核心服务类
├── RerankConfig.js    # 配置管理
├── RerankTypes.js     # 类型定义
└── README.md          # 本文档
```

## 使用方法

### 1. 导入模块

```javascript
import { RerankService } from './src/services/rerank/index.js';
```

### 2. 创建实例

```javascript
const rerankService = new RerankService(settings, {
    toastr: toastr,
    getRequestHeaders // 用于访问 SillyTavern 同源服务端代理
});
```

### 3. 检查是否启用

```javascript
if (rerankService.isEnabled()) {
    // Rerank 功能已启用且配置正确
}
```

### 4. 重新排序结果

```javascript
// 原始搜索结果
const searchResults = [
    { text: "文档1", score: 0.8, metadata: {...} },
    { text: "文档2", score: 0.7, metadata: {...} },
    // ...
];

// 执行重新排序
const rerankedResults = await rerankService.rerankResults(queryText, searchResults);
```

### 5. 限制结果数量

```javascript
const limitedResults = rerankService.limitResults(rerankedResults, maxResults);
```

## 配置选项

| 配置项 | 类型 | 说明 | 默认值 |
|--------|------|------|--------|
| `enabled` | boolean | 是否启用 Rerank | false |
| `url` | string | Rerank API URL | https://api.siliconflow.cn/v1/rerank |
| `secretKey` | string | SillyTavern 密钥类型 | api_key_vllm |
| `secretId` | string | 指定密钥 UUID；空值使用 active Key | '' |
| `model` | string | 使用的模型 | Pro/BAAI/bge-reranker-v2-m3 |
| `top_n` | number | 返回的最大结果数 | 20 |
| `hybrid_alpha` | number | 混合分数权重 (0-1) | 0.7 |
| `success_notify` | boolean | 是否显示成功通知（仅在主查询通知禁用时生效） | true |
| `deduplication_enabled` | boolean | 是否启用去重 | false |
| `deduplication_instruction` | string | 去重指令 | (默认指令) |

## 工作原理

1. **接收搜索结果**：接收原始的向量搜索结果列表
2. **调用同源代理**：浏览器请求 `/api/plugins/vectors-enhanced/rerank`
3. **服务端调用 Rerank API**：服务端读取 SillyTavern secrets，并将查询和文档发送到配置的 LAN 或公网 API
4. **计算混合分数**：结合原始相似度分数和 Rerank 分数
   - 混合分数 = rerank_score × alpha + original_score × (1 - alpha)
5. **重新排序**：按混合分数降序排列
6. **限制数量**：根据配置限制返回的结果数量

## 错误处理

- 如果 Rerank API 调用失败，会自动回退到原始搜索结果
- 所有错误都会记录到控制台
- 可选择性地显示错误通知

## 扩展性

该模块设计为可扩展的：

- 可以轻松添加新的 Rerank 提供商
- 可以自定义评分算法
- 可以添加更多的预处理/后处理步骤

## 注意事项

1. 确保已安装 `server-plugin/`、启用 SillyTavern server plugins，并选择正确的服务端密钥
2. Rerank 会增加搜索延迟，请权衡使用
3. 某些 Rerank API 有请求限制，请注意使用频率
4. 当启用主查询通知（`show_query_notification`）时，Rerank 的成功通知会自动禁用以避免重复通知
