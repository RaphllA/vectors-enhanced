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

## 🧩 宿主兼容性

插件使用同一份代码支持 SillyTavern 与 TauriTavern：

- **SillyTavern**：继续使用原生 `/api/vector/*` 后端，原有行为不变。
- **TauriTavern**：当前原生向量端点返回不可用状态时，插件自动使用 IndexedDB 保存和检索向量。
- TauriTavern 兼容模式支持 Ollama、vLLM、WebLLM，以及实验性的 KoboldCpp；Transformers 服务端来源暂不可用。
- 更换向量来源、服务地址或模型后，需要重新向量化，避免混用不同维度的向量。

详细实现、限制、验证命令和手测清单见 [宿主兼容说明](docs/host-compatibility.md)。

## 📦 安装与设置

### 前置要求
- SillyTavern 最新版本，或 TauriTavern 当前版本
- 现代浏览器/WebView
- 至少一个向量化引擎的访问权限

### SillyTavern 安装
1. 将扩展文件夹复制到 SillyTavern 的扩展目录：
   ```
   SillyTavern/public/scripts/extensions/third-party/vectors-enhanced/
   ```

2. 在 SillyTavern 中启用扩展：
   - 打开 SillyTavern
   - 进入“扩展”设置

### TauriTavern 安装

优先在 TauriTavern 扩展管理界面中使用本仓库 URL 安装：

```text
https://github.com/RaphllA/vectors-enhanced
```

手动安装时，将完整扩展目录放入以下任一位置，并保持文件夹名为 `vectors-enhanced`：

```text
data/default-user/extensions/vectors-enhanced       # local，优先级更高
data/extensions/third-party/vectors-enhanced        # global
```

### 配置向量化引擎

3. 配置向量化引擎：
   - 在扩展设置中选择您要使用的向量化源
   - 配置必要的API密钥或服务地址

## 🚀 快速开始

### 1. 向量化聊天记录
1. 打开任意聊天界面
2. 选择要处理的消息范围
3. 配置标签规则（可选）
4. 点击"开始向量化"

### 2. 设置记忆管理
1. 进入记忆管理设置
2. 选择AI总结API（OpenAI或Gemini）
3. 配置API密钥
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

