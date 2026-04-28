// @ts-nocheck
import {
  eventSource,
  event_types,
  extension_prompt_roles,
  extension_prompt_types,
  getCurrentChatId,
  getRequestHeaders,
  is_send_press,
  saveSettingsDebounced,
  setExtensionPrompt,
  substituteParams,
  substituteParamsExtended,
  generateRaw,
  saveChatConditional,
  chat_metadata,
  saveChatDebounced,
} from '../../../../script.js';

// 兼容性处理：refreshSwipeButtons 在 ST 1.14.0+ 才存在
let refreshSwipeButtons = null;
import('../../../../script.js').then(module => {
  if (typeof module.refreshSwipeButtons === 'function') {
    refreshSwipeButtons = module.refreshSwipeButtons;
  }
}).catch(() => {});
import { getDataBankAttachments, getDataBankAttachmentsForSource, getFileAttachment } from '../../../chats.js';
import { debounce_timeout } from '../../../constants.js';
import {
  ModuleWorkerWrapper,
  extension_settings,
  getContext,
  renderExtensionTemplateAsync,
} from '../../../extensions.js';
import { oai_settings } from '../../../openai.js';
import { POPUP_RESULT, POPUP_TYPE, callGenericPopup } from '../../../popup.js';
import { SlashCommand } from '../../../slash-commands/SlashCommand.js';
import { SlashCommandParser } from '../../../slash-commands/SlashCommandParser.js';
import { textgen_types, textgenerationwebui_settings } from '../../../textgen-settings.js';
import {
  debounce,
  getStringHash,
  onlyUnique,
  waitUntilCondition,
} from '../../../utils.js';
import { getSortedEntries, saveWorldInfo, loadWorldInfo } from '../../../world-info.js';
import { shouldSkipContent } from './src/utils/contentFilter.js';
import { extractTagContent, extractSimpleTag, extractComplexTag, extractHtmlFormatTag } from './src/utils/tagExtractor.js';
import { scanTextForTags, generateTagSuggestions } from './src/utils/tagScanner.js';
import { updateMasterSwitchState as updateMasterSwitchStateNew, hideProgress as hideProgressNew, updateProgress as updateProgressNew, triggerDownload } from './src/ui/domUtils.js';
import { SettingsManager } from './src/ui/settingsManager.js';
import { ConfigManager } from './src/infrastructure/ConfigManager.js';
import { updateChatSettings } from './src/ui/components/ChatSettings.js';
import { renderTagRulesUI } from './src/ui/components/TagRulesEditor.js';
import { updateTaskList } from './src/ui/components/TaskList.js';
import { updateFileList } from './src/ui/components/FileList.js';
import { updateWorldInfoList } from './src/ui/components/WorldInfoList.js';
import { clearTagSuggestions, displayTagSuggestions, showTagExamples } from './src/ui/components/TagUI.js';
import { MessageUI } from './src/ui/components/MessageUI.js';
import { ActionButtons } from './src/ui/components/ActionButtons.js';
import { SettingsPanel } from './src/ui/components/SettingsPanel.js';
import { VectorizationSettings } from './src/ui/components/VectorizationSettings.js';
import { QuerySettings } from './src/ui/components/QuerySettings.js';
import { ContentSelectionSettings } from './src/ui/components/ContentSelectionSettings.js';
import { ProgressManager } from './src/ui/components/ProgressManager.js';
import { EventManager } from './src/ui/EventManager.js';
import { StateManager } from './src/ui/StateManager.js';
import { getMessages, createVectorItem, getHiddenMessages } from './src/utils/chatUtils.js';
import { StorageAdapter } from './src/infrastructure/storage/StorageAdapter.js';
import { VectorizationAdapter } from './src/infrastructure/api/VectorizationAdapter.js';
import { eventBus } from './src/infrastructure/events/eventBus.instance.js';
import { RerankService } from './src/services/rerank/index.js';

/**
 * @typedef {object} HashedMessage
 * @property {string} text - The hashed message text
 * @property {number} hash - The hash used as the vector key
 * @property {number} index - The index of the message in the chat
 */

/**
 * @typedef {object} VectorItem
 * @property {string} type - Type of the item ('chat', 'file', 'world_info')
 * @property {string} text - The text content
 * @property {Object} metadata - Additional metadata for the item
 * @property {boolean} selected - Whether the item is selected for vectorization
 */

const MODULE_NAME = 'vectors-enhanced';

export const EXTENSION_PROMPT_TAG = '3_vectors';
export const MEMORY_EXTENSION_TAG = '4_memory';

// 保存最后注入的内容，供预览功能使用
let lastInjectedContent = null;
let lastInjectedStats = null;
let lastQueryDetails = null; // 保存查询的详细信息，包括重排前后的数据


// Global ActionButtons instance (initialized in jQuery ready)
let globalActionButtons = null;

// Global SettingsPanel instance (initialized in jQuery ready)
let globalSettingsPanel = null;

// Global UI infrastructure instances (initialized in jQuery ready)
let globalProgressManager = null;
let globalEventManager = null;
let globalStateManager = null;
let globalSettingsManager = null;

const settings = {
  // Master switch - controls all plugin functionality
  master_enabled: true, // 主开关：控制整个插件的所有功能，默认启用

  // Vector source settings
  source: 'transformers',
  local_model: '', // 本地transformers模型名称
  vllm_model: '',
  vllm_url: '',
  vllm_api_key: '', // vLLM API key
  ollama_model: 'rjmalagon/gte-qwen2-1.5b-instruct-embed-f16',
  ollama_url: '', // ollama API地址
  ollama_keep: false,

  // General vectorization settings
  chunk_size: 768,
  overlap_percent: 0,
  score_threshold: 0.25,
  force_chunk_delimiter: '',
  // lightweight_storage: 已移除，所有文本都存储在向量数据库中

  // TPM rate limit settings (TPM 限制控制)
  batch_delay_enabled: false, // 是否启用批次延迟
  batch_delay_chunks: 50, // 触发延迟的块数
  batch_delay_seconds: 60, // 延迟秒数

  // Query settings
  enabled: true, // 是否启用向量查询
  query_messages: 3, // 查询使用的最近消息数
  max_results: 10, // 返回的最大结果数
  show_query_notification: false, // 是否显示查询结果通知
  detailed_notification: false, // 是否显示详细通知（来源分布）

  // Rerank settings
  rerank_enabled: false,
  rerank_url: 'https://api.siliconflow.cn/v1/rerank',
  rerank_apiKey: '',
  rerank_model: 'Pro/BAAI/bge-reranker-v2-m3',
  rerank_top_n: 20,
  rerank_hybrid_alpha: 0.7, // Rerank score weight
  rerank_success_notify: true, // 是否显示Rerank成功通知

  // Experimental settings
  query_instruction_enabled: false, // Enable query instruction
  query_instruction_template: 'Given a query, retrieve relevant passages from the context. Consider all available metadata including floor (chronological position), world info entries, and chapter/section markers to ensure comprehensive retrieval.', // Query instruction template
  query_instruction_preset: 'general', // Current selected preset
  query_instruction_presets: {
    character: 'Given a character-related query, retrieve passages that describe character traits, personality, relationships, or actions. Consider metadata such as floor (chronological position), world info entries, and chapter markers when evaluating relevance.',
    plot: 'Given a story context, retrieve passages that contain plot-relevant details, foreshadowing, or significant events. Pay attention to metadata including floor numbers (temporal ordering), chapter divisions, and world book entries for contextual relevance.',
    worldview: 'Given a world-building query, retrieve passages that contain setting details, lore information, or world mechanics. Utilize metadata like world info entry names, chapter context, and chronological floor positions to identify relevant content.',
    writing_style: 'Given a writing style query, retrieve passages that exemplify narrative techniques, prose style, or linguistic patterns. Consider metadata such as chapter markers and floor positions to understand stylistic evolution throughout the narrative.',
    general: 'Given a query, retrieve relevant passages from the context. Consider all available metadata including floor (chronological position), world info entries, and chapter/section markers to ensure comprehensive retrieval.'
  },
  rerank_deduplication_enabled: false, // Enable Rerank deduplication
  rerank_deduplication_instruction: 'Execute the following operations:\n1. Sort documents by relevance in descending order\n2. Consider documents as duplicates if they meet ANY of these conditions:\n   - Core content overlap exceeds 60% (reduced from 80% for better precision)\n   - Contains identical continuous passages of 5+ words\n   - Shares the same examples, data points, or evidence\n3. When evaluating duplication, consider metadata differences:\n   - Different originalIndex values indicate temporal separation\n   - Different chunk numbers (chunk=X/Y) from the same entry should be preserved\n   - Different floor numbers represent different chronological positions\n   - Different world info entries or chapter markers indicate distinct contexts\n4. For identified duplicates, keep only the most relevant one, demote others to bottom 30% positions (reduced from 50% for gentler deduplication)', // Rerank deduplication instruction

  // Injection settings
  template: '<must_know>以下是从相关背景知识库，包含重要的上下文、设定或细节：\n{{text}}</must_know>',
  position: extension_prompt_types.IN_PROMPT,
  depth: 2,
  depth_role: extension_prompt_roles.SYSTEM,
  include_wi: false,

  // Template presets
  template_presets: {
    default: [
      {
        id: 'style',
        name: '文风参考',
        template: '<writing_style>请参考以下文风和写作风格：\n{{text}}</writing_style>',
        description: '用于导入小说时参考文风'
      },
      {
        id: 'setting',
        name: '设定参考',
        template: '<world_setting>以下是世界观和设定信息：\n{{text}}</world_setting>',
        description: '用于参考世界观设定'
      },
      {
        id: 'character',
        name: '人设参考',
        template: '<character_info>以下是相关角色的人物设定：\n{{text}}</character_info>',
        description: '用于参考人物设定'
      },
      {
        id: 'plot',
        name: '剧情体验',
        template: '<story_plot>以下是相关的剧情内容，请参考但不要直接照搬：\n{{text}}</story_plot>',
        description: '用于体验小说剧情'
      },
      {
        id: 'context',
        name: '上下文记录',
        template: '<new_context>注意：以下是新添加的重要上下文记录：\n{{text}}</new_context>',
        description: '强调是新添加的记录'
      }
    ],
    custom: [
      {
        id: 'custom1',
        name: '自定义模板1',
        template: '',
        description: '用户自定义模板'
      },
      {
        id: 'custom2',
        name: '自定义模板2',
        template: '',
        description: '用户自定义模板'
      },
      {
        id: 'custom3',
        name: '自定义模板3',
        template: '',
        description: '用户自定义模板'
      }
    ]
  },
  active_preset_id: null,

  // Content tags
  content_tags: {
    chat: 'past_chat',
    file: 'databank',
    world_info: 'world_part',
  },

  // Content selection
  selected_content: {
    chat: {
      enabled: false,
      range: { start: 0, end: -1 },
      types: { user: true, assistant: true },
      tag_rules: [], // structured tag rules
      include_hidden: false, // 是否包含隐藏消息
    },
    files: { enabled: false, selected: [] },
    world_info: { enabled: false, selected: {} }, // { worldId: [entryIds] }
  },

  // Content filtering
  content_blacklist: [], // Array of keywords to filter out content

  // Vector tasks management
  vector_tasks: {}, // { chatId: [{ taskId, name, timestamp, settings, enabled }] }
  tag_rules_version: 2,

  // Memory management settings
  memory: {
    source: 'main',
    detailLevel: 'normal', // 默认详细程度
    maxTokens: 8192, // 默认最大token数
    google: {
      model: ''
    },
    openai_compatible: {
      url: '',
      model: ''
    },
    summaryFormat: `总结应当遵循以下原则：
- 按时间顺序或逻辑顺序组织信息
- 保留关键事件和重要细节，省略冗余描述
- 直接陈述事实，避免主观评价
- 使用简洁清晰的语言，避免过度修饰
- 突出事件发展脉络和关键转折点
- 不使用任何xml标签包裹，使用纯文字进行叙述
- {{length}}
- 不回避任何敏感内容，保证记录完全还原前文

总结必须使用以下格式：
【关键事件标题】
关键事件概述。
发生地点:
关键角色:
• {分解事件1（小标题形式）}: {简要描述}
• {分解事件2（小标题形式）}: {简要描述}
• {分解事件3（小标题形式）}: {简要描述}
...`
  },

};

const moduleWorker = new ModuleWorkerWrapper(synchronizeChat);
const cachedVectors = new Map(); // Cache for vectorized content
let syncBlocked = false;

// 创建存储适配器实例
let storageAdapter = null;
// 创建向量化适配器实例
let vectorizationAdapter = null;
// 创建 Rerank 服务实例
let rerankService = null;

// 防重复通知机制
let lastNotificationTime = 0;
const NOTIFICATION_COOLDOWN = 5000; // 5秒冷却时间
let lastRerankNotifyTime = 0;

// 向量化状态管理
let isVectorizing = false;
let vectorizationAbortController = null;

/**
 * Deep merge utility function
 * @param {Object} target - Target object
 * @param {Object} source - Source object
 * @returns {Object} Merged object
 */
function deepMerge(target, source) {
  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (!target[key] || typeof target[key] !== 'object') {
          target[key] = {};
        }
        deepMerge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
  }
  return target;
}

/**
 * Generates a unique task ID
 * @returns {string} Unique task ID
 */
function generateTaskId() {
  return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 延迟倒计时函数，用于 TPM 限制控制
 * @param {number} seconds 延迟秒数
 * @param {number} processed 已处理的块数
 * @param {number} total 总块数
 * @param {AbortSignal} signal 中断信号
 * @param {object} progressManager 进度管理器
 */
async function delayWithCountdown(seconds, processed, total, signal, progressManager) {
  console.log(`TPM 延迟控制: 已处理 ${processed}/${total} 块，延迟 ${seconds} 秒`);

  for (let remaining = seconds; remaining > 0; remaining--) {
    if (signal && signal.aborted) {
      throw new Error('向量化被用户中断');
    }

    if (progressManager) {
      progressManager.update(
        processed,
        total,
        `TPM 限制延迟中... ${remaining}秒`
      );
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('TPM 延迟结束，继续处理');
}

/**
 * Gets all vector tasks for a chat
 * @param {string} chatId Chat ID
 * @returns {Array} Array of tasks
 */
function getChatTasks(chatId) {
  if (!chatId || chatId === 'null' || chatId === 'undefined') {
    console.warn('Vectors: getChatTasks called with invalid chatId:', chatId);
    return [];
  }
  if (!settings.vector_tasks[chatId]) {
    settings.vector_tasks[chatId] = [];
  }
  return settings.vector_tasks[chatId];
}

/**
 * Adds a new vector task
 * @param {string} chatId Chat ID
 * @param {object} task Task object
 */
function addVectorTask(chatId, task) {
  if (!chatId || chatId === 'null' || chatId === 'undefined') {
    console.error('Vectors: addVectorTask called with invalid chatId:', chatId);
    return;
  }
  const tasks = getChatTasks(chatId);
  tasks.push(task);
  settings.vector_tasks[chatId] = tasks;

  deepMerge(extension_settings.vectors_enhanced, settings);
  saveSettingsDebounced();
}

/**
 * Removes a vector task
 * @param {string} chatId Chat ID
 * @param {string} taskId Task ID to remove
 */
async function removeVectorTask(chatId, taskId) {
  if (!chatId || chatId === 'null' || chatId === 'undefined') {
    console.error('Vectors: removeVectorTask called with invalid chatId:', chatId);
    return;
  }
  const tasks = getChatTasks(chatId);
  const index = tasks.findIndex(t => t.taskId === taskId);
  if (index !== -1) {
    // Delete the vector collection
    await storageAdapter.purgeVectorIndex(`${chatId}_${taskId}`);
    // Remove from tasks list
    tasks.splice(index, 1);
    settings.vector_tasks[chatId] = tasks;
    Object.assign(extension_settings.vectors_enhanced, settings);
    saveSettingsDebounced();
  }
}

/**
 * Renames a vector task
 * @param {string} chatId Chat ID
 * @param {string} taskId Task ID to rename
 * @param {string} currentName Current task name
 */
async function renameVectorTask(chatId, taskId, currentName) {
  // Try to generate a smart name as default if we have task data
  let defaultName = currentName;
  const tasks = getChatTasks(chatId);
  const task = tasks.find(t => t.taskId === taskId);

  if (task && task.actualProcessedItems && (task.actualProcessedItems.chat || task.actualProcessedItems.files || task.actualProcessedItems.world_info)) {
    // Import TaskNameGenerator
    const { TaskNameGenerator } = await import('./src/utils/taskNaming.js');

    // Construct items for name generation
    const items = [];

    // Add chat items
    if (task.actualProcessedItems.chat) {
      task.actualProcessedItems.chat.forEach(index => {
        items.push({
          type: 'chat',
          metadata: { index: index, is_user: index % 2 === 1 }
        });
      });
    }

    // Generate smart name as default
    defaultName = TaskNameGenerator.generateSmartName(items, task.settings);
  }

  const newName = await callGenericPopup(
    '请输入新的任务名称：',
    POPUP_TYPE.INPUT,
    defaultName,
    {
      okButton: '确认',
      cancelButton: '取消',
    }
  );

  if (newName && newName.trim() && newName.trim() !== currentName) {
    const taskIndex = tasks.findIndex(t => t.taskId === taskId);

    if (taskIndex !== -1) {
      console.log('[Vectors] Renaming task:', {
        chatId,
        taskId,
        oldName: currentName,
        newName: newName.trim(),
        taskIndex,
        task: tasks[taskIndex]
      });

      tasks[taskIndex].name = newName.trim();
      tasks[taskIndex].isCustomName = true; // 标记为用户自定义名称
      settings.vector_tasks[chatId] = tasks;

      // 确保 extension_settings.vectors_enhanced 存在
      if (!extension_settings.vectors_enhanced) {
        extension_settings.vectors_enhanced = {};
      }

      Object.assign(extension_settings.vectors_enhanced, settings);
      saveSettingsDebounced();

      console.log('[Vectors] After rename:', {
        taskName: tasks[taskIndex].name,
        settingsTaskName: settings.vector_tasks[chatId][taskIndex].name,
        extensionSettingsTaskName: extension_settings.vectors_enhanced?.vector_tasks?.[chatId]?.[taskIndex]?.name
      });

      // Refresh the task list UI
      await updateTaskList(getChatTasks, renameVectorTask, removeVectorTask);
      toastr.success('任务已重命名');
    }
  }
}

/**
 * Gets the Collection ID for a file embedded in the chat.
 * @param {string} fileUrl URL of the file
 * @returns {string} Collection ID
 */
function getFileCollectionId(fileUrl) {
  return `file_${getHashValue(fileUrl)}`;
}


/**
 * Gets all available files from different sources
 * @returns {Map<string, object>} Map of file URL to file object
 */
function getAllAvailableFiles() {
  const fileMap = new Map();
  const context = getContext();

  try {
    // Add files from different sources
    getDataBankAttachments().forEach(file => {
      if (file && file.url) fileMap.set(file.url, file);
    });

    getDataBankAttachmentsForSource('global').forEach(file => {
      if (file && file.url) fileMap.set(file.url, file);
    });

    getDataBankAttachmentsForSource('character').forEach(file => {
      if (file && file.url) fileMap.set(file.url, file);
    });

    getDataBankAttachmentsForSource('chat').forEach(file => {
      if (file && file.url) fileMap.set(file.url, file);
    });

    // Add files from chat messages
    if (context.chat) {
      context.chat.filter(x => x.extra?.file).forEach(msg => {
        const file = msg.extra.file;
        if (file && file.url) fileMap.set(file.url, file);
      });
    }
  } catch (error) {
    console.error('Vectors: Error getting files:', error);
  }

  return fileMap;
}

/**
 * Parses tag configuration with exclusion syntax
 * @param {string} tagConfig Tag configuration string
 * @returns {object} Object with mainTag and excludeTags
 */


// Note: Content filtering functions have been moved to src/utils/contentFilter.js
// Note: escapeRegex has been moved to src/utils/contentFilter.js

/**
 * Gets all raw content for scanning, bypassing tag extraction rules.
 * @returns {Promise<VectorItem[]>} Array of vector items with raw text
 */
async function getRawContentForScanning() {
  const items = [];
  const context = getContext();
  const selectedContent = settings.selected_content;

  // Chat messages
  if (selectedContent.chat.enabled && context.chat) {
    const chatSettings = selectedContent.chat;

    // 使用新的 getMessages 函数获取过滤后的消息
    const messageOptions = {
      includeHidden: chatSettings.include_hidden || false,
      types: chatSettings.types || { user: true, assistant: true },
      range: chatSettings.range
    };

    const messages = getMessages(context.chat, messageOptions);

    messages.forEach(msg => {
      // Use raw message content, bypassing extractTagContent
      items.push(createVectorItem(msg, msg.text));
    });
  }

  // Files
  if (selectedContent.files.enabled) {
    const fileMap = getAllAvailableFiles();
    const allFiles = Array.from(fileMap.values());
    let fileIndex = 0;  // 为文件添加索引
    for (const file of allFiles) {
      if (!selectedContent.files.selected.includes(file.url)) continue;
      try {
        const text = await getFileAttachment(file.url);
        if (text && text.trim()) {
          items.push({
            type: 'file',
            text: text,
            metadata: {
              name: file.name,
              originalIndex: fileIndex  // 添加原始索引
            },
            selected: true
          });
          fileIndex++;  // 递增文件索引
        }
      } catch (error) {
        console.error(`Vectors: Error processing file for scanning ${file.name}:`, error);
      }
    }
  }

  // World Info
  if (selectedContent.world_info.enabled) {
    const entries = await getSortedEntries();
    for (const entry of entries) {
      if (!entry.world || !entry.content || entry.disable) continue;
      const selectedEntries = selectedContent.world_info.selected[entry.world] || [];
      if (!selectedEntries.includes(entry.uid)) continue;
      items.push({ type: 'world_info', text: entry.content, metadata: { world: entry.world, uid: entry.uid }, selected: true });
    }
  }

  return items;
}
/**
 * Gets all vectorizable content based on provided settings
 * @param {object} contentSettings Optional content settings, defaults to global settings
 * @returns {Promise<VectorItem[]>} Array of vector items
 */
async function getVectorizableContent(contentSettings = null) {
  const items = [];
  const context = getContext();
  const selectedContent = contentSettings || settings.selected_content;

  // Chat messages
  if (selectedContent.chat.enabled && context.chat) {
        const chatSettings = selectedContent.chat;
        const rules = chatSettings.tag_rules || [];

        // 使用新的 getMessages 函数获取过滤后的消息
        const messageOptions = {
            includeHidden: chatSettings.include_hidden || false,
            types: chatSettings.types || { user: true, assistant: true },
            range: chatSettings.range,
            newRanges: chatSettings.newRanges
        };

        const messages = getMessages(context.chat, messageOptions);

        messages.forEach(msg => {
            let extractedText;
            // 检查是否为首楼（index === 0）或用户楼层（msg.is_user === true）
            if (msg.index === 0 || msg.is_user === true) {
                // 首楼或用户楼层：使用完整的原始文本，不应用标签提取规则
                extractedText = msg.text;
            } else {
                // 其他楼层：应用标签提取规则
                extractedText = extractTagContent(msg.text, rules, settings.content_blacklist || []);
            }

            // 对于预览，text 和 rawText 都应该是标签提取后的结果
            // createVectorItem 会在 rawText 为 null 时自动使用 text
            items.push(createVectorItem(msg, extractedText, extractedText));
        });
    }

  // Files
  if (selectedContent.files.enabled) {
    const fileMap = getAllAvailableFiles();
    const allFiles = Array.from(fileMap.values());
    console.debug(`Vectors: Total unique files found: ${allFiles.length}`);
    console.debug(`Vectors: Selected files in settings: ${selectedContent.files.selected.length}`, selectedContent.files.selected);

    let processedFileCount = 0;
    let fileIndex = 0;  // 为文件添加索引
    for (const file of allFiles) {
      if (!selectedContent.files.selected.includes(file.url)) continue;

      try {
        const text = await getFileAttachment(file.url);
        if (text && text.trim()) {
          items.push({
            type: 'file',
            text: text,
            metadata: {
              name: file.name,
              url: file.url,
              size: file.size,
              originalIndex: fileIndex,  // 添加原始索引
            },
            selected: true,
          });
          processedFileCount++;
          fileIndex++;  // 递增文件索引
          console.debug(`Vectors: Successfully processed file: ${file.name} with index ${fileIndex - 1}`);
        } else {
          console.warn(`Vectors: File ${file.name} is empty or failed to read`);
        }
      } catch (error) {
        console.error(`Vectors: Error processing file ${file.name}:`, error);
        // 也在用户界面显示文件处理失败的信息
        toastr.warning(`文件 "${file.name}" 处理失败: ${error.message}`);
      }
    }

    console.debug(`Vectors: Actually processed ${processedFileCount} files out of ${selectedContent.files.selected.length} selected`);
  }

  // World Info
  if (selectedContent.world_info.enabled) {
    const entries = await getSortedEntries();

    // 调试：显示实际选择的世界信息
    console.debug('Vectors: Selected world info:', selectedContent.world_info.selected);
    const totalSelected = Object.values(selectedContent.world_info.selected).flat().length;
    console.debug(`Vectors: Total selected world info entries: ${totalSelected}`);

    let processedWICount = 0;

    for (const entry of entries) {
      if (!entry.world || !entry.content || entry.disable) continue;

      const selectedEntries = selectedContent.world_info.selected[entry.world] || [];
      if (!selectedEntries.includes(entry.uid)) continue;

      items.push({
        type: 'world_info',
        text: entry.content,
        metadata: {
          world: entry.world,
          uid: entry.uid,
          key: entry.key.join(', '),
          comment: entry.comment,
        },
        selected: true,
      });

      processedWICount++;
      console.debug(`Vectors: Successfully processed world info entry: ${entry.comment || entry.uid} from world ${entry.world}`);
    }

    console.debug(`Vectors: Actually processed ${processedWICount} world info entries out of ${totalSelected} selected`);
  }

  // 最终调试信息
  const finalCounts = {
    chat: items.filter(item => item.type === 'chat').length,
    file: items.filter(item => item.type === 'file').length,
    world_info: items.filter(item => item.type === 'world_info').length,
    total: items.length
  };

  console.debug('Vectors: Final getVectorizableContent result:', {
    finalCounts,
    settings: {
      chat_enabled: selectedContent.chat.enabled,
      files_enabled: selectedContent.files.enabled,
      files_selected_count: selectedContent.files?.selected?.length || 0,
      wi_enabled: selectedContent.world_info.enabled,
      wi_selected_count: Object.values(selectedContent.world_info?.selected || {}).flat().length
    }
  });

  return items;
}



/**
 * Generates a task name based on actual processed items
 * @param {object} contentSettings The actual content settings being processed
 * @param {Array} actualItems Array of actual items that were processed
 * @returns {Promise<string>} Task name
 */
async function generateTaskName(contentSettings, actualItems) {
  console.log('Debug: Generating task name with settings:', JSON.stringify(contentSettings, null, 2));
  const parts = [];

  console.debug('Vectors: generateTaskName input:', {
    contentSettings,
    actualItemsCount: actualItems.length,
    actualItems: actualItems.map(item => ({ type: item.type, metadata: item.metadata }))
  });

  // Count actual items by type
  const itemCounts = {
    chat: 0,
    file: 0,
    world_info: 0
  };

  actualItems.forEach(item => {
    if (itemCounts.hasOwnProperty(item.type)) {
      itemCounts[item.type]++;
    }
  });

  console.debug('Vectors: Actual item counts:', itemCounts);

  // Chat range - use newRanges if available for accurate naming
    const chatItems = actualItems.filter(item => item.type === 'chat');
    if (chatItems.length > 0) {
        const indices = chatItems.map(item => item.metadata.index).sort((a, b) => a - b);

        // Format non-continuous ranges properly
        const ranges = [];
        let start = indices[0];
        let end = indices[0];

        for (let i = 1; i < indices.length; i++) {
            if (indices[i] === end + 1) {
                // Continuous, extend the range
                end = indices[i];
            } else {
                // Not continuous, save current range and start new one
                if (start === end) {
                    ranges.push(`#${start}`);
                } else {
                    ranges.push(`#${start}-${end}`);
                }
                start = indices[i];
                end = indices[i];
            }
        }

        // Add the last range
        if (start === end) {
            ranges.push(`#${start}`);
        } else {
            ranges.push(`#${start}-${end}`);
        }

        // Join ranges with proper formatting
        if (ranges.length === 1) {
            parts.push(`消息 ${ranges[0]}`);
        } else if (ranges.length <= 3) {
            parts.push(`消息 ${ranges.join('、')}`);
        } else {
            // For many ranges, show first few and count
            parts.push(`消息 ${ranges.slice(0, 2).join('、')}等 (${chatItems.length}条)`);
        }

        console.debug('Vectors: Added chat part (from actual items):', parts[parts.length - 1]);
    }

  // Files - use actual file count
  if (contentSettings.files && contentSettings.files.enabled && itemCounts.file > 0) {
    parts.push(`${itemCounts.file} 个文件`);
    console.debug('Vectors: Added file part (actual count):', parts[parts.length - 1]);
  }

  // World info - use actual world info count
  if (contentSettings.world_info && contentSettings.world_info.enabled && itemCounts.world_info > 0) {
    parts.push(`${itemCounts.world_info} 条世界信息`);
    console.debug('Vectors: Added world info part (actual count):', parts[parts.length - 1]);
  }

  // If no specific content selected, use generic name
  if (parts.length === 0) {
    parts.push(`${actualItems.length} 个项目`);
    console.debug('Vectors: Added generic part:', parts[parts.length - 1]);
  }

  // Add timestamp
  const time = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  const finalName = `${parts.join(', ')} (${time})`;
  console.debug('Vectors: Final task name:', finalName);
  return finalName;
}

/**
 * Checks for existing tasks that overlap with current selection
 * @param {string} chatId Chat ID
 * @param {object} currentSettings Current content selection settings
 * @returns {object} Analysis result with conflicts and new content
 */
function analyzeTaskOverlap(chatId, currentSettings) {
  const existingTasks = getChatTasks(chatId).filter(t => t.enabled);
  const conflicts = [];
  const newContentSources = [];

  console.debug('Vectors: Starting overlap analysis:', {
    chatId,
    existingTaskCount: existingTasks.length,
    existingTasks: existingTasks.map(t => ({ name: t.name, taskId: t.taskId })),
    currentSettings: {
      chat: currentSettings.chat.enabled,
      files: currentSettings.files.enabled ? currentSettings.files.selected.length : 0,
      world_info: currentSettings.world_info.enabled ? Object.values(currentSettings.world_info.selected).flat().length : 0
    }
  });

  // Check chat message overlap
  if (currentSettings.chat.enabled) {
    const currentStart = currentSettings.chat.range?.start || 0;
    const currentEnd = currentSettings.chat.range?.end || -1;
    const currentTags = currentSettings.chat.tags || '';
    const currentTypes = currentSettings.chat.types || { user: true, assistant: true };
    const currentHidden = currentSettings.chat.include_hidden || false;

    let hasCompleteMatch = false;
    let hasPartialOverlap = false;

    for (const task of existingTasks) {
      const taskChat = task.settings?.chat;
      if (taskChat?.enabled) {
        const taskStart = taskChat.range?.start || 0;
        const taskEnd = taskChat.range?.end || -1;
        const taskTags = taskChat.tags || '';
        const taskTypes = taskChat.types || { user: true, assistant: true };
        const taskHidden = taskChat.include_hidden || false;

        // Check if settings are identical
        const sameSettings = (
          taskTags === currentTags &&
          JSON.stringify(taskTypes) === JSON.stringify(currentTypes) &&
          taskHidden === currentHidden
        );

        if (sameSettings) {
          // Check for exact match
          const isExactMatch = (taskStart === currentStart && taskEnd === currentEnd);

          // Check if current range is completely contained in existing task
          const isContained = (
            taskStart <= currentStart &&
            (taskEnd === -1 || (currentEnd !== -1 && currentEnd <= taskEnd))
          );

          // Check for any overlap (more precise logic)
          const hasOverlap = (() => {
            // Handle -1 (end) cases
            const actualCurrentEnd = currentEnd === -1 ? Infinity : currentEnd;
            const actualTaskEnd = taskEnd === -1 ? Infinity : taskEnd;

            // Ranges overlap if they intersect
            return (
              currentStart <= actualTaskEnd &&
              taskStart <= actualCurrentEnd
            );
          })();

          if (isExactMatch || isContained) {
            hasCompleteMatch = true;
            conflicts.push({
              type: 'chat_duplicate',
              taskName: task.name,
              taskRange: { start: taskStart, end: taskEnd },
              message: `楼层 #${currentStart}-#${currentEnd === -1 ? '最后' : currentEnd} 已在任务"${task.name}"中向量化`
            });
          } else if (hasOverlap) {
            hasPartialOverlap = true;
            conflicts.push({
              type: 'chat_partial',
              taskName: task.name,
              taskRange: { start: taskStart, end: taskEnd },
              currentRange: { start: currentStart, end: currentEnd },
              message: `楼层与任务"${task.name}"(#${taskStart}-#${taskEnd === -1 ? '最后' : taskEnd})存在重叠`
            });
          }
        }
      }
    }

    // Only add as new content if there's no complete match
    if (!hasCompleteMatch) {
      newContentSources.push('聊天记录');
    }
  }

  // Check file overlap
  if (currentSettings.files.enabled && currentSettings.files.selected.length > 0) {
    const existingFiles = new Set();
    const fileTaskMap = new Map(); // 记录每个文件在哪些任务中

    // 收集所有已存在的文件
    for (const task of existingTasks) {
      if (task.settings?.files?.enabled && task.settings.files.selected) {
        task.settings.files.selected.forEach(url => {
          existingFiles.add(url);
          if (!fileTaskMap.has(url)) {
            fileTaskMap.set(url, []);
          }
          fileTaskMap.get(url).push(task.name);
        });
      }
    }

    console.debug('Vectors: File overlap analysis:', {
      currentSelected: currentSettings.files.selected,
      currentSelectedCount: currentSettings.files.selected.length,
      existingFiles: Array.from(existingFiles),
      existingFilesCount: existingFiles.size,
      fileTaskMap: Object.fromEntries(fileTaskMap),
      allExistingTaskFiles: existingTasks.map(task => ({
        taskName: task.name,
        files: task.settings?.files?.selected || []
      }))
    });

    const newFiles = currentSettings.files.selected.filter(url => !existingFiles.has(url));
    const duplicateFiles = currentSettings.files.selected.filter(url => existingFiles.has(url));

    console.debug('Vectors: File analysis result:', {
      newFiles,
      duplicateFiles,
      newFileCount: newFiles.length,
      duplicateFileCount: duplicateFiles.length
    });

    if (duplicateFiles.length > 0) {
      conflicts.push({
        type: 'files_partial',
        message: `${duplicateFiles.length} 个文件已被向量化`,
        details: duplicateFiles,
        taskInfo: duplicateFiles.map(url => ({
          url,
          tasks: fileTaskMap.get(url) || []
        }))
      });
    }

    if (newFiles.length > 0) {
      newContentSources.push(`${newFiles.length} 个新文件`);
    }
  }

  // Check world info overlap
  if (currentSettings.world_info.enabled) {
    const existingEntries = new Set();
    for (const task of existingTasks) {
      if (task.settings?.world_info?.enabled && task.settings.world_info.selected) {
        Object.values(task.settings.world_info.selected).flat().forEach(uid => existingEntries.add(uid));
      }
    }

    const currentEntries = Object.values(currentSettings.world_info.selected).flat();
    const newEntries = currentEntries.filter(uid => !existingEntries.has(uid));
    const duplicateEntries = currentEntries.filter(uid => existingEntries.has(uid));

    if (duplicateEntries.length > 0) {
      conflicts.push({
        type: 'worldinfo_partial',
        message: `${duplicateEntries.length} 个世界信息条目已被向量化`,
        details: duplicateEntries
      });
    }

    if (newEntries.length > 0) {
      newContentSources.push(`${newEntries.length} 个新世界信息条目`);
    }
  }

  const result = {
    hasConflicts: conflicts.length > 0,
    conflicts,
    newContentSources,
    hasNewContent: newContentSources.length > 0
  };

  console.debug('Vectors: Overlap analysis complete:', {
    result,
    conflictDetails: conflicts.map(c => ({
      type: c.type,
      message: c.message,
      details: c.details || 'no details'
    }))
  });

  return result;
}

/**
 * Creates filtered settings with only new content
 * @param {object} currentSettings Current settings
 * @param {string} chatId Chat ID
 * @param {Array} conflicts Array of conflict objects
 * @returns {object} Filtered settings with only new content
 */
function createIncrementalSettings(currentSettings, chatId, conflicts) {
  const existingTasks = getChatTasks(chatId).filter(t => t.enabled);
  const newSettings = JSON.parse(JSON.stringify(currentSettings));

  // Initialize coveredRanges at function scope for debugging
  let coveredRanges = [];

  // Handle chat message ranges - calculate new range based on conflicts
  if (newSettings.chat.enabled) {
    const currentStart = currentSettings.chat.range?.start || 0;
    const currentEnd = currentSettings.chat.range?.end || -1;
    const currentTags = currentSettings.chat.tags || '';
    const currentTypes = currentSettings.chat.types || { user: true, assistant: true };
    const currentHidden = currentSettings.chat.include_hidden || false;

    // Find all existing covered ranges with same settings
    coveredRanges = [];
    for (const task of existingTasks) {
      const taskChat = task.settings?.chat;
      if (taskChat?.enabled) {
        const taskStart = taskChat.range?.start || 0;
        const taskEnd = taskChat.range?.end || -1;
        const taskTags = taskChat.tags || '';
        const taskTypes = taskChat.types || { user: true, assistant: true };
        const taskHidden = taskChat.include_hidden || false;

        // Only consider ranges with same settings
        const sameSettings = (
          taskTags === currentTags &&
          JSON.stringify(taskTypes) === JSON.stringify(currentTypes) &&
          taskHidden === currentHidden
        );

        if (sameSettings) {
          coveredRanges.push({ start: taskStart, end: taskEnd });
        }
      }
    }

    // Calculate the new range that's not covered using a more robust algorithm
    if (coveredRanges.length === 0) {
      // No existing ranges, keep current range
      // hasNewRange is already true by default
    } else {
      // Sort covered ranges by start position
      coveredRanges.sort((a, b) => a.start - b.start);

      // Find gaps and uncovered areas
      const newRanges = [];
      let checkStart = currentStart;
      const actualCurrentEnd = currentEnd === -1 ? 999999 : currentEnd; // Use large number for -1

      for (const covered of coveredRanges) {
        const coveredStart = covered.start;
        const coveredEnd = covered.end === -1 ? 999999 : covered.end;

        // Skip if covered range is completely outside current range
        if (coveredEnd < currentStart || coveredStart > actualCurrentEnd) {
          continue;
        }

        // If there's a gap before this covered range
        if (checkStart < coveredStart) {
          const gapEnd = Math.min(actualCurrentEnd, coveredStart - 1);
          if (checkStart <= gapEnd) {
            newRanges.push({ start: checkStart, end: gapEnd === 999999 ? -1 : gapEnd });
          }
        }

        // Move checkStart to after this covered range
        checkStart = Math.max(checkStart, coveredEnd + 1);
      }

      // Check if there's remaining range after all covered ranges
      if (checkStart <= actualCurrentEnd) {
        newRanges.push({ start: checkStart, end: currentEnd });
      }

      // Handle multiple new ranges
    if (newRanges.length > 0) {
        // Store all new ranges for display and processing purposes.
        // Our enhanced getVectorizableContent will now use this array directly.
        newSettings.chat.newRanges = newRanges;

        // We no longer create a single, large, incorrect range.
        // We also don't need to set isMultiRange anymore.
        // The original `range` property in newSettings will be ignored by the new getVectorizableContent logic.
    } else {
        // No new content found for chat messages.
        newSettings.chat.enabled = false;
    }
    }
  }

  console.debug('Vectors: createIncrementalSettings result:', {
    originalChat: currentSettings.chat,
    newChat: newSettings.chat,
    coveredRanges: newSettings.chat.enabled ? coveredRanges : 'N/A'
  });

  // Filter out existing files
  if (newSettings.files.enabled) {
    const existingFiles = new Set();
    for (const task of existingTasks) {
      if (task.settings?.files?.enabled && task.settings.files.selected) {
        task.settings.files.selected.forEach(url => existingFiles.add(url));
      }
    }
    newSettings.files.selected = newSettings.files.selected.filter(url => !existingFiles.has(url));
    if (newSettings.files.selected.length === 0) {
      newSettings.files.enabled = false;
    }
  }

  // Filter out existing world info
  if (newSettings.world_info.enabled) {
    const existingEntries = new Set();
    for (const task of existingTasks) {
      if (task.settings?.world_info?.enabled && task.settings.world_info.selected) {
        Object.values(task.settings.world_info.selected).flat().forEach(uid => existingEntries.add(uid));
      }
    }

    for (const [world, uids] of Object.entries(newSettings.world_info.selected)) {
      newSettings.world_info.selected[world] = uids.filter(uid => !existingEntries.has(uid));
      if (newSettings.world_info.selected[world].length === 0) {
        delete newSettings.world_info.selected[world];
      }
    }

    if (Object.keys(newSettings.world_info.selected).length === 0) {
      newSettings.world_info.enabled = false;
    }
  }

  console.log('Debug: Incremental settings created:', JSON.stringify(newSettings, null, 2));
  return newSettings;
}

/**
 * Performs the actual vectorization with given settings
 * @param {object} contentSettings Settings for content selection
 * @param {string} chatId Chat ID
 * @param {boolean} isIncremental Whether this is incremental vectorization
 */

/**
 * Pipeline version of performVectorization
 * Uses the complete text processing pipeline: Extract → Process → Dispatch → Execute
 * @param {Object} contentSettings - Content settings
 * @param {string} chatId - Chat ID
 * @param {boolean} isIncremental - Whether this is incremental
 * @param {Array} items - Items to vectorize
 * @returns {Promise<Object>} Result with success status and metadata
 */
async function performVectorization(contentSettings, chatId, isIncremental, items, options = {}) {
  console.log('Pipeline: Starting FULL pipeline processing with settings:', JSON.stringify(contentSettings, null, 2));
  const { skipDeduplication = false, taskType = 'vectorization', customTaskName = null } = options;

  // Import all pipeline components
  const { pipelineIntegration } = await import('./src/core/pipeline/PipelineIntegration.js');
  const { ChatExtractor } = await import('./src/core/extractors/ChatExtractor.js');
  const { FileExtractor } = await import('./src/core/extractors/FileExtractor.js');
  const { WorldInfoExtractor } = await import('./src/core/extractors/WorldInfoExtractor.js');

  // 声明在外部作用域的变量，以便在 catch 块中访问
  let allProcessedChunks = [];
  let taskId;
  let taskName;
  let correctedSettings;
  let actualProcessedItems;
  let lastSavedChunk = null; // 追踪最后成功保存的 chunk

  try {
    // Initialize pipeline with full functionality
    if (!pipelineIntegration.isEnabled()) {
      console.log('Pipeline: Initializing complete pipeline system...');
      await pipelineIntegration.initialize({
        vectorizationAdapter: vectorizationAdapter,
        settings: settings
      });
      pipelineIntegration.setEnabled(true);
    }

    // Generate task metadata
    if (customTaskName) {
      // Use custom task name if provided
      taskName = customTaskName;
    } else {
      // Generate task name normally
      taskName = await generateTaskName(contentSettings, items);
    }

    // Set vectorization state
    isVectorizing = true;
    vectorizationAbortController = new AbortController();

    // Update UI state
    $('#vectors_enhanced_vectorize').hide();
    $('#vectors_enhanced_abort').show();

    // 添加进度跟踪变量
    let processedChunksCount = 0;
    let totalItemsCount = items.length;

    // Create task and collection IDs
    taskId = generateTaskId();
    const collectionId = `${chatId}_${taskId}`;
    let vectorsInserted = false;

    try {
      const progressMessage = isIncremental ? '增量向量化开始...' : '向量化开始...';
      toastr.info(progressMessage, '处理中');

      // === PHASE 1: USE PRE-EXTRACTED ITEMS (Skip Re-extraction) ===
      console.log('Pipeline: Phase 1 - Using pre-extracted items (Skip Re-extraction)');
      console.log(`Pipeline: getVectorizableContent() already provided ${items.length} items`);

      if (globalProgressManager) {
        globalProgressManager.show(0, items.length, '准备项目');
      } else {
        updateProgressNew(0, items.length, '准备项目');
      }

      // Group items by type without re-extraction
      const extractedContent = [];

      // Group chat items
      const chatItems = items.filter(item => item.type === 'chat');
      if (chatItems.length > 0 && contentSettings.chat?.enabled) {
        console.log(`Pipeline: Prepared ${chatItems.length} chat items for processing`);
        extractedContent.push({
          type: 'chat',
          content: chatItems, // 保持数组格式！不合并！
          metadata: {
            extractorType: 'PreExtracted',
            itemCount: chatItems.length,
            source: 'getVectorizableContent'
          }
        });
      }

      // Group file items
      const fileItems = items.filter(item => item.type === 'file');
      if (fileItems.length > 0 && contentSettings.files?.enabled) {
        console.log(`Pipeline: Prepared ${fileItems.length} file items for processing`);
        extractedContent.push({
          type: 'file',
          content: fileItems, // 保持数组格式！不合并！
          metadata: {
            extractorType: 'PreExtracted',
            itemCount: fileItems.length,
            source: 'getVectorizableContent'
          }
        });
      }

      // Group world info items
      const worldInfoItems = items.filter(item => item.type === 'world_info');
      if (worldInfoItems.length > 0 && contentSettings.world_info?.enabled) {
        console.log(`Pipeline: Prepared ${worldInfoItems.length} world info items for processing`);
        extractedContent.push({
          type: 'world_info',
          content: worldInfoItems, // 保持数组格式！不合并！
          metadata: {
            extractorType: 'PreExtracted',
            itemCount: worldInfoItems.length,
            source: 'getVectorizableContent'
          }
        });
      }

      if (globalProgressManager) {
        globalProgressManager.update(items.length, items.length, '项目准备完成');
      }

      console.log(`Pipeline: Prepared ${extractedContent.length} content blocks containing ${items.length} total items`);
      console.log('Pipeline: Content block summary:', extractedContent.map(block => ({
        type: block.type,
        itemCount: Array.isArray(block.content) ? block.content.length : 1,
        isArray: Array.isArray(block.content),
        firstItemPreview: Array.isArray(block.content) && block.content.length > 0
          ? block.content[0].text?.substring(0, 50) + '...'
          : 'N/A'
      })));

      // === PHASE 2: TEXT PROCESSING ===
      console.log('Pipeline: Phase 2 - Text Processing through Pipeline');
      if (globalProgressManager) {
        globalProgressManager.show(0, extractedContent.length, '文本处理');
      }

      // Get pipeline components
      const pipeline = pipelineIntegration.pipeline;
      const dispatcher = pipelineIntegration.dispatcher;

      // Create processing context
      const processingContext = {
        chatId,
        taskId,
        collectionId,
        isIncremental,
        settings: contentSettings,
        abortSignal: vectorizationAbortController.signal,
        source: 'chat_vectorization',
        taskType: taskType, // Pass taskType for summary vectorization detection
        vectorizationSettings: {
          source: settings.source,
          chunk_size: settings.chunk_size,
          overlap_percent: settings.overlap_percent,
          force_chunk_delimiter: settings.force_chunk_delimiter
        }
      };

      // Process each content block through the pipeline
      for (let i = 0; i < extractedContent.length; i++) {
        if (vectorizationAbortController.signal.aborted) {
          throw new Error('向量化被用户中断');
        }

        const contentBlock = extractedContent[i];
        console.log(`Pipeline: Processing content block ${i + 1}/${extractedContent.length} (${contentBlock.type})`);

        // === PHASE 3: TASK DISPATCH ===
        console.log('Pipeline: Phase 3 - Task Dispatch');

        // Prepare input for dispatcher
        const dispatchInput = {
          content: contentBlock.content,
          metadata: {
            ...contentBlock.metadata,
            type: contentBlock.type,
            collectionId: collectionId,
            source: 'pipeline_extraction',
            taskType: taskType // Pass taskType to metadata for vectorization processor
          }
        };

        console.log(`Pipeline: Dispatch input for ${contentBlock.type}:`, {
          isArray: Array.isArray(dispatchInput.content),
          contentLength: Array.isArray(dispatchInput.content)
            ? dispatchInput.content.length
            : dispatchInput.content?.length,
          contentPreview: Array.isArray(dispatchInput.content)
            ? dispatchInput.content.slice(0, 2).map(item => ({
                type: item?.type,
                hasText: !!item?.text,
                textLength: item?.text?.length,
                textPreview: item?.text?.substring(0, 50) + '...'
              }))
            : dispatchInput.content?.substring(0, 100) + '...',
          metadata: dispatchInput.metadata
        });

        // Dispatch through the text dispatcher
        // Pass content and metadata separately - the dispatcher expects content as first param
        const dispatchResult = await dispatcher.dispatch(
          dispatchInput.content,
          'vectorization',
          dispatchInput.metadata,  // This becomes the config parameter in dispatcher
          processingContext
        );

        console.log(`Pipeline: Dispatch result for ${contentBlock.type}:`, {
          success: dispatchResult.success,
          vectorized: dispatchResult.vectorized,
          processingTime: dispatchResult._pipeline?.processingTime
        });

        // Convert pipeline result to chunks format
        if (dispatchResult.success && dispatchResult.vectors) {
          const chunks = dispatchResult.vectors.map((vector, idx) => {
            const rawText = vector.text || vector.content;

            let originalIndex;

            // Special handling for file type - extract originalIndex from the content
            if (contentBlock.type === 'file' && rawText.includes('originalIndex=')) {
              // Extract originalIndex from file META tag
              const match = rawText.match(/originalIndex=(\d+)/);
              if (match) {
                originalIndex = parseInt(match[1], 10);
              } else {
                // Fallback if parsing fails
                originalIndex = idx;
              }
            } else {
              // For other types (chat, world_info), use metadata
              originalIndex = vector.metadata?.originalIndex ??
                            contentBlock.metadata?.originalIndex ??
                            contentBlock.metadata?.index ??
                            idx;
            }

            const metadataPrefix = `[META:type=${contentBlock.type},originalIndex=${originalIndex}]`;
            const encodedText = `${metadataPrefix}${rawText}`;

            return {
              hash: getHashValue(encodedText),
              text: encodedText,
              index: allProcessedChunks.length + idx,
              metadata: {
                ...vector.metadata,
                ...contentBlock.metadata,
                type: contentBlock.type,
                chunk_index: idx,
                chunk_total: dispatchResult.vectors.length,
                pipeline_processed: true
              }
            };
          });

          allProcessedChunks.push(...chunks);
        }

        if (globalProgressManager) {
          globalProgressManager.update(i + 1, extractedContent.length, `处理 ${contentBlock.type} 完成`);
        }
      }

      console.log(`Pipeline: Processing complete. Generated ${allProcessedChunks.length} chunks through full pipeline`);
      console.log('Pipeline: allProcessedChunks details:', allProcessedChunks.map(chunk => ({
        hasText: !!chunk.text,
        textLength: chunk.text?.length,
        textPreview: chunk.text?.substring(0, 50) + '...',
        hasMetadata: !!chunk.metadata,
        metadata: chunk.metadata
      })));

      // === PHASE 4: VECTOR STORAGE ===
      console.log('Pipeline: Phase 4 - Vector Storage');
      if (globalProgressManager) {
        globalProgressManager.show(0, allProcessedChunks.length, '向量存储');
      }

      // Store vectors using existing storage adapter
      const batchSize = 50;
      let chunksProcessedSinceDelay = 0; // 用于 TPM 延迟控制的计数器

      for (let i = 0; i < allProcessedChunks.length; i += batchSize) {
        if (vectorizationAbortController.signal.aborted) {
          throw new Error('向量化被用户中断');
        }

        const batch = allProcessedChunks.slice(i, Math.min(i + batchSize, allProcessedChunks.length));
        await storageAdapter.insertVectorItems(collectionId, batch, vectorizationAbortController.signal, { skipDeduplication });
        vectorsInserted = true;
        // 更新已处理的块数
        processedChunksCount = Math.min(i + batch.length, allProcessedChunks.length);
        chunksProcessedSinceDelay += batch.length;

        // 追踪最后成功保存的 chunk
        if (batch.length > 0) {
          lastSavedChunk = batch[batch.length - 1];
        }

        if (globalProgressManager) {
          globalProgressManager.update(Math.min(i + batchSize, allProcessedChunks.length), allProcessedChunks.length, '向量存储中...');
        }

        // TPM 延迟控制：当处理的块数达到阈值时，进行延迟
        if (settings.batch_delay_enabled &&
            chunksProcessedSinceDelay >= settings.batch_delay_chunks &&
            i + batchSize < allProcessedChunks.length) { // 还有更多批次要处理

          await delayWithCountdown(
            settings.batch_delay_seconds,
            processedChunksCount,
            allProcessedChunks.length,
            vectorizationAbortController.signal,
            globalProgressManager
          );
          chunksProcessedSinceDelay = 0; // 重置计数器
        }
      }

      // Create corrected settings (reuse existing logic)
      const correctedSettings = JSON.parse(JSON.stringify(contentSettings));

      // ... (copy the settings correction logic from original function)
      if (correctedSettings.chat.enabled) {
        const chatItems = items.filter(item => item.type === 'chat');
        if (chatItems.length > 0) {
          const indices = chatItems.map(item => item.metadata.index);
          correctedSettings.chat.range.start = Math.min(...indices);
          correctedSettings.chat.range.end = Math.max(...indices);
        } else {
          correctedSettings.chat.enabled = false;
        }
      }

      if (correctedSettings.files.enabled) {
        const actuallyProcessedFiles = items
          .filter(item => item.type === 'file')
          .map(item => item.metadata.url);
        correctedSettings.files.selected = actuallyProcessedFiles;
      }

      if (correctedSettings.world_info.enabled) {
        const actuallyProcessedEntries = items
          .filter(item => item.type === 'world_info')
          .map(item => item.metadata.uid);
        const newWorldInfoSelected = {};
        for (const uid of actuallyProcessedEntries) {
          const originalWorld = Object.keys(contentSettings.world_info.selected).find(world =>
            contentSettings.world_info.selected[world].includes(uid)
          );
          if (originalWorld) {
            if (!newWorldInfoSelected[originalWorld]) {
              newWorldInfoSelected[originalWorld] = [];
            }
            newWorldInfoSelected[originalWorld].push(uid);
          }
        }
        correctedSettings.world_info.selected = newWorldInfoSelected;
      }

      // Extract actually processed items by type
      const actualProcessedItems = {
        chat: items.filter(item => item.type === 'chat').map(item => item.metadata.index),
        files: items.filter(item => item.type === 'file').map(item => item.metadata.url),
        world_info: items.filter(item => item.type === 'world_info').map(item => ({
          uid: item.metadata.uid,
          world: item.metadata.world,
          comment: item.metadata.comment || '(无注释)'
        }))
      };

      // Create task object
      const task = {
        taskId: taskId,
        name: taskName,
        timestamp: Date.now(),
        settings: correctedSettings,
        enabled: true,
        itemCount: allProcessedChunks.length,
        originalItemCount: items.length,
        isIncremental: isIncremental,
        actualProcessedItems: actualProcessedItems,
        version: '2.0' // Mark as pipeline version
      };

      // 不再保存 textContent 到任务中
      // 所有文本内容都从向量数据库获取
      console.debug(`Vectors: Task created with ${allProcessedChunks.length} chunks. Text stored in vector database only.`);

      // Add task to list
      addVectorTask(chatId, task);

      // Update cache (只缓存哈希值，不缓存文本)
      cachedVectors.set(collectionId, {
        timestamp: Date.now(),
        hashes: allProcessedChunks.map(chunk => chunk.hash),
        itemCount: allProcessedChunks.length,
        settings: JSON.parse(JSON.stringify(settings)),
      });

      // Complete progress
      if (globalProgressManager) {
        globalProgressManager.complete('向量化完成');
      } else {
        hideProgressNew();
      }

      const successMessage = isIncremental ?
        `成功创建增量向量化任务 "${taskName}"：${items.length} 个新项目，${allProcessedChunks.length} 个块` :
        `成功创建向量化任务 "${taskName}"：${items.length} 个项目，${allProcessedChunks.length} 个块`;
      toastr.success(successMessage, '向量化完成');

      // Refresh task list UI
      await updateTaskList(getChatTasks, renameVectorTask, removeVectorTask);

      return {
        success: true,
        taskId,
        collectionId,
        itemCount: allProcessedChunks.length,
        originalItemCount: items.length,
        pipelineProcessed: true
      };

    } catch (error) {
      console.error('Pipeline vectorization failed:', error);

      // Use ProgressManager
      if (globalProgressManager) {
        globalProgressManager.error('向量化失败');
      } else {
        hideProgressNew();
      }

      const isAbort = error.name === 'AbortError' || error.message.includes('用户中断');

      if (vectorsInserted) {
        // Common logic for when some chunks have been inserted
        let lastChunkInfo = '';
        if (lastSavedChunk && lastSavedChunk.text) {
            const decoded = decodeMetadataFromText(lastSavedChunk.text);
            if (decoded.metadata) {
                const meta = decoded.metadata;
                let infoText = '';
                if (meta.type === 'chat') infoText = `聊天消息 #${meta.originalIndex || '未知'}`;
                else if (meta.type === 'file') infoText = `文件块 (索引: ${meta.originalIndex || '未知'})`;
                else if (meta.type === 'world_info') infoText = `世界信息: ${meta.entry || `块 (索引: ${meta.originalIndex || '未知'})`}`;
                else infoText = `${meta.type || '未知类型'} (索引: ${meta.originalIndex || '未知'})`;
                const textPreview = lastSavedChunk.text ? lastSavedChunk.text.substring(0, 120) + (lastSavedChunk.text.length > 120 ? '...' : '') : '(无内容)';
                lastChunkInfo = `<div style="margin-top: 15px; padding: 10px; background: rgba(255, 255, 255, 0.05); border-radius: 4px;"><p style="margin: 0 0 5px 0;"><strong>最后保存的块：</strong></p><p style="margin: 0 0 3px 0; font-size: 0.9em;">类型：${infoText}</p><p style="margin: 0; font-size: 0.9em; color: var(--SmartThemeQuoteColor);">内容预览：${textPreview}</p></div>`;
            }
        }

        const title = isAbort ? '向量化已中断' : '向量化过程中发生错误';
        const errorDetails = isAbort ? '' : `<p style="font-size: 0.9em; color: var(--SmartThemeQuoteColor); word-break: break-all; margin-top: 10px;">错误: ${error.message}</p>`;

        const confirm = await callGenericPopup(
            `<div><p><strong>${title}</strong></p>${errorDetails}<div style="text-align: left; margin: 15px 0;"><p>处理进度：</p><ul style="margin: 5px 0 15px 20px;"><li>已处理块数：${processedChunksCount} / ${allProcessedChunks.length}</li><li>原始项目数：${totalItemsCount}</li><li>完成度：${Math.round((processedChunksCount / allProcessedChunks.length) * 100)}%</li></ul></div>${lastChunkInfo}<p style="margin-top: 15px;">是否保存已处理的内容？</p><p style="font-size: 0.9em; color: var(--SmartThemeQuoteColor);">选择"是"将保留已处理的数据并创建部分完成的任务。<br>选择"否"将清理所有已处理的数据。</p></div>`,
            POPUP_TYPE.CONFIRM,
            { okButton: '是，保存', cancelButton: '否，清理' }
        );

        if (confirm === POPUP_RESULT.AFFIRMATIVE) {
            const processedChunks = allProcessedChunks.slice(0, processedChunksCount);
            const task = {
                taskId: taskId,
                name: taskName + ' (部分完成)',
                timestamp: Date.now(),
                settings: correctedSettings,
                enabled: true,
                itemCount: processedChunks.length,
                originalItemCount: items.length,
                isIncremental: isIncremental,
                isPartial: true,
                completionRate: Math.round((processedChunksCount / allProcessedChunks.length) * 100),
                actualProcessedItems: actualProcessedItems,
                version: '2.0'
            };
            addVectorTask(chatId, task);
            cachedVectors.set(collectionId, {
                timestamp: Date.now(),
                hashes: processedChunks.map(chunk => chunk.hash),
                itemCount: processedChunks.length,
                settings: JSON.parse(JSON.stringify(settings)),
                isPartial: true
            });
            toastr.info(`向量化失败，但已保存 ${processedChunksCount} 个块的数据`, '部分保存');
            await updateTaskList(getChatTasks, renameVectorTask, removeVectorTask);
            return { success: false, aborted: isAbort, partial: true, savedCount: processedChunksCount, error: `操作失败（已保存部分数据）: ${error.message}` };
        } else {
            await storageAdapter.purgeVectorIndex(collectionId);
            toastr.info(`${title}，已清理部分数据`, isAbort ? '中断' : '错误');
            return { success: false, aborted: isAbort, error: isAbort ? '用户中断操作' : error.message };
        }
      } else {
        // Logic for when no chunks have been inserted
        if (isAbort) {
            toastr.info('向量化已中断', '中断');
            return { success: false, aborted: true, error: '用户中断操作' };
        } else {
            toastr.error(`向量化失败: ${error.message}`, '错误');
            throw error; // Re-throw only for non-abort errors that happened early
        }
      }

    } finally {
      // Reset state
      isVectorizing = false;
      vectorizationAbortController = null;
      $('#vectors_enhanced_vectorize').show();
      $('#vectors_enhanced_abort').hide();

      // 清除文件选择状态，避免中断后再次向量化时使用旧的文件选择
      if (settings.selected_content.files && settings.selected_content.files.selected) {
        console.log('Vectors: Clearing file selection after vectorization completion/abort');
        settings.selected_content.files.selected = [];
        Object.assign(extension_settings.vectors_enhanced, settings);
        saveSettingsDebounced();

        // 立即更新UI以反映清理后的状态
        if (typeof updateFileList === 'function') {
          await updateFileList();
        }
      }
    }

  } catch (error) {
    console.error('Pipeline vectorization main flow error:', error);
    toastr.error('向量化处理中发生严重错误，请检查控制台。');

    // Ensure UI state reset
    isVectorizing = false;
    vectorizationAbortController = null;
    $('#vectors_enhanced_vectorize').show();
    $('#vectors_enhanced_abort').hide();

    // 清除文件选择状态，避免中断后再次向量化时使用旧的文件选择
    if (settings.selected_content.files && settings.selected_content.files.selected) {
      console.log('Vectors: Clearing file selection after vectorization error');
      settings.selected_content.files.selected = [];
      Object.assign(extension_settings.vectors_enhanced, settings);
      saveSettingsDebounced();

      // 立即更新UI以反映清理后的状态
      if (typeof updateFileList === 'function') {
        await updateFileList();
      }
    }

    if (globalProgressManager) {
      globalProgressManager.error('严重错误');
    } else {
      hideProgressNew();
    }

    return {
      success: false,
      error: error.message
    };
  }
}


/**
 * Actively cleanup invalid selections before processing
 */
async function cleanupInvalidSelections() {
  console.debug('Vectors: Starting active cleanup of invalid selections');

  let hasChanges = false;

  // Cleanup world info selections
  if (settings.selected_content.world_info.enabled) {
    const entries = await getSortedEntries();
    const allValidUids = new Set();
    const currentValidWorlds = new Set();

    entries.forEach(entry => {
      // Only include entries that are not disabled and have content
      if (entry.world && entry.content && !entry.disable) {
        allValidUids.add(entry.uid);
        currentValidWorlds.add(entry.world);
      }
    });

    console.debug('Vectors: Valid world info UIDs:', Array.from(allValidUids));
    console.debug('Vectors: Current valid worlds:', Array.from(currentValidWorlds));

    const originalSelected = JSON.parse(JSON.stringify(settings.selected_content.world_info.selected));
    const originalCount = Object.values(originalSelected).flat().length;

    // Clean each world's selection
    for (const [world, selectedUids] of Object.entries(settings.selected_content.world_info.selected)) {
      // Remove worlds that don't exist in current context
      if (!currentValidWorlds.has(world)) {
        console.debug(`Vectors: Removing world "${world}" - not available in current context`);
        delete settings.selected_content.world_info.selected[world];
        hasChanges = true;
        continue;
      }

      const validUids = selectedUids.filter(uid => {
        const isValid = allValidUids.has(uid);
        if (!isValid) {
          console.debug(`Vectors: Removing invalid world info UID: ${uid} from world ${world}`);
        }
        return isValid;
      });

      if (validUids.length !== selectedUids.length) {
        hasChanges = true;
        if (validUids.length === 0) {
          delete settings.selected_content.world_info.selected[world];
          console.debug(`Vectors: Removed empty world: ${world}`);
        } else {
          settings.selected_content.world_info.selected[world] = validUids;
        }
      }
    }

    const newCount = Object.values(settings.selected_content.world_info.selected).flat().length;
    const removedCount = originalCount - newCount;

    if (removedCount > 0) {
      console.debug(`Vectors: Cleaned up ${removedCount} invalid world info selections:`, {
        original: originalSelected,
        cleaned: settings.selected_content.world_info.selected,
        originalCount,
        newCount
      });
      hasChanges = true;
    }
  }

  // TODO: Add file cleanup here if needed

  if (hasChanges) {
    Object.assign(extension_settings.vectors_enhanced, settings);
    saveSettingsDebounced();
    console.debug('Vectors: Active cleanup completed with changes');
  } else {
    console.debug('Vectors: Active cleanup completed - no changes needed');
  }
}

/**
 * Gets a set of unique identifiers for all items already processed in enabled tasks.
 * @param {string} chatId Chat ID
 * @returns {{chat: Set<number>, file: Set<string>, world_info: Set<string>}}
 */
function getProcessedItemIdentifiers(chatId) {
    const identifiers = {
        chat: new Set(),
        file: new Set(),
        world_info: new Set(),
        world_info_with_world: new Map() // 新增：存储 uid -> world 的映射
    };
    const enabledTasks = getChatTasks(chatId).filter(t => t.enabled);

    for (const task of enabledTasks) {
        // Use actualProcessedItems if available (new tasks)
        if (task.actualProcessedItems) {
            // New tasks with actual processed items tracking
            if (task.actualProcessedItems.chat) {
                task.actualProcessedItems.chat.forEach(index => identifiers.chat.add(index));
            }
            if (task.actualProcessedItems.files) {
                task.actualProcessedItems.files.forEach(url => identifiers.file.add(url));
            }
            if (task.actualProcessedItems.world_info) {
                task.actualProcessedItems.world_info.forEach(item => {
                    // Handle both old format (string uid) and new format (object with uid)
                    if (typeof item === 'string') {
                        identifiers.world_info.add(item);
                        // 旧格式没有世界书名字信息
                    } else if (item.uid !== undefined && item.uid !== null) {
                        // 统一转换为字符串以确保类型一致
                        const uidStr = String(item.uid);
                        identifiers.world_info.add(uidStr);
                        // 新格式：记录 uid 对应的世界书名字
                        if (item.world) {
                            identifiers.world_info_with_world.set(uidStr, item.world);
                        }
                    }
                });
            }
        } else {
            // 外挂任务没有settings，跳过
            if (task.type === 'external') {
                continue;
            }

            // Legacy tasks without actualProcessedItems - fallback to settings ranges
            const taskSettings = task.settings;
            if (taskSettings && taskSettings.chat && taskSettings.chat.enabled) {
                const start = taskSettings.chat.range.start;
                const end = taskSettings.chat.range.end === -1
                    ? getContext().chat.length - 1
                    : taskSettings.chat.range.end;
                for (let i = start; i <= end; i++) {
                    identifiers.chat.add(i);
                }
            }
            if (taskSettings && taskSettings.files && taskSettings.files.enabled) {
                taskSettings.files.selected.forEach(url => identifiers.file.add(url));
            }
            if (taskSettings && taskSettings.world_info && taskSettings.world_info.enabled) {
                Object.values(taskSettings.world_info.selected).flat().forEach(uid => identifiers.world_info.add(uid));
            }
        }
    }
    return identifiers;
}

/**
 * Formats an array of chat items into a human-readable range string.
 * e.g., [0, 1, 5, 6, 7, 10] becomes "#0-#1, #5-#7, #10"
 * @param {Array<object>} chatItems - Array of chat items, each with metadata.index
 * @returns {string} A formatted string representing the ranges.
 */
function formatRanges(chatItems) {
    if (!chatItems || chatItems.length === 0) {
        return '没有新的聊天记录';
    }

    const indices = chatItems.map(item => item.metadata.index).sort((a, b) => a - b);

    const ranges = [];
    let start = indices[0];
    let end = indices[0];

    for (let i = 1; i < indices.length; i++) {
        if (indices[i] === end + 1) {
            end = indices[i];
        } else {
            ranges.push(start === end ? `#${start}` : `#${start}-${end}`);
            start = end = indices[i];
        }
    }
    ranges.push(start === end ? `#${start}` : `#${start}-${end}`);

    return `楼层 ${ranges.join('、')}`;
}

/**
 * 格式化消息项的楼层范围（用于向量化弹窗）
 * 例如：[5, 6, 7, 10] 变成 "5-7层、10层"
 * @param {Array<object>} messageItems - 消息项数组，每个项包含 metadata.index
 * @returns {string} 格式化的楼层范围字符串
 */
function formatMessageRanges(messageItems) {
    if (!messageItems || messageItems.length === 0) {
        return '无';
    }

    const indices = messageItems.map(item => item.metadata.index).sort((a, b) => a - b);
    const ranges = [];
    let start = indices[0];
    let end = indices[0];

    for (let i = 1; i < indices.length; i++) {
        if (indices[i] === end + 1) {
            end = indices[i];
        } else {
            ranges.push(start === end ? `${start}层` : `${start}-${end}层`);
            start = end = indices[i];
        }
    }
    ranges.push(start === end ? `${start}层` : `${start}-${end}层`);

    return ranges.join('、');
}

/**
 * Disables all entries in a world info book
 * @param {string} worldName - Name of the world info book
 * @param {Array} entries - Array of world info entries to disable
 * @returns {Promise<void>}
 */
async function disableWorldInfoEntries(worldName, entries) {
    try {
        console.log('[Vectors] 开始禁用世界书条目:', worldName);

        // 加载世界书数据
        const worldData = await loadWorldInfo(worldName);
        if (!worldData || !worldData.entries) {
            console.error('[Vectors] 无法加载世界书数据:', worldName);
            return;
        }

        let disabledCount = 0;

        // 禁用所有条目
        for (const entry of entries) {
            if (worldData.entries[entry.uid]) {
                worldData.entries[entry.uid].disable = true;
                disabledCount++;
                console.log(`[Vectors] 禁用条目 UID: ${entry.uid}, comment: ${entry.comment}`);
            }
        }

        if (disabledCount > 0) {
            // 使用立即保存模式确保数据被写入
            await saveWorldInfo(worldName, worldData, true);
            console.log(`[Vectors] 成功禁用 ${disabledCount} 个世界书条目`);
            toastr.success(`已禁用 ${disabledCount} 个世界书条目`, '世界书更新');
        } else {
            console.log('[Vectors] 没有需要禁用的条目');
        }
    } catch (error) {
        console.error('[Vectors] 禁用世界书条目失败:', error);
        toastr.error('禁用世界书条目失败: ' + error.message);
    }
}

/**
 * Vectorizes selected content
 * @returns {Promise<void>}
 */
async function vectorizeContent() {
    if (isVectorizing) {
        toastr.warning('已有向量化任务在进行中');
        return;
    }
    const chatId = getCurrentChatId();
    if (!chatId || chatId === 'null' || chatId === 'undefined') {
        toastr.error('未选择聊天');
        return;
    }

    await cleanupInvalidSelections();

    // 1. Get initial items based on UI selection
    const initialItems = await getVectorizableContent();

    // 2. Filter out empty items to get "valid" items
    const validItems = initialItems.filter(item => item.text && item.text.trim() !== '');
    if (validItems.length === 0) {
        toastr.warning('未选择要向量化的内容或过滤后内容为空');
        return;
    }

    // 3. Get identifiers of already processed items
    const processedIdentifiers = getProcessedItemIdentifiers(chatId);

    // 4. Filter valid items to get only "new" items
    const newItems = validItems.filter(item => {
        switch (item.type) {
            case 'chat': return !processedIdentifiers.chat.has(item.metadata.index);
            case 'file': return !processedIdentifiers.file.has(item.metadata.url);
            case 'world_info': {
                // 对于世界书，需要同时检查 UID 和世界书名字
                // 统一转换为字符串以确保类型一致
                const uidStr = String(item.metadata.uid);
                if (!processedIdentifiers.world_info.has(uidStr)) {
                    // UID 未被处理过，这是新项目
                    return true;
                }
                // UID 已存在，检查是否来自同一个世界书
                const processedWorld = processedIdentifiers.world_info_with_world.get(uidStr);
                if (!processedWorld) {
                    // 旧格式任务，没有世界书信息，保守起见认为是重复的
                    return false;
                }
                // 如果世界书名字不同，则认为是新项目（不同世界书的相同 UID）
                return processedWorld !== item.metadata.world;
            }
            default: return true;
        }
    });

    // 5. Determine interaction flow based on what was filtered
    const hasEmptyItems = validItems.length < initialItems.length;
    const hasProcessedItems = newItems.length < validItems.length;

    let itemsToProcess = newItems;
    let isIncremental = hasProcessedItems; // Any task with pre-existing items is considered incremental

    if (newItems.length === 0) {
        // Case: All selected items have already been processed.
        const processedChatItems = validItems.filter(i => i.type === 'chat' && processedIdentifiers.chat.has(i.metadata.index));
        const processedFileItems = validItems.filter(i => i.type === 'file' && processedIdentifiers.file.has(i.metadata.url));
        const processedWorldInfoItems = validItems.filter(i => i.type === 'world_info' && processedIdentifiers.world_info.has(i.metadata.uid));

        const processedParts = [];
        if (processedChatItems.length > 0) processedParts.push(`聊天记录: ${formatRanges(processedChatItems)}`);
        if (processedFileItems.length > 0) processedParts.push(`文件: ${processedFileItems.length}个`);
        if (processedWorldInfoItems.length > 0) {
            // Group world info by world name
            const worldGroups = {};
            processedWorldInfoItems.forEach(item => {
                const worldName = item.metadata.world || '未知';
                if (!worldGroups[worldName]) worldGroups[worldName] = [];
                worldGroups[worldName].push(item.metadata.comment || item.metadata.uid);
            });

            const worldDetails = Object.entries(worldGroups).map(([world, entries]) =>
                `${world} (${entries.length}条)`
            ).join(', ');

            processedParts.push(`世界信息: ${worldDetails}`);
        }

        const confirm = await callGenericPopup(
            `<div>
                <p>所有选定内容均已被向量化：</p>
                <ul style="text-align: left; margin: 10px 0;">
                    ${processedParts.map(part => `<li>${part}</li>`).join('')}
                </ul>
                <p>是否要强制重新向量化这些内容？</p>
            </div>`,
            POPUP_TYPE.CONFIRM,
            { okButton: '是', cancelButton: '否' }
        );

        if (confirm !== POPUP_RESULT.AFFIRMATIVE) {
            return; // User chose 'No' or cancelled
        }

        // User chose 'Yes', force re-vectorization of all valid items
        itemsToProcess = validItems;
        isIncremental = false;
    }
    else if (hasProcessedItems && newItems.length > 0) {
        // Case: Partial overlap. Some items are new, some are already processed.
        const newChatItems = newItems.filter(i => i.type === 'chat');
        const newFileItems = newItems.filter(i => i.type === 'file');
        const newWorldInfoItems = newItems.filter(i => i.type === 'world_info');

        const processedChatItems = validItems.filter(i => i.type === 'chat' && processedIdentifiers.chat.has(i.metadata.index));
        const processedFileItems = validItems.filter(i => i.type === 'file' && processedIdentifiers.file.has(i.metadata.url));
        const processedWorldInfoItems = validItems.filter(i => i.type === 'world_info' && processedIdentifiers.world_info.has(i.metadata.uid));

        const newParts = [];
        const processedParts = [];

        if (newChatItems.length > 0) newParts.push(`新增聊天: ${formatRanges(newChatItems)}`);
        if (newFileItems.length > 0) newParts.push(`新增文件: ${newFileItems.length}个`);
        if (newWorldInfoItems.length > 0) {
            // Group new world info by world name
            const newWorldGroups = {};
            newWorldInfoItems.forEach(item => {
                const worldName = item.metadata.world || '未知';
                if (!newWorldGroups[worldName]) newWorldGroups[worldName] = [];
                newWorldGroups[worldName].push(item.metadata.comment || item.metadata.uid);
            });

            const newWorldDetails = Object.entries(newWorldGroups).map(([world, entries]) =>
                `${world} (${entries.length}条)`
            ).join(', ');

            newParts.push(`新增世界信息: ${newWorldDetails}`);
        }

        if (processedChatItems.length > 0) processedParts.push(`已处理聊天: ${formatRanges(processedChatItems)}`);
        if (processedFileItems.length > 0) processedParts.push(`已处理文件: ${processedFileItems.length}个`);
        if (processedWorldInfoItems.length > 0) {
            // Group processed world info by world name
            const processedWorldGroups = {};
            processedWorldInfoItems.forEach(item => {
                const worldName = item.metadata.world || '未知';
                if (!processedWorldGroups[worldName]) processedWorldGroups[worldName] = [];
                processedWorldGroups[worldName].push(item.metadata.comment || item.metadata.uid);
            });

            const processedWorldDetails = Object.entries(processedWorldGroups).map(([world, entries]) =>
                `${world} (${entries.length}条)`
            ).join(', ');

            processedParts.push(`已处理世界信息: ${processedWorldDetails}`);
        }

        const confirm = await callGenericPopup(
            `<div>
                <p><strong>检测到部分内容已被处理：</strong></p>
                <div style="text-align: left; margin: 10px 0;">
                    <p>已处理：</p>
                    <ul style="margin: 5px 0 15px 20px;">
                        ${processedParts.map(part => `<li>${part}</li>`).join('')}
                    </ul>
                    <p>新增内容：</p>
                    <ul style="margin: 5px 0 10px 20px;">
                        ${newParts.map(part => `<li>${part}</li>`).join('')}
                    </ul>
                </div>
                <p>是否只进行增量向量化（只处理新增内容）？</p>
            </div>`,
            POPUP_TYPE.CONFIRM,
            { okButton: '是', cancelButton: '否' }
        );

        if (confirm !== POPUP_RESULT.AFFIRMATIVE) {
            // User chose 'No' or cancelled
            return;
        }

        // User chose 'Yes', so we proceed with incremental vectorization (the default).
        itemsToProcess = newItems;
        isIncremental = true;
    }
    else if (hasEmptyItems) {
        // 分析有效项目的详细信息
        const validChatItems = validItems.filter(item => item.type === 'chat');
        const validFileItems = validItems.filter(item => item.type === 'file');
        const validWorldInfoItems = validItems.filter(item => item.type === 'world_info');

        // 按消息类型分组聊天项目
        const userMessages = validChatItems.filter(item => item.metadata.is_user === true);
        const aiMessages = validChatItems.filter(item => item.metadata.is_user === false);

        // 格式化楼层信息
        let detailParts = [];

        if (userMessages.length > 0) {
            const userRanges = formatMessageRanges(userMessages);
            detailParts.push(`用户消息（${userRanges}）`);
        }

        if (aiMessages.length > 0) {
            const aiRanges = formatMessageRanges(aiMessages);
            detailParts.push(`AI消息（${aiRanges}）`);
        }

        if (validFileItems.length > 0) {
            detailParts.push(`${validFileItems.length}个文件`);
        }

        if (validWorldInfoItems.length > 0) {
            detailParts.push(`${validWorldInfoItems.length}条世界信息`);
        }

        const detailText = detailParts.length > 0 ? `\n\n包含：${detailParts.join('、')}` : '';

        const confirm = await callGenericPopup(
            `您选择了 ${initialItems.length} 个项目，但只有 ${validItems.length} 个包含有效内容。${detailText}\n\n是否继续处理这 ${validItems.length} 个项目？`,
            POPUP_TYPE.CONFIRM,
            { okButton: '继续', cancelButton: '取消' }
        );
        if (confirm !== POPUP_RESULT.AFFIRMATIVE) return;
        // In this case, we process ALL valid items, not just new ones (as there are no "processed" items)
        itemsToProcess = validItems;
        isIncremental = false; // This is a new task, not an incremental addition
    }

    // 6. Perform vectorization with the final, clean set of items
    console.log('Vectors: Using pipeline implementation for vectorization');
    await performVectorization(JSON.parse(JSON.stringify(settings.selected_content)), chatId, isIncremental, itemsToProcess);
}

/**
 * Exports vectorized content
 * @returns {Promise<void>}
 */
async function exportVectors() {
  const context = getContext();
  const chatId = getCurrentChatId();

  if (!chatId || chatId === 'null' || chatId === 'undefined') {
    toastr.error('未选择聊天');
    return;
  }

  let items = await getVectorizableContent();
  // Filter out empty items for consistency with vectorization process
  items = items.filter(item => item.text && item.text.trim() !== '');

  if (items.length === 0) {
    toastr.warning('未选择要导出的内容或过滤后内容为空');
    return;
  }

  // Build export content
  let exportText = `角色卡：${context.name || '未知'}\n`;
  exportText += `时间：${new Date().toLocaleString('zh-CN')}\n\n`;

  // Group items by type
  const grouped = items.reduce((acc, item) => {
    if (!acc[item.type]) acc[item.type] = [];
    acc[item.type].push(item);
    return acc;
  }, {});

  // Files
  exportText += '=== 数据库文件 ===\n';
  if (grouped.file && grouped.file.length > 0) {
    grouped.file.forEach(item => {
      exportText += `文件名：${item.metadata.name}\n`;
      exportText += `内容：\n${item.text}\n\n`;
    });
  } else {
    exportText += '无\n\n';
  }

  // World Info
  exportText += '=== 世界书 ===\n';
  if (grouped.world_info && grouped.world_info.length > 0) {
    grouped.world_info.forEach(item => {
      exportText += `世界：${item.metadata.world}\n`;
      exportText += `注释：${item.metadata.comment || '无'}\n`;
      exportText += `内容：${item.text}\n\n`;
    });
  } else {
    exportText += '无\n\n';
  }

  // Chat messages
  exportText += '=== 聊天记录 ===\n';
  if (grouped.chat && grouped.chat.length > 0) {
    grouped.chat.forEach(item => {
      exportText += `#${item.metadata.index}：${item.text}\n\n`;
    });
  } else {
    exportText += '无\n\n';
  }

  // Create and download file
  const filename = `向量导出_${context.name || chatId}_${Date.now()}.txt`;
  triggerDownload(exportText, filename);

  toastr.success('导出成功');
}

/**
 * Previews vectorizable content
 * @returns {Promise<void>}
 */

/**
 * Cache object for storing hash values
 * @type {Map<string, number>}
 */
const hashCache = new Map();

/**
 * Gets the hash value for a given string
 * @param {string} str Input string
 * @returns {number} Hash value
 */
function getHashValue(str) {
  if (hashCache.has(str)) {
    return hashCache.get(str);
  }
  const hash = getStringHash(str);
  hashCache.set(str, hash);
  return hash;
}

/**
 * Decode metadata from encoded text
 * @param {string} encodedText - Text with metadata prefix
 * @returns {{text: string, metadata: {type?: string, originalIndex?: number, floor?: number, entry?: string, tag?: string, chunk?: string}}}
 */
function decodeMetadataFromText(encodedText) {
  if (!encodedText) {
    return { text: encodedText, metadata: {} };
  }

  const metaMatch = encodedText.match(/^\[META:([^\]]+)\]/);
  if (!metaMatch) {
    return { text: encodedText, metadata: {} };
  }

  const metaString = metaMatch[1];
  const text = encodedText.substring(metaMatch[0].length);
  const metadata = {};

  // Parse metadata key-value pairs
  const pairs = metaString.split(',');
  for (const pair of pairs) {
    const [key, value] = pair.split('=');
    if (key && value) {
      if (key === 'originalIndex' || key === 'floor' || key === 'chapter') {
        metadata[key] = parseInt(value, 10);
      } else {
        metadata[key] = value;
      }
    }
  }

  return { text, metadata };
}

/**
 * Synchronizes chat vectors
 * @param {number} batchSize Batch size for processing
 * @returns {Promise<number>} Number of remaining items
 */
async function synchronizeChat(batchSize = 5) {
  // 检查主开关是否启用
  if (!settings.master_enabled) {
    return -1;
  }


  try {
    await waitUntilCondition(() => !syncBlocked && !is_send_press, 1000);
  } catch {
    console.log('Vectors: Synchronization blocked by another process');
    return -1;
  }

  try {
    syncBlocked = true;
    // Auto-vectorization logic will be implemented based on settings
    return -1;
  } finally {
    syncBlocked = false;
  }
}

/**
 * Retrieves vectorized content for injection
 * @param {object[]} chat Chat messages
 * @param {number} contextSize Context size
 * @param {function} abort Abort function
 * @param {string} type Generation type
 */
async function rearrangeChat(chat, contextSize, abort, type) {
  // 开始计时 - 记录查询开始时间
  const queryStartTime = performance.now();

  // 辅助函数：记录耗时并返回
  const logTimingAndReturn = (reason = '', isError = false) => {
    const queryEndTime = performance.now();
    const totalDuration = queryEndTime - queryStartTime;
    if (reason) {
      const status = isError ? '失败' : '跳过';
      console.log(`🔍 Vectors Enhanced: 查询${status} (${reason}) - 耗时: ${totalDuration.toFixed(2)}ms`);
    }
  };

  try {
    if (type === 'quiet') {
      console.debug('Vectors: Skipping quiet prompt');
      // quiet 模式不需要计时
      return;
    }

    setExtensionPrompt(
      EXTENSION_PROMPT_TAG,
      '',
      settings.position,
      settings.depth,
      settings.include_wi,
      settings.depth_role,
    );

    // 检查主开关是否启用
    if (!settings.master_enabled) {
      console.debug('Vectors: Master switch disabled, skipping all functionality');
      logTimingAndReturn('主开关已禁用');
      return;
    }

    // 检查是否启用向量查询
    if (!settings.enabled) {
      console.debug('Vectors: Query disabled by user');
      logTimingAndReturn('向量查询已禁用');
      return;
    }

    const chatId = getCurrentChatId();
    if (!chatId || chatId === 'null' || chatId === 'undefined') {
      console.debug('Vectors: No chat ID available');
      logTimingAndReturn('无聊天ID');
      return;
    }

    // Query vectors based on recent messages
    const queryMessages = Math.min(settings.query_messages || 3, chat.length);
    let queryText = chat
      .slice(-queryMessages)
      .map(x => x.mes)
      .join('\n');
    if (!queryText.trim()) {
      logTimingAndReturn('查询文本为空');
      return;
    }

    // 实验性功能：添加查询指令
    if (settings.query_instruction_enabled && settings.query_instruction_template) {
      queryText = `Instruct: ${settings.query_instruction_template}\nQuery:${queryText}`;
      console.debug('Vectors: Using instruction-enhanced query');
    }

    // Get all enabled tasks for this chat
    const allTasks = getChatTasks(chatId);
    const tasks = allTasks.filter(t => t.enabled);

    console.debug(`Vectors: Chat ${chatId} has ${allTasks.length} total tasks, ${tasks.length} enabled`);
    allTasks.forEach(task => {
      console.debug(`Vectors: Task "${task.name}" (${task.taskId}) - enabled: ${task.enabled}`);
    });

    if (tasks.length === 0) {
      console.debug('Vectors: No enabled tasks for this chat');
      logTimingAndReturn('无启用的任务');
      return;
    }

    // Query all enabled tasks
    let allResults = [];
    // 为了确保能从所有任务中获得最相关的结果，每个任务查询稍多一些
    const perTaskLimit = Math.max(Math.ceil((settings.max_results || 10) * 1.5), 20);

    for (const task of tasks) {
      // 支持外挂任务：如果任务有 type 和 source 字段，使用源集合ID
      let collectionId;
      if (task.type === 'external' && task.source) {
        collectionId = task.source;
        console.debug(`Vectors: Querying external task "${task.name}" using source collection "${collectionId}"`);
      } else {
        collectionId = `${chatId}_${task.taskId}`;
        console.debug(`Vectors: Querying collection "${collectionId}" for task "${task.name}"`);
      }

      try {
        const results = await storageAdapter.queryCollection(collectionId, queryText, perTaskLimit, settings.score_threshold);
        console.debug(`Vectors: Query results for task ${task.name}:`, results);
        console.debug(`Vectors: Result structure - has items: ${!!results?.items}, has hashes: ${!!results?.hashes}, has distances: ${!!results?.distances}, has similarities: ${!!results?.similarities}`);

        // 根据API返回的结构处理结果
        if (results) {
          // 优先使用 metadata 中的文本（向量数据库应该包含）
          if (results.metadata && Array.isArray(results.metadata)) {
            console.debug(`Vectors: Using text from metadata for ${collectionId}`);
            // 添加调试日志查看metadata结构
            if (results.metadata.length > 0) {
              console.debug(`Vectors: First metadata item structure:`, {
                hasText: !!results.metadata[0].text,
                hasType: !!results.metadata[0].type,
                hasScore: !!results.metadata[0].score,
                keys: Object.keys(results.metadata[0])
              });
              // 打印完整的第一个结果以查看分数在哪里
              console.debug(`Vectors: First result full data:`, results.metadata[0]);
              if (results.distances) {
                console.debug(`Vectors: Distances array:`, results.distances.slice(0, 3));
              }
              if (results.similarities) {
                console.debug(`Vectors: Similarities array:`, results.similarities.slice(0, 3));
              }
            }
            results.metadata.forEach((meta, index) => {
              if (meta.text) {
                // 尝试从多个可能的位置获取分数
                let score = 0;
                if (meta.score !== undefined) {
                  score = meta.score;
                } else if (results.distances && results.distances[index] !== undefined) {
                  // 距离越小越相似，转换为相似度分数
                  score = 1 / (1 + results.distances[index]);
                } else if (results.similarities && results.similarities[index] !== undefined) {
                  score = results.similarities[index];
                }

                allResults.push({
                  text: meta.text,
                  score: score,
                  metadata: {
                    ...meta,
                    taskName: task.name,
                    taskId: task.taskId,
                    // Include decoded metadata if available
                    type: meta.decodedType || meta.type,
                    originalIndex: meta.decodedOriginalIndex !== undefined ? meta.decodedOriginalIndex : meta.originalIndex
                  },
                });
              } else {
                console.warn(`Vectors: Missing text in metadata for item ${index} in ${collectionId}`);
              }
            });
          }
          // 兼容旧版本：如果API返回了items数组（包含text）
          else if (results.items && Array.isArray(results.items)) {
            console.debug(`Vectors: Using items format for ${collectionId}`);
            results.items.forEach((item, index) => {
              if (item.text) {
                // 尝试从多个可能的位置获取分数
                let score = 0;
                if (item.score !== undefined) {
                  score = item.score;
                } else if (results.distances && results.distances[index] !== undefined) {
                  // 距离越小越相似，转换为相似度分数
                  score = 1 / (1 + results.distances[index]);
                } else if (results.similarities && results.similarities[index] !== undefined) {
                  score = results.similarities[index];
                }

                allResults.push({
                  text: item.text,
                  score: score,
                  metadata: {
                    ...item.metadata,
                    taskName: task.name,
                    taskId: task.taskId,
                    // Include decoded metadata if available
                    type: item.metadata?.decodedType || item.metadata?.type,
                    originalIndex: item.metadata?.decodedOriginalIndex !== undefined ? item.metadata?.decodedOriginalIndex : item.metadata?.originalIndex
                  },
                });
              }
            });
          }
          // 向后兼容：只有在上述方法都失败时，才尝试从任务中获取
          else if (results.hashes && task.textContent && Array.isArray(task.textContent)) {
            console.debug(`Vectors: Fallback to task textContent for ${collectionId} (legacy support)`);
            results.hashes.forEach((hash, index) => {
              const textItem = task.textContent.find(item => item.hash === hash);
              if (textItem && textItem.text) {
                allResults.push({
                  text: textItem.text,
                  score: results.metadata?.[index]?.score || 0,
                  metadata: {
                    ...textItem.metadata,
                    ...(results.metadata?.[index] || {}),
                    taskName: task.name,
                    taskId: task.taskId,
                  },
                });
              }
            });
          }
          // 如果所有方法都失败了，记录错误
          else {
            console.error(`Vectors: Unable to retrieve text content for ${collectionId}. Results structure:`, {
              hasMetadata: !!results.metadata,
              hasItems: !!results.items,
              hasHashes: !!results.hashes,
              hasTextContent: !!task.textContent
            });
          }
        }
      } catch (error) {
        console.error(`Vectors: Failed to query task ${task.name}:`, error);
      }
    }

    // 保存原始查询结果数量（用于通知显示）
    const originalQueryCount = allResults.length;

    // 保存重排前的结果（深拷贝）
    const resultsBeforeRerank = allResults.map(r => ({
        text: r.text,
        score: r.score,
        metadata: { ...r.metadata }
    }));

    // 在 rerank 之前不要限制结果数量，让 rerank 有更多候选项
    // Use RerankService if available
    let rerankApplied = false;
    if (rerankService && rerankService.isEnabled() && allResults.length > 0) {
        allResults = await rerankService.rerankResults(queryText, allResults);
        rerankApplied = true;
    } else {
        // If reranking is not enabled, sort by original score
        allResults.sort((a, b) => (b.score || 0) - (a.score || 0));
    }

    // 限制结果数量
    if (rerankService && rerankService.isEnabled()) {
      allResults = rerankService.limitResults(allResults, settings.max_results || 10);
    } else {
      // 如果没有启用 rerank，使用 max_results
      const finalLimit = settings.max_results || 10;
      if (allResults.length > finalLimit) {
        console.debug(`Vectors: Limiting final results from ${allResults.length} to ${finalLimit}`);
        allResults = allResults.slice(0, finalLimit);
      }
    }

    // 初始化变量
    let topResults = [];
    let groupedResults = {};
    let insertedText = '';
    let totalChars = 0;

    if (allResults.length === 0) {
      console.debug('Vectors: No query results found');
    } else {
      console.debug(`Vectors: Found ${allResults.length} total results after limiting`);

      // 使用所有限制后的结果
      topResults = allResults;

      console.debug(`Vectors: Using top ${topResults.length} results`);

      // Group results by type
      topResults.forEach(result => {
        const type = result.metadata?.type || 'unknown';
        if (!groupedResults[type]) {
          groupedResults[type] = [];
        }
        groupedResults[type].push(result);
      });

      console.debug(
        'Vectors: Grouped results by type:',
        Object.keys(groupedResults).map(k => `${k}: ${groupedResults[k].length}`),
      );

      // Sort each group by taskId first, then by originalIndex within same task
      Object.keys(groupedResults).forEach(type => {
        groupedResults[type].sort((a, b) => {
          // First, sort by taskId to keep same task content together
          const aTaskId = a.metadata?.taskId || '';
          const bTaskId = b.metadata?.taskId || '';

          if (aTaskId !== bTaskId) {
            // Different tasks - sort by taskId to keep them separate
            return aTaskId.localeCompare(bTaskId);
          }

          // Same task - now sort by originalIndex within the task
          // First try to decode originalIndex from text
          const aDecoded = decodeMetadataFromText(a.text);
          const bDecoded = decodeMetadataFromText(b.text);

          // Get originalIndex from decoded metadata or fallback to metadata.index
          const aIndex = aDecoded.metadata.originalIndex ?? a.metadata?.originalIndex ?? a.metadata?.index ?? 0;
          const bIndex = bDecoded.metadata.originalIndex ?? b.metadata?.originalIndex ?? b.metadata?.index ?? 0;

          // 对于世界书类型的特殊处理
          if (type === 'world_info') {
            // 提取条目标识符和分块信息
            const aEntry = aDecoded.metadata.entry || '';
            const bEntry = bDecoded.metadata.entry || '';

            // 提取分块编号 (从 "chunk=1/3" 格式中提取)
            const aChunkMatch = a.text.match(/chunk=(\d+)\/\d+/);
            const bChunkMatch = b.text.match(/chunk=(\d+)\/\d+/);
            const aChunkNum = aChunkMatch ? parseInt(aChunkMatch[1]) : 0;
            const bChunkNum = bChunkMatch ? parseInt(bChunkMatch[1]) : 0;

            // 如果是同一个条目的不同分块
            if (aEntry === bEntry && aEntry !== '') {
              // 同一条目内按chunk编号升序
              return aChunkNum - bChunkNum;
            } else {
              // 不同条目之间按originalIndex降序
              return bIndex - aIndex;
            }
          } else {
            // 其他类型保持升序
            return aIndex - bIndex;
          }
        });

        console.debug(`Vectors: Sorted ${type} results by taskId and originalIndex`);
      });

      // Format results with tags
      const formattedParts = [];

      // Process world info first
      if (groupedResults.world_info && groupedResults.world_info.length > 0) {
        const wiTexts = groupedResults.world_info
          .map(m => m.text)
          .filter(onlyUnique)
          .join('\n\n');

        const tag = settings.content_tags?.world_info || 'world_part';
        formattedParts.push(`<${tag}>\n${wiTexts}\n</${tag}>`);
      }

      // Process files second
      if (groupedResults.file && groupedResults.file.length > 0) {
        const fileTexts = groupedResults.file
          .map(m => m.text)
          .filter(onlyUnique)
          .join('\n\n');

        const tag = settings.content_tags?.file || 'databank';
        formattedParts.push(`<${tag}>\n${fileTexts}\n</${tag}>`);
      }

      // Process chat messages last
      if (groupedResults.chat && groupedResults.chat.length > 0) {
        const chatTexts = groupedResults.chat
          .map(m => m.text)
          .filter(onlyUnique)
          .join('\n\n');

        const tag = settings.content_tags?.chat || 'past_chat';
        formattedParts.push(`<${tag}>\n${chatTexts}\n</${tag}>`);
      }

      // Process unknown type (fallback for items without type metadata)
      if (groupedResults.unknown && groupedResults.unknown.length > 0) {
        console.debug('Vectors: Processing unknown type results as fallback');
        const unknownTexts = groupedResults.unknown
          .map(m => m.text)
          .filter(onlyUnique)
          .join('\n\n');

        // 使用通用标签或根据任务名称推断
        const tag = 'context'; // 使用通用的context标签
        formattedParts.push(`<${tag}>\n${unknownTexts}\n</${tag}>`);
      }

      // Join all parts
      const relevantTexts = formattedParts.join('\n\n');

      console.debug(`Vectors: Formatted ${formattedParts.length} parts, total length: ${relevantTexts.length}`);

      if (relevantTexts && relevantTexts.trim()) {
        insertedText = substituteParamsExtended(settings.template, { text: relevantTexts });
        console.debug(`Vectors: Final injected text length: ${insertedText.length}`);
        totalChars = insertedText.length;

        // 保存注入的内容和统计信息，供预览功能使用
        lastInjectedContent = insertedText;
        lastInjectedStats = {
          totalChars: totalChars,
          chatCount: groupedResults.chat?.length || 0,
          fileCount: groupedResults.file?.length || 0,
          worldInfoCount: groupedResults.world_info?.length || 0,
          unknownCount: groupedResults.unknown?.length || 0,
          queryInstructionEnabled: settings.query_instruction_enabled,
          rerankEnabled: rerankService && rerankService.isEnabled(),
          deduplicationEnabled: settings.rerank_deduplication_enabled,
          originalQueryCount: originalQueryCount,
          finalCount: topResults.length
        };

        // 收集最终排序后的结果（按照originalIndex排序后）
        const finalSortedResults = [];

        // 按照注入顺序收集结果：world_info -> file -> chat
        if (groupedResults.world_info) {
          finalSortedResults.push(...groupedResults.world_info);
        }
        if (groupedResults.file) {
          finalSortedResults.push(...groupedResults.file);
        }
        if (groupedResults.chat) {
          finalSortedResults.push(...groupedResults.chat);
        }
        if (groupedResults.unknown) {
          finalSortedResults.push(...groupedResults.unknown);
        }

        // 保存详细的查询信息
        lastQueryDetails = {
          queryText: queryText,
          resultsBeforeRerank: resultsBeforeRerank, // 保存所有结果，不限制数量
          resultsAfterRerank: topResults,
          finalSortedResults: finalSortedResults, // 最终按originalIndex排序后的结果
          rerankApplied: rerankApplied
        };

        setExtensionPrompt(
          EXTENSION_PROMPT_TAG,
          insertedText,
          settings.position,
          settings.depth,
          settings.include_wi,
          settings.depth_role,
        );
      } else {
        console.debug('Vectors: No relevant texts found after formatting');
        // 清空之前可能设置的内容
        setExtensionPrompt(EXTENSION_PROMPT_TAG, '', settings.position, settings.depth, settings.include_wi, settings.depth_role);

        // 也清空保存的内容
        lastInjectedContent = null;
        lastInjectedStats = null;
        lastQueryDetails = null;
      }
    }

    // 显示查询结果通知（统一处理，无论是否有结果）
    if (settings.show_query_notification) {
      const currentTime = Date.now();

      // 防重复通知：检查冷却时间
      if (currentTime - lastNotificationTime < NOTIFICATION_COOLDOWN) {
        console.debug('Vectors: Notification skipped due to cooldown');
        logTimingAndReturn('通知冷却中');
        return;
      }

      const finalCount = topResults.length;    // 最终注入的数量

      // 检查是否真的注入了内容
      const actuallyInjected = insertedText && insertedText.trim().length > 0;

      let message;
      const isRerankEnabled = rerankService && rerankService.isEnabled();
      if (isRerankEnabled && finalCount > 0) {
        // 如果启用了重排，显示重排后的数量
        message = `查询到 ${originalQueryCount} 个块，重排后`;
        if (actuallyInjected) {
          message += `注入 ${finalCount} 个块。`;
        } else {
          message += `尝试注入 ${finalCount} 个块，但文本获取失败。`;
        }
      } else {
        // 如果没有启用重排，显示原始查询数量和最终注入数量
        message = `查询到 ${originalQueryCount} 个块`;
        if (finalCount > 0) {
          if (actuallyInjected) {
            // 如果查询数量和注入数量不同，显示两个数字
            if (originalQueryCount > finalCount) {
              message += `，注入 ${finalCount} 个块。`;
            } else {
              message += '，已注入。';
            }
          } else {
            message += '，但文本获取失败，未能注入。';
          }
        } else {
          message += '。';
        }
      }

      // 详细模式：显示来源分布
      if (settings.detailed_notification && finalCount > 0) {
        const sourceStats = {
          chat: groupedResults.chat?.length || 0,
          file: groupedResults.file?.length || 0,
          world_info: groupedResults.world_info?.length || 0,
        };

        if (sourceStats.chat || sourceStats.file || sourceStats.world_info) {
          const sources = [];
          if (sourceStats.chat) sources.push(`聊天记录${sourceStats.chat}条`);
          if (sourceStats.file) sources.push(`文件${sourceStats.file}条`);
          if (sourceStats.world_info) sources.push(`世界信息${sourceStats.world_info}条`);
          message += `\n来源：${sources.join('，')}`;
        }
      }

      const toastType = finalCount > 0 ? 'info' : 'warning';
      toastr[toastType](message, '向量查询结果', { timeOut: 3000 });

      // 更新最后通知时间
      lastNotificationTime = currentTime;
    }

    // 计算总耗时并输出到控制台
    const queryEndTime = performance.now();
    const totalDuration = queryEndTime - queryStartTime;
    const resultCount = allResults.length;
    const injectedCount = topResults.length;
    console.log(`🔍 Vectors Enhanced: 查询到注入完成 - 总耗时: ${totalDuration.toFixed(2)}ms (查询${resultCount}条, 注入${injectedCount}条)`);

  } catch (error) {
    console.error('Vectors: Failed to rearrange chat', error);
    logTimingAndReturn('执行出错', true);
  }
}

window['vectors_rearrangeChat'] = rearrangeChat;

/**
 * Get the last injected content for preview
 * @returns {Object} Last injected content and stats
 */
function getLastInjectedContent() {
  return {
    content: lastInjectedContent,
    stats: lastInjectedStats,
    details: lastQueryDetails
  };
}

window['vectors_getLastInjectedContent'] = getLastInjectedContent;




/**
 * Gets request body for vector operations
 * @param {object} args Additional arguments
 * @returns {object} Request body
 */
function getVectorsRequestBody(args = {}) {
  const body = Object.assign({}, args);

  switch (settings.source) {
    case 'transformers':
      // Local transformers
      if (settings.local_model) {
        body.model = settings.local_model;
      }
      break;
    case 'vllm':
      body.apiUrl = settings.vllm_url || textgenerationwebui_settings.server_urls[textgen_types.VLLM];
      body.model = settings.vllm_model;
      // 优先使用插件设置的API key，如果为空则使用文本生成API的设置
      body.apiKey = settings.vllm_api_key || textgenerationwebui_settings.api_key_vllm || '';
      break;
    case 'ollama':
      body.model = settings.ollama_model;
      body.apiUrl =
        settings.ollama_url ||
        textgenerationwebui_settings.server_urls[textgen_types.OLLAMA] ||
        'http://localhost:11434';
      body.keep = !!settings.ollama_keep;
      break;
  }

  body.source = settings.source;
  return body;
}

/**
 * Throws if the vector source is invalid
 */
function throwIfSourceInvalid() {
  if (settings.source === 'vllm') {
    if (!settings.vllm_url && !textgenerationwebui_settings.server_urls[textgen_types.VLLM]) {
      throw new Error('vLLM URL not configured');
    }
    if (!settings.vllm_model) {
      throw new Error('vLLM model not specified');
    }
  }

  if (settings.source === 'ollama') {
    if (!settings.ollama_url && !textgenerationwebui_settings.server_urls[textgen_types.OLLAMA]) {
      throw new Error('Ollama URL not configured');
    }
    if (!settings.ollama_model) {
      throw new Error('Ollama model not specified');
    }
    // ollama_url 是可选的，因为有默认值 http://localhost:11434
  }
}












// Event handlers
const onChatEvent = debounce(async () => {
  // Update UI lists when chat changes
  await updateFileList();
  updateChatSettings();
  await updateTaskList(getChatTasks, renameVectorTask, removeVectorTask);
}, debounce_timeout.relaxed);

/**
 * Cleans up orphaned external tasks when a source chat is deleted
 * @param {string} deletedChatId - The ID of the deleted chat
 */
async function cleanupOrphanedExternalTasks(deletedChatId) {
  console.log(`Vectors: Cleaning up orphaned external tasks for deleted chat: ${deletedChatId}`);

  // 扫描所有聊天的外挂任务
  for (const [chatId, tasks] of Object.entries(settings.vector_tasks)) {
    if (!tasks || !Array.isArray(tasks)) continue;

    // 查找所有引用了被删除聊天的外挂任务
    let foundOrphaned = false;
    tasks.forEach(task => {
      if (task.type === "external") {
        // 检查是否引用了被删除的聊天
        if (task.sourceChat === deletedChatId || (task.source && task.source.startsWith(`${deletedChatId}_`))) {
          // 标记为孤儿任务
          task.orphaned = true;
          task.enabled = false; // 自动禁用
          foundOrphaned = true;
          console.log(`Vectors: Marked external task "${task.name}" as orphaned in chat ${chatId}`);
        }
      }
    });

    if (foundOrphaned) {
      // 保存更改
      Object.assign(extension_settings.vectors_enhanced, settings);
      saveSettingsDebounced();
    }
  }
}

/**
 * Cleans up invalid chat IDs from vector_tasks
 */
function cleanupInvalidChatIds() {
  if (!settings.vector_tasks) {
    return;
  }

  let hasChanges = false;
  const invalidKeys = [];

  for (const [chatId, tasks] of Object.entries(settings.vector_tasks)) {
    if (!chatId || chatId === 'null' || chatId === 'undefined' || chatId.trim() === '') {
      invalidKeys.push(chatId);
      hasChanges = true;
    }
  }

  if (hasChanges) {
    console.warn('Vectors: Cleaning up invalid chat IDs:', invalidKeys);
    invalidKeys.forEach(key => {
      delete settings.vector_tasks[key];
    });
    console.log('Vectors: Cleaned up invalid chat IDs from vector_tasks');
  }
}

/**
 * Migrates old tag settings to the new structured format.
 * This is a one-time migration that runs if the old `tags` property is found.
 */
function migrateTagSettings() {
  // Check if migration is needed by detecting the presence of the old 'tags' property.
  if (settings.selected_content?.chat?.hasOwnProperty('tags')) {
    console.log('[Vectors] Tag settings migrated to new format.');

    const oldTags = settings.selected_content.chat.tags;
    const newRules = [];

    if (typeof oldTags === 'string' && oldTags.trim()) {
      // Example: "content - thinking" becomes [{type:'include', value:'content'}, {type:'exclude', value:'thinking'}]
      const parts = oldTags.split(' - ');
      const includePart = parts[0].trim();
      const excludePart = parts.length > 1 ? parts[1].trim() : '';

      if (includePart) {
        includePart.split(',').forEach(tag => {
          const trimmedTag = tag.trim();
          if (trimmedTag) {
            newRules.push({ type: 'include', value: trimmedTag, enabled: true });
          }
        });
      }

      if (excludePart) {
        excludePart.split(',').forEach(tag => {
          const trimmedTag = tag.trim();
          if (trimmedTag) {
            newRules.push({ type: 'exclude', value: trimmedTag, enabled: true });
          }
        });
      }
    }

    // Assign the new rules and clean up old properties
    settings.selected_content.chat.tag_rules = newRules;
    delete settings.selected_content.chat.tags;
    settings.tag_rules_version = 2;

    // Settings will be saved later in the initialization process.
  }
}

jQuery(async () => {
  try {
    console.log('Vectors Enhanced: Starting initialization...');

    // 使用独立的设置键避免冲突
    const SETTINGS_KEY = 'vectors_enhanced';

    if (!extension_settings[SETTINGS_KEY]) {
      extension_settings[SETTINGS_KEY] = settings;
    }

    // 深度合并设置，确保所有必需的属性都存在
    deepMerge(settings, extension_settings[SETTINGS_KEY]);

  // 在设置加载后运行迁移
  migrateTagSettings();

  // 清理无效的聊天ID
  cleanupInvalidChatIds();


  // 确保 chat types 存在（处理旧版本兼容性）
  if (!settings.selected_content.chat.types) {
    settings.selected_content.chat.types = { user: true, assistant: true };
  }

  // 确保 include_hidden 属性存在
  if (settings.selected_content.chat.include_hidden === undefined) {
    settings.selected_content.chat.include_hidden = false;
  }

  // 确保rerank成功通知设置存在
  if (settings.rerank_success_notify === undefined) {
    settings.rerank_success_notify = true;
  }

  // 确保实验性功能设置存在
  if (settings.query_instruction_enabled === undefined) {
    settings.query_instruction_enabled = false;
  }
  if (settings.query_instruction_template === undefined) {
    settings.query_instruction_template = 'Given a query, retrieve relevant passages from the context. Consider all available metadata including floor (chronological position), world info entries, and chapter/section markers to ensure comprehensive retrieval.';
  }
  if (settings.query_instruction_preset === undefined) {
    settings.query_instruction_preset = 'general';
  }
  if (settings.query_instruction_presets === undefined) {
    settings.query_instruction_presets = {
      character: 'Given a character-related query, retrieve passages that describe character traits, personality, relationships, or actions. Consider metadata such as floor (chronological position), world info entries, and chapter markers when evaluating relevance.',
      plot: 'Given a story context, retrieve passages that contain plot-relevant details, foreshadowing, or significant events. Pay attention to metadata including floor numbers (temporal ordering), chapter divisions, and world book entries for contextual relevance.',
      worldview: 'Given a world-building query, retrieve passages that contain setting details, lore information, or world mechanics. Utilize metadata like world info entry names, chapter context, and chronological floor positions to identify relevant content.',
      writing_style: 'Given a writing style query, retrieve passages that exemplify narrative techniques, prose style, or linguistic patterns. Consider metadata such as chapter markers and floor positions to understand stylistic evolution throughout the narrative.',
      general: 'Given a query, retrieve relevant passages from the context. Consider all available metadata including floor (chronological position), world info entries, and chapter/section markers to ensure comprehensive retrieval.'
    };
  }
  if (settings.rerank_deduplication_enabled === undefined) {
    settings.rerank_deduplication_enabled = false;
  }
  if (settings.rerank_deduplication_instruction === undefined) {
    settings.rerank_deduplication_instruction = 'Execute the following operations:\n1. Sort documents by relevance in descending order\n2. Consider documents as duplicates if they meet ANY of these conditions:\n   - Core content overlap exceeds 60% (reduced from 80% for better precision)\n   - Contains identical continuous passages of 5+ words\n   - Shares the same examples, data points, or evidence\n3. When evaluating duplication, consider metadata differences:\n   - Different originalIndex values indicate temporal separation\n   - Different chunk numbers (chunk=X/Y) from the same entry should be preserved\n   - Different floor numbers represent different chronological positions\n   - Different world info entries or chapter markers indicate distinct contexts\n4. For identified duplicates, keep only the most relevant one, demote others to bottom 30% positions (reduced from 50% for gentler deduplication)';
  }

  // 迁移模板预设数据结构
  if (settings.template_presets) {
    // 确保有3个默认的自定义模板
    if (!settings.template_presets.custom || settings.template_presets.custom.length === 0) {
      settings.template_presets.custom = [
        {
          id: 'custom1',
          name: '自定义模板1',
          template: '',
          description: '用户自定义模板'
        },
        {
          id: 'custom2',
          name: '自定义模板2',
          template: '',
          description: '用户自定义模板'
        },
        {
          id: 'custom3',
          name: '自定义模板3',
          template: '',
          description: '用户自定义模板'
        }
      ];
    } else if (settings.template_presets.custom.length > 0) {
      // 如果用户有旧的自定义预设，保留前3个并确保ID正确
      const existingCustom = settings.template_presets.custom.slice(0, 3);
      const newCustom = [
        existingCustom[0] || { id: 'custom1', name: '自定义模板1', template: '', description: '用户自定义模板' },
        existingCustom[1] || { id: 'custom2', name: '自定义模板2', template: '', description: '用户自定义模板' },
        existingCustom[2] || { id: 'custom3', name: '自定义模板3', template: '', description: '用户自定义模板' }
      ];

      // 确保ID正确
      newCustom[0].id = 'custom1';
      newCustom[1].id = 'custom2';
      newCustom[2].id = 'custom3';

      settings.template_presets.custom = newCustom;
    }
  }

   // 确保所有必需的结构都存在
  if (!settings.selected_content.chat.range) {
    settings.selected_content.chat.range = { start: 0, end: -1 };
  }

  // 确保 vector_tasks 存在
  if (!settings.vector_tasks) {
    settings.vector_tasks = {};
  }

  // 确保 vllm_api_key 存在
  if (settings.vllm_api_key === undefined) {
    settings.vllm_api_key = '';
  }

  // 保存修正后的设置 - 使用深度合并而不是浅拷贝
  deepMerge(extension_settings[SETTINGS_KEY], settings);
  saveSettingsDebounced();

  // 创建 SettingsPanel 实例
  console.log('Vectors Enhanced: Creating SettingsPanel...');
  const settingsPanel = new SettingsPanel({
    renderExtensionTemplateAsync,
    targetSelector: '#extensions_settings2'
  });

  // 初始化 SettingsPanel
  console.log('Vectors Enhanced: Initializing SettingsPanel...');
  await settingsPanel.init();

  // 设置全局SettingsPanel引用
  globalSettingsPanel = settingsPanel;

  // 创建 ConfigManager 实例
  console.log('Vectors Enhanced: Creating ConfigManager...');
  const configManager = new ConfigManager(extension_settings, saveSettingsDebounced);

  // 创建并初始化设置子组件
  console.log('Vectors Enhanced: Creating settings sub-components...');

  const vectorizationSettings = new VectorizationSettings({
    settings,
    configManager,
    onSettingsChange: (field, value) => {
      console.debug(`VectorizationSettings: ${field} changed to:`, value);
      Object.assign(extension_settings.vectors_enhanced, settings);
      saveSettingsDebounced();
    }
  });

  const querySettings = new QuerySettings({
    settings,
    configManager,
    toastr,
    callGenericPopup,
    POPUP_TYPE,
    rearrangeChat,
    getContext,
    getCurrentChatId,
    onSettingsChange: (field, value) => {
      console.debug(`QuerySettings: ${field} changed to:`, value);
      Object.assign(extension_settings.vectors_enhanced, settings);
      saveSettingsDebounced();
    }
  });


  const contentSelectionSettings = new ContentSelectionSettings({
    settings,
    configManager,
    onSettingsChange: (field, value) => {
      console.debug(`ContentSelectionSettings: ${field} changed to:`, value);
      Object.assign(extension_settings.vectors_enhanced, settings);
      saveSettingsDebounced();
    },
    // Inject dependency functions
    updateFileList,
    updateWorldInfoList,
    updateChatSettings,
    renderTagRulesUI,
    showTagExamples,
    scanAndSuggestTags: () => {
      if (typeof scanAndSuggestTags === 'function') {
        scanAndSuggestTags();
      }
    },
    clearTagSuggestions,
    toggleMessageRangeVisibility: (show) => {
      // Implementation for message range visibility toggle
      console.log(`Toggling message range visibility: ${show}`);
    }
  });

  // 初始化设置子组件
  console.log('Vectors Enhanced: Initializing settings sub-components...');
  await vectorizationSettings.init();
  await querySettings.init();
  await contentSelectionSettings.init();

  // 将子组件添加到 SettingsPanel
  settingsPanel.addSubComponent('vectorizationSettings', vectorizationSettings);
  settingsPanel.addSubComponent('querySettings', querySettings);
  settingsPanel.addSubComponent('contentSelectionSettings', contentSelectionSettings);

  // 创建 UI Infrastructure 实例
  console.log('Vectors Enhanced: Creating UI Infrastructure...');

  // 创建 StateManager
  const stateManager = new StateManager({
    eventBus,
    settings,
    configManager
  });

  // 创建 ProgressManager
  const progressManager = new ProgressManager({
    eventBus
  });

  // 创建 EventManager
  const eventManager = new EventManager({
    eventBus,
    eventSource,
    event_types,
    progressManager,
    stateManager
  });

  // 初始化 UI Infrastructure
  console.log('Vectors Enhanced: Initializing UI Infrastructure...');
  stateManager.init();
  progressManager.init();
  eventManager.init();

  // 设置全局引用
  globalStateManager = stateManager;
  globalProgressManager = progressManager;
  globalEventManager = eventManager;

  // 创建存储适配器实例
  console.log('Vectors Enhanced: Creating StorageAdapter...');
  storageAdapter = new StorageAdapter({
    getRequestHeaders,
    getVectorsRequestBody,
    throwIfSourceInvalid,
    cachedVectors
  });

  // 创建向量化适配器实例
  console.log('Vectors Enhanced: Creating VectorizationAdapter...');
  vectorizationAdapter = new VectorizationAdapter({
    getRequestHeaders,
    getVectorsRequestBody,
    throwIfSourceInvalid,
    settings,
    textgenerationwebui_settings,
    textgen_types
  });

  // 创建 Rerank 服务实例
  console.log('Vectors Enhanced: Creating RerankService...');
  rerankService = new RerankService(settings, {
    toastr: toastr
  });

  // 暴露到全局以便测试（仅在开发环境）
  if (window.location.hostname === 'localhost' || window.location.search.includes('debug=true')) {
    window.rerankService = rerankService;
  }

  // 创建 SettingsManager 实例
  console.log('Vectors Enhanced: Creating SettingsManager...');
  const settingsManager = new SettingsManager(settings, configManager, {
    extension_settings,
    saveSettingsDebounced,
    updateFileList,
    updateWorldInfoList,
    getChatTasks,
    renameVectorTask,
    removeVectorTask,
    updateTaskList,  // 添加这个函数引用
    toggleMessageRangeVisibility,
    showTagExamples,
    setExtensionPrompt,  // 添加注入API
    substituteParamsExtended,  // 添加模板替换API
    scanAndSuggestTags,
    getContext,
    generateRaw,
    saveChatConditional,  // 添加saveChatConditional
    chat_metadata,  // 添加chat_metadata
    saveChatDebounced,  // 添加saveChatDebounced
    refreshSwipeButtons,  // 添加refreshSwipeButtons
    toastr,
    oai_settings,
    getRequestHeaders,
    eventSource,  // 添加eventSource
    event_types,   // 添加event_types
    callGenericPopup,  // 添加callGenericPopup
    POPUP_TYPE    // 添加POPUP_TYPE
  });

  // TaskManager removed - using legacy format only

  // 添加全局处理函数作为后备
  window.handleExternalTaskImport = async () => {
    console.log('handleExternalTaskImport called');
    if (globalSettingsManager?.externalTaskUI?.showImportDialog) {
      try {
        await globalSettingsManager.externalTaskUI.showImportDialog();
      } catch (error) {
        console.error('Error in showImportDialog:', error);
        if (typeof toastr !== 'undefined') {
          toastr.error('无法打开导入对话框: ' + error.message);
        } else {
          alert('无法打开导入对话框: ' + error.message);
        }
      }
    } else {
      console.error('ExternalTaskUI not initialized');
      if (typeof toastr !== 'undefined') {
        toastr.error('外挂任务UI未初始化，请稍后重试');
      } else {
        alert('外挂任务UI未初始化，请稍后重试');
      }
    }
  };




  // 创建 ActionButtons 实例
  console.log('Vectors Enhanced: Creating ActionButtons...');
  const actionButtons = new ActionButtons({
    settings,
    getVectorizableContent,
    shouldSkipContent,
    extractComplexTag,
    extractHtmlFormatTag,
    extractSimpleTag,
    substituteParams,
    exportVectors,
    vectorizeContent,
    isVectorizing: () => isVectorizing,
    vectorizationAbortController: () => vectorizationAbortController
  });

  // 初始化 ActionButtons
  console.log('Vectors Enhanced: Initializing ActionButtons...');
  actionButtons.init();

  // 设置全局ActionButtons引用
  globalActionButtons = actionButtons;

  // Task system status (legacy mode only)
  window.vectorsTaskSystemStatus = () => {
    const status = {
      taskManagerAvailable: false,
      legacyMode: true,
      storageReady: false,
      systemMode: 'Legacy'
    };
    console.log('Vectors Enhanced Task System Status:', status);
    return status;
  };

  // 初始化所有设置UI
  console.log('Vectors Enhanced: Initializing settings UI...');
  await settingsManager.initialize();
  console.log('Vectors Enhanced: Settings UI initialized');

  // 保存全局引用
  globalSettingsManager = settingsManager;

  // 初始化列表和任务
  await settingsManager.initializeLists();
  await settingsManager.initializeTaskList();

  // 初始化标签规则UI
  renderTagRulesUI();

  // 初始化隐藏消息信息
  MessageUI.updateHiddenMessagesInfo();

  // Event listeners
  eventSource.on(event_types.MESSAGE_DELETED, onChatEvent);
  eventSource.on(event_types.MESSAGE_EDITED, onChatEvent);
  eventSource.on(event_types.MESSAGE_SENT, onChatEvent);
  eventSource.on(event_types.MESSAGE_RECEIVED, onChatEvent);
  eventSource.on(event_types.MESSAGE_SWIPED, onChatEvent);
  eventSource.on(event_types.CHAT_DELETED, async chatId => {
    console.log(`Vectors: Cleaning up data for deleted chat: ${chatId}`);

    // 清除内存缓存
    cachedVectors.delete(chatId);

    // 获取要删除的任务
    const tasksToDelete = getChatTasks(chatId);

    // 清理向量数据文件
    for (const task of tasksToDelete) {
      // 外挂任务不删除向量文件（向量文件属于源任务）
      if (task.type === 'external') {
        console.log(`Vectors: Skipping external task ${task.taskId} - no vector data to delete`);
        continue;
      }

      try {
        const collectionId = `${chatId}_${task.taskId}`;
        console.log(`Vectors: Deleting vector collection: ${collectionId}`);
        await storageAdapter.purgeVectorIndex(collectionId);
      } catch (error) {
        console.error(`Vectors: Failed to delete vector collection for task ${task.taskId}:`, error);
      }
    }

    // 清理孤儿外挂任务
    await cleanupOrphanedExternalTasks(chatId);

    // 删除任务元数据
    delete settings.vector_tasks[chatId];
    Object.assign(extension_settings.vectors_enhanced, settings);
    saveSettingsDebounced();
  });
  eventSource.on(event_types.GROUP_CHAT_DELETED, chatId => {
    cachedVectors.delete(chatId);
    delete settings.vector_tasks[chatId];
    Object.assign(extension_settings.vectors_enhanced, settings);
    saveSettingsDebounced();
  });
  eventSource.on(event_types.CHAT_CHANGED, async () => {
    await updateTaskList(getChatTasks, renameVectorTask, removeVectorTask);
    MessageUI.updateHiddenMessagesInfo();
    // Auto-cleanup invalid world info selections when switching chats
    if (settings.selected_content.world_info.enabled) {
      await cleanupInvalidSelections();
      await updateWorldInfoList();
    }
  });

  // 监听聊天重新加载事件，以便在使用 /hide 和 /unhide 命令后更新
  eventSource.on(event_types.CHAT_LOADED, async () => {
    MessageUI.updateHiddenMessagesInfo();
  });

  // 添加页面卸载处理器，确保设置立即保存
  $(window).on('beforeunload', () => {
    if (extension_settings.vectors_enhanced) {
      // 使用非防抖版本立即保存
      console.log('Vectors: Page unloading, saving settings immediately');
      // 直接调用保存，绕过防抖
      if (typeof window.SillyTavern !== 'undefined' && window.SillyTavern.saveSettings) {
        window.SillyTavern.saveSettings();
      } else {
        // 备用方案：尝试直接保存到localStorage
        try {
          localStorage.setItem('extensions_settings', JSON.stringify(extension_settings));
        } catch (e) {
          console.error('Vectors: Failed to save settings on unload:', e);
        }
      }
    }
  });

  // 监听向量化总结事件
  document.addEventListener('vectors:vectorize-summary', async (event) => {
    const { taskName, taskId, content, worldName } = event.detail;

    try {
      console.log('[Vectors] 准备向量化总结:', {
        taskName,
        worldName,
        contentCount: content.length,
        content: content
      });

      const chatId = getCurrentChatId();
      if (!chatId || chatId === 'null' || chatId === 'undefined') {
        toastr.error('未选择聊天');
        return;
      }

      // 保存当前设置的完整备份
      const originalSettings = JSON.parse(JSON.stringify(settings));
      const originalSelectedContent = JSON.parse(JSON.stringify(settings.selected_content));

      // 清空所有选择，然后只选中指定的世界书条目
      settings.selected_content = {
        chat: {
          enabled: false,
          range: { start: 0, end: -1 },
          user: true,
          assistant: true,
          include_hidden: false
        },
        files: {
          enabled: false,
          selected: []
        },
        world_info: {
          enabled: true,
          selected: {}  // 先清空
        },
        tag_rules: settings.selected_content.tag_rules || [],
        content_blacklist: settings.selected_content.content_blacklist || ''
      };

      // 只添加指定世界书的指定条目
      settings.selected_content.world_info.selected[worldName] = content.map(entry => entry.uid);

      console.log('[Vectors] 临时设置:', {
        worldInfoSelected: settings.selected_content.world_info.selected
      });

      // 获取要向量化的内容
      const items = await getVectorizableContent(settings.selected_content);

      // 过滤出有效的项目（非空）
      const validItems = items.filter(item => item.text && item.text.trim() !== '');

      if (validItems.length === 0) {
        toastr.warning('世界书条目内容为空或被过滤');
        // 恢复原始设置
        settings.selected_content = originalSelectedContent;
        saveSettingsDebounced();
        return;
      }

      // 获取已处理的项目标识符
      const processedIdentifiers = getProcessedItemIdentifiers(chatId);

      // 过滤出新项目（未被向量化的）
      const newItems = validItems.filter(item => {
        switch (item.type) {
          case 'chat': return !processedIdentifiers.chat.has(item.metadata.index);
          case 'file': return !processedIdentifiers.file.has(item.metadata.url);
          case 'world_info': {
            // 对于世界书，需要同时检查 UID 和世界书名字
            // 统一转换为字符串以确保类型一致
            const uidStr = String(item.metadata.uid);
            if (!processedIdentifiers.world_info.has(uidStr)) {
              // UID 未被处理过，这是新项目
              return true;
            }
            // UID 已存在，检查是否来自同一个世界书
            const processedWorld = processedIdentifiers.world_info_with_world.get(uidStr);
            if (!processedWorld) {
              // 旧格式任务，没有世界书信息，保守起见认为是重复的
              return false;
            }
            // 如果世界书名字不同，则认为是新项目（不同世界书的相同 UID）
            return processedWorld !== item.metadata.world;
          }
          default: return true;
        }
      });

      // 生成自定义任务名称
      const entryNames = content.map(entry => entry.comment || `UID:${entry.uid}`).join('、');
      const customTaskName = `${entryNames} (总结向量化)`;

      // 检查是否有已处理的项目
      const hasProcessedItems = newItems.length < validItems.length;
      let itemsToProcess = newItems;
      let isIncremental = hasProcessedItems;

      if (newItems.length === 0) {
        // 所有项目都已被向量化
        const processedCount = validItems.length;
        const confirm = await callGenericPopup(
          `<div>
            <p>世界书 "${worldName}" 的所有选定条目（${processedCount}条）均已被向量化。</p>
            <p>是否要强制重新向量化这些内容？</p>
          </div>`,
          POPUP_TYPE.CONFIRM,
          { okButton: '是', cancelButton: '否' }
        );

        if (confirm !== POPUP_RESULT.AFFIRMATIVE) {
          // 用户选择不重新向量化，恢复设置并返回
          settings.selected_content = originalSelectedContent;
          saveSettingsDebounced();
          return;
        }

        // 用户选择重新向量化
        itemsToProcess = validItems;
        isIncremental = false;
      } else if (hasProcessedItems) {
        // 部分项目已被向量化
        const newCount = newItems.length;
        const processedCount = validItems.length - newCount;

        const confirm = await callGenericPopup(
          `<div>
            <p><strong>世界书 "${worldName}" 的部分条目已被向量化：</strong></p>
            <div style="text-align: left; margin: 10px 0;">
              <p>已处理：${processedCount} 条</p>
              <p>新增内容：${newCount} 条</p>
            </div>
            <p>是否只进行增量向量化（只处理新增内容）？</p>
          </div>`,
          POPUP_TYPE.CONFIRM,
          { okButton: '是，只处理新增', cancelButton: '取消' }
        );

        if (confirm !== POPUP_RESULT.AFFIRMATIVE) {
          // 用户取消，恢复设置并返回
          settings.selected_content = originalSelectedContent;
          saveSettingsDebounced();
          return;
        }

        // 用户选择增量向量化
        itemsToProcess = newItems;
        isIncremental = true;
      }

      // 使用自定义任务名进行向量化
      const result = await performVectorization(
        settings.selected_content,
        chatId,
        isIncremental,
        itemsToProcess,
        {
          taskType: 'summary_vectorization',
          customTaskName: customTaskName
        }
      );

      // 恢复原始设置
      settings.selected_content = originalSelectedContent;
      saveSettingsDebounced();

      // 如果向量化成功，且启用了禁用世界书条目的选项
      if (result?.success && extension_settings?.vectors_enhanced?.memory?.disableWorldInfoAfterVectorize) {
        console.log('[Vectors] 准备禁用世界书条目...');
        await disableWorldInfoEntries(worldName, content);
      }

    } catch (error) {
      console.error('[Vectors] 向量化总结失败:', error);
      toastr.error('向量化总结失败: ' + error.message);
      // 确保恢复原始设置
      if (originalSettings) {
        settings.selected_content = originalSettings.selected_content;
        saveSettingsDebounced();
      }
    }
  });

  // 添加生成空白任务按钮的事件处理器
  $(document).on('click', '#vectors_enhanced_generate_blank_task', async (e) => {
    e.preventDefault();
    console.log('生成空白任务按钮被点击');

    const chatId = getCurrentChatId();
    if (!chatId || chatId === 'null' || chatId === 'undefined') {
      toastr.error('未选择聊天');
      return;
    }

    if (isVectorizing) {
      toastr.warning('已有向量化任务在进行中');
      return;
    }

    try {
      // 创建一个包含占位文本的内容项
      // 使用 file 类型，防止与其他向量化任务冲突
      const blankItem = {
        type: 'file',
        identifier: `import_${Date.now()}`,
        text: '[导入任务占位内容]', // 使用占位文本而不是空白，确保不被过滤
        metadata: {
          url: `import_placeholder_${Date.now()}.txt`,
          name: '导入占位文件',
          size: 1,
          timestamp: new Date().toISOString(),
          source: 'import_task'
        }
      };

      // 使用固定的任务名称
      const customTaskName = '导入任务';

      // 创建一个临时的 content settings，只启用 files
      const blankContentSettings = {
        chat: {
          enabled: false,
          range: { start: 0, end: -1 },
          user: true,
          assistant: true,
          include_hidden: false
        },
        files: {
          enabled: true,
          selected: [blankItem.metadata.url]
        },
        world_info: {
          enabled: false,
          selected: {}
        },
        tag_rules: [],
        content_blacklist: ''
      };

      // 直接执行向量化
      const result = await performVectorization(
        blankContentSettings,
        chatId,
        false, // 不是增量
        [blankItem], // 只包含空白项
        {
          taskType: 'import_task',
          customTaskName: customTaskName,
          skipDeduplication: true // 跳过去重检查
        }
      );

      if (result?.success) {
        toastr.success(`成功创建导入任务`);
        // 刷新任务列表
        await updateTaskList(getChatTasks, renameVectorTask, removeVectorTask);

        // 显示存储路径弹窗
        showImportTaskStoragePath(chatId, result.taskId, customTaskName);
      }
    } catch (error) {
      console.error('创建导入任务失败:', error);
      toastr.error('创建导入任务失败: ' + error.message);
    }
  });

  /**
   * Show storage path for import task
   * @param {string} chatId - Chat ID
   * @param {string} taskId - Task ID
   * @param {string} taskName - Task name
   */
  function showImportTaskStoragePath(chatId, taskId, taskName) {
    // Get current vector source and model
    const vectorSource = settings?.source || 'unknown';
    const vectorModel = getVectorModel();

    // Construct the full path
    const dataRoot = 'sillytavern/data/default-user';
    const collectionId = `${chatId}_${taskId}`;
    const relativePath = `vectors/${vectorSource}/${collectionId}/${vectorModel || 'default'}/`;
    const fullPath = `${dataRoot}/${relativePath}`;

    // Create modal HTML
    const modalHtml = `
      <div class="vector-storage-modal-overlay" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 20px; box-sizing: border-box;">
        <div class="vector-storage-modal" style="background: var(--SmartThemeBlurTintColor); border-radius: 8px; padding: 20px; max-width: 600px; width: 90%; max-height: 90vh; overflow-y: auto; box-shadow: 0 4px 20px rgba(0,0,0,0.3); margin: auto; position: relative;">
          <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h3 style="margin: 0;">导入任务存储地址</h3>
            <button class="menu_button" id="close-import-modal" style="padding: 5px 10px;">
              <i class="fa-solid fa-times"></i>
            </button>
          </div>

          <div style="margin-bottom: 1rem;">
            <strong>任务名称:</strong> ${taskName}
          </div>

          <div style="margin-bottom: 1rem;">请将您获取的向量化文件粘贴至下列路径并覆盖：</div>
          <div style="padding: 0.75rem; background: rgba(0,0,0,0.3); border-radius: 4px; font-size: 0.9em; font-family: monospace; word-break: break-all;">
            ${fullPath}
          </div>

          <div style="margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid var(--SmartThemeBorderColor);">
            <small style="color: var(--SmartThemeQuoteColor);">
              请您确保使用与分享方相同的向量化模型。
            </small>
          </div>

          <div class="flex-container" style="justify-content: flex-end; gap: 10px; margin-top: 1.5rem;">
            <button class="menu_button" id="copy-import-path" style="width: auto; min-width: fit-content;">
              <i class="fa-solid fa-copy"></i> 复制路径
            </button>
            <button class="menu_button" id="confirm-import-modal" style="width: auto; min-width: fit-content;">
              <i class="fa-solid fa-check"></i> 确定
            </button>
          </div>
        </div>
      </div>
    `;

    // Remove any existing modal
    $('.vector-storage-modal-overlay').remove();

    // Add modal to body
    const $modal = $(modalHtml);
    $('body').append($modal);

    // Bind events
    $modal.on('click', function(e) {
      if (e.target === e.currentTarget) {
        $modal.remove();
      }
    });

    $modal.find('#close-import-modal, #confirm-import-modal').on('click', function() {
      $modal.remove();
    });

    $modal.find('#copy-import-path').on('click', function() {
      const $button = $(this);
      const originalHtml = $button.html();

      // Copy to clipboard
      navigator.clipboard.writeText(fullPath).then(() => {
        $button.html('<i class="fa-solid fa-check"></i> 已复制');
        setTimeout(() => {
          $button.html(originalHtml);
        }, 2000);
      }).catch(err => {
        console.error('Failed to copy path:', err);
        toastr.error('复制失败');
      });
    });
  }

  /**
   * Get vector model based on current settings
   * @returns {string} Model name or empty string
   */
  function getVectorModel() {
    const source = settings?.source;
    if (!source) return '';

    // Different sources have different model settings
    switch (source) {
      case 'ollama':
        return settings?.ollama_model || '';
      case 'llamacpp':
        return settings?.llamacpp_model || '';
      case 'vllm':
        return settings?.vllm_model || '';
      case 'voyageai':
        return settings?.voyageai_model || '';
      case 'gemini':
        return settings?.google_model || '';
      case 'google':
        return settings?.google_model || '';
      default:
        return '';
    }
  }

  // Register slash commands
  SlashCommandParser.addCommandObject(
    SlashCommand.fromProps({
      name: 'vec-preview',
      callback: async () => {
        await MessageUI.previewContent(getVectorizableContent, shouldSkipContent, extractComplexTag, extractHtmlFormatTag, extractSimpleTag, settings, substituteParams);
        return '';
      },
      helpString: '预览选中的向量化内容',
    }),
  );

  SlashCommandParser.addCommandObject(
    SlashCommand.fromProps({
      name: 'vec-export',
      callback: async () => {
        await exportVectors();
        return '';
      },
      helpString: '导出向量化内容到文本文件',
    }),
  );

  SlashCommandParser.addCommandObject(
    SlashCommand.fromProps({
      name: 'vec-process',
      callback: async () => {
        await vectorizeContent();
        return '';
      },
      helpString: '处理并向量化选中的内容',
    }),
  );


  // 内容过滤黑名单设置
  $('#vectors_enhanced_content_blacklist').on('input', function () {
    const blacklistText = $(this).val();
    settings.content_blacklist = blacklistText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line);
    Object.assign(extension_settings.vectors_enhanced, settings);
    saveSettingsDebounced();
  });

  // 内容过滤黑名单UI初始化
  $('#vectors_enhanced_content_blacklist').val(
    Array.isArray(settings.content_blacklist) ? settings.content_blacklist.join('\n') : '',
  );

  // 初始化隐藏消息信息显示
  MessageUI.updateHiddenMessagesInfo();



  // 创建内容提取器接口，供其他组件使用
  window.VectorsEnhanced = window.VectorsEnhanced || {};
  window.VectorsEnhanced.contentExtractor = {
    extractContent: async () => {
      try {
        // 使用现有的 getVectorizableContent 函数
        const content = await getVectorizableContent();
        return content;
      } catch (error) {
        console.error('Failed to extract content:', error);
        return [];
      }
    }
  };

  // 初始化调试模块（如果启用）- 不阻塞主初始化
  initializeDebugModule().catch(err => {
    console.debug('[Vectors] Debug module initialization failed (this is normal in production):', err.message);
  });

    console.log('Vectors Enhanced: Initialization completed successfully');
  } catch (error) {
    console.error('Vectors Enhanced: Failed to initialize:', error);
    toastr.error(`Vectors Enhanced 初始化失败: ${error.message}`);
  }
});

/**
 * 初始化调试模块
 * 根据环境条件动态加载调试功能
 */
async function initializeDebugModule() {
  try {
    // 检查是否应该加载调试模块
    const shouldLoadDebug = (
      window.location.hostname === 'localhost' ||
      window.location.search.includes('debug=true') ||
      localStorage.getItem('vectors_debug_enabled') === 'true'
    );

    if (!shouldLoadDebug) {
      console.debug('[Vectors] Debug module not loaded (not in debug environment)');
      return;
    }

    console.log('[Vectors] Loading debug module...');

    // 动态导入调试模块
    const { createDebugger } = await import('./debug/debugger.js');

    // 创建API接口对象
    const debugAPI = createDebugAPI();

    // 创建并初始化调试器
    const debuggerInstance = await createDebugger(debugAPI);

    console.log('[Vectors] Debug module loaded successfully');

  } catch (error) {
    console.warn('[Vectors] Failed to load debug module (this is normal in production):', error.message);
  }
}

/**
 * Scans current selected content for tags and displays suggestions
 */
async function scanAndSuggestTags() {
    try {

        // Use the new function to get raw content
        const content = await getRawContentForScanning();
        if (!content || content.length === 0) {
            toastr.warning('没有选择任何内容进行扫描');
            return;
        }

        const combinedText = content.map(item => item.text).join('\n\n');
        if (combinedText.length === 0) {
            toastr.warning('选择的内容为空');
            return;
        }

        console.log(`开始扫描标签，总文本长度: ${combinedText.length} 字符`);

        const scanOptions = {
            chunkSize: 50000,
            maxTags: 100,
            timeoutMs: 5000
        };

        const scanResult = await scanTextForTags(combinedText, scanOptions);
        const suggestionResult = generateTagSuggestions(scanResult);
        displayTagSuggestions(suggestionResult.suggestions, scanResult.stats);

        console.log(`标签扫描完成，发现 ${scanResult.stats.tagsFound} 个标签，生成 ${suggestionResult.suggestions.length} 个建议，耗时 ${scanResult.stats.processingTimeMs}ms`);

        if (suggestionResult.suggestions.length > 0) {
            toastr.success(`发现 ${suggestionResult.suggestions.length} 个可用标签`);
        } else {
            toastr.info('未发现可提取的标签');
        }

    } catch (error) {
        console.error('标签扫描失败:', error);
        toastr.error('标签扫描失败: ' + error.message);
    }
}



/**
 * 创建调试API接口
 * 为调试模块提供访问主插件功能的接口
 */
function createDebugAPI() {
  return {
    // jQuery 访问
    jQuery: $,

    // 设置管理
    getSettings: () => settings,
    extension_settings: extension_settings,
    saveSettingsDebounced: saveSettingsDebounced,

    // 聊天管理
    getCurrentChatId: getCurrentChatId,
    getChatTasks: getChatTasks,

    // 内容访问
    getSortedEntries: getSortedEntries,
    getHiddenMessages: getHiddenMessages,

    // 核心功能
    cleanupInvalidSelections: cleanupInvalidSelections,
    updateWorldInfoList: updateWorldInfoList,
    updateTaskList: (getChatTasks, renameVectorTask, removeVectorTask) => updateTaskList(getChatTasks, renameVectorTask, removeVectorTask),
    analyzeTaskOverlap: analyzeTaskOverlap,

    // UI更新
    updateMasterSwitchState: () => updateMasterSwitchStateNew(settings),
    updateChatSettings: updateChatSettings,
    updateFileList: updateFileList,
    updateHiddenMessagesInfo: MessageUI.updateHiddenMessagesInfo,

    // 消息管理
    toggleMessageVisibility: toggleMessageVisibility,
    toggleMessageRangeVisibility: toggleMessageRangeVisibility,

    // 向量操作（如果可用）
    getSavedHashes: storageAdapter ? (collectionId) => storageAdapter.getSavedHashes(collectionId) : null,
    purgeVectorIndex: storageAdapter ? (collectionId) => storageAdapter.purgeVectorIndex(collectionId) : null,

    // 缓存访问（只读）
    cachedVectors: cachedVectors,

    // 通知系统
    toastr: typeof toastr !== 'undefined' ? toastr : null,

    // 事件系统
    eventSource: eventSource,
    event_types: event_types,

    // 调试注册（如果可用）
    registerDebugFunction: null,

    // 上下文访问
    getContext: getContext,

    // 工具函数
    generateTaskId: generateTaskId,
    extractTagContent: extractTagContent,

    // 模块信息
    MODULE_NAME: MODULE_NAME,
    EXTENSION_PROMPT_TAG: EXTENSION_PROMPT_TAG
  };
}




/**
 * 更新隐藏消息信息显示
 */

/**
 * 切换消息的隐藏状态
 * @param {number} messageIndex 消息索引
 * @param {boolean} hide 是否隐藏
 * @returns {Promise<boolean>} 是否成功
 */
async function toggleMessageVisibility(messageIndex, hide) {
  const context = getContext();
  if (!context.chat || messageIndex < 0 || messageIndex >= context.chat.length) {
    console.error('无效的消息索引:', messageIndex);
    return false;
  }

  try {
    // 修改消息的 is_system 属性
    context.chat[messageIndex].is_system = hide;

    // 直接更新 DOM 属性（轻量级更新，避免 reloadCurrentChat）
    const messageBlock = $(`#chat .mes[mesid="${messageIndex}"]`);
    if (messageBlock.length) {
      messageBlock.attr('is_system', String(hide));
    }

    // 刷新滑动按钮（如果最后一条消息被隐藏可能需要更新）
    if (typeof refreshSwipeButtons === 'function') {
      refreshSwipeButtons();
    }

    // 触发保存
    await saveChatConditional();

    return true;
  } catch (error) {
    console.error('切换消息可见性失败:', error);
    return false;
  }
}

/**
 * 批量切换消息范围的隐藏状态
 * @param {number} startIndex 开始索引
 * @param {number} endIndex 结束索引（不包含）
 * @param {boolean} hide 是否隐藏
 * @returns {Promise<void>}
 */
async function toggleMessageRangeVisibility(startIndex, endIndex, hide) {
  const context = getContext();
  if (!context.chat) {
    toastr.error('没有可用的聊天记录');
    return;
  }

  const start = Math.max(0, startIndex);
  const end = Math.min(context.chat.length, endIndex === -1 ? context.chat.length : endIndex + 1);

  if (start >= end) {
    toastr.error('无效的消息范围');
    return;
  }

  try {
    // 批量修改消息的 is_system 属性并更新 DOM
    for (let i = start; i < end; i++) {
      context.chat[i].is_system = hide;

      // 直接更新 DOM 属性（轻量级更新，避免 reloadCurrentChat）
      const messageBlock = $(`#chat .mes[mesid="${i}"]`);
      if (messageBlock.length) {
        messageBlock.attr('is_system', String(hide));
      }
    }

    // 刷新滑动按钮（如果最后一条消息被隐藏可能需要更新）
    if (typeof refreshSwipeButtons === 'function') {
      refreshSwipeButtons();
    }

    // 触发保存
    await saveChatConditional();

    const action = hide ? '隐藏' : '显示';
    toastr.success(`已${action}消息 #${start} 到 #${endIndex}`);
  } catch (error) {
    console.error('批量切换消息可见性失败:', error);
    toastr.error('操作失败');
  }
}

