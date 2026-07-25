/**
 * 设置管理器模块
 * 负责UI设置的初始化、事件绑定和状态同步
 */

import { ConfigManager } from '../infrastructure/ConfigManager.js';
import { updateFileList } from './components/FileList.js';
import { updateWorldInfoList } from './components/WorldInfoList.js';
import { renderTagRulesUI } from './components/TagRulesEditor.js';
import { tagPresetManager } from './components/TagPresetManager.js';
import { updateTaskList } from './components/TaskList.js';
import { MessageUI } from './components/MessageUI.js';
import { MemoryUI } from './components/MemoryUI.js';
import { MemoryService } from '../core/memory/MemoryService.js';
import { 
  updateMasterSwitchState, 
  updateContentSelection,
  toggleSettings
} from './domUtils.js';
import { updateChatSettings } from './components/ChatSettings.js';
import { clearTagSuggestions } from './components/TagUI.js';
import { eventBus } from '../infrastructure/events/eventBus.instance.js';

/**
 * 设置管理器类
 * 集中管理所有设置相关的UI初始化和事件处理
 */
export class SettingsManager {
  constructor(settings, configManager, dependencies) {
    this.settings = settings;
    this.configManager = configManager;
    this.dependencies = dependencies;
    this.initialized = false;
  }

  /**
   * 初始化所有设置UI
   */
  async initialize() {
    if (this.initialized) {
      console.warn('SettingsManager already initialized');
      return;
    }

    this.initialized = true;

    // 初始化主开关
    this.initializeMasterSwitch();

    // 初始化基础设置
    this.initializeBasicSettings();

    // 初始化向量化源设置
    this.initializeVectorizationSettings();

    // 初始化 Rerank 设置
    this.initializeRerankSettings();

    // 初始化查询设置
    this.initializeQuerySettings();

    // 初始化内容选择设置
    await this.initializeContentSelectionSettings();

    // 初始化内容标签设置
    this.initializeContentTagSettings();

    // 初始化注入设置
    this.initializeInjectionSettings();

    // 初始化其他设置
    this.initializeMiscellaneousSettings();
    
    // 初始化外挂任务UI
    await this.initializeExternalTaskUI();
    
    // 初始化向量存储路径UI
    await this.initializeVectorStoragePathUI();
    
    // 初始化实验性设置
    this.initializeExperimentalSettings();
    
    // 初始化记忆管理UI
    await this.initializeMemoryUI();

    // 初始化UI状态
    this.initializeUIState();

    // 绑定其他事件
    this.bindOtherEvents();
    
    // 清除标签建议（防止空的"发现的标签"框显示）
    clearTagSuggestions();
  }

  /**
   * 初始化主开关
   */
  initializeMasterSwitch() {
    const { saveSettingsDebounced } = this.dependencies;

    $('#vectors_enhanced_master_enabled')
      .prop('checked', this.settings.master_enabled)
      .on('change', () => {
        this.settings.master_enabled = $('#vectors_enhanced_master_enabled').prop('checked');
        this.updateAndSave();
        updateMasterSwitchState(this.settings);
      });

    // 初始化主开关状态
    updateMasterSwitchState(this.settings);
  }

  /**
   * 初始化基础设置
   */
  initializeBasicSettings() {
    // 向量化源
    $('#vectors_enhanced_source')
      .val(this.settings.source)
      .on('change', () => {
        this.settings.source = String($('#vectors_enhanced_source').val());
        this.updateAndSave();
        toggleSettings(this.settings);
      });


    // 块大小
    $('#vectors_enhanced_chunk_size')
      .val(this.settings.chunk_size)
      .on('input', () => {
        this.settings.chunk_size = Number($('#vectors_enhanced_chunk_size').val());
        this.updateAndSave();
      });

    // 重叠百分比
    $('#vectors_enhanced_overlap_percent')
      .val(this.settings.overlap_percent)
      .on('input', () => {
        this.settings.overlap_percent = Number($('#vectors_enhanced_overlap_percent').val());
        this.updateAndSave();
      });

    // 分块分隔符
    $('#vectors_enhanced_force_chunk_delimiter')
      .val(this.settings.force_chunk_delimiter)
      .on('input', () => {
        this.settings.force_chunk_delimiter = String($('#vectors_enhanced_force_chunk_delimiter').val());
        this.updateAndSave();
      });

    // 分数阈值
    $('#vectors_enhanced_score_threshold')
      .val(this.settings.score_threshold)
      .on('input', () => {
        this.settings.score_threshold = Number($('#vectors_enhanced_score_threshold').val());
        this.updateAndSave();
      });

    // TPM 限制控制
    this.initializeBatchDelaySettings();
  }

  /**
   * 初始化 TPM 限制控制设置
   */
  initializeBatchDelaySettings() {
    const updateDelayInfo = () => {
      const chunkSize = this.settings.chunk_size || 768;
      const delayChunks = this.settings.batch_delay_chunks || 50;
      const delaySeconds = this.settings.batch_delay_seconds || 60;
      const totalChars = chunkSize * delayChunks;

      $('#vectors_enhanced_batch_delay_info').html(
        `当前配置: ${chunkSize}字符 × ${delayChunks}块 ≈ ${totalChars.toLocaleString()} 字符后延迟 ${delaySeconds} 秒`
      );
    };

    // 启用批次延迟
    $('#vectors_enhanced_batch_delay_enabled')
      .prop('checked', this.settings.batch_delay_enabled || false)
      .on('change', () => {
        this.settings.batch_delay_enabled = $('#vectors_enhanced_batch_delay_enabled').prop('checked');
        this.updateAndSave();
        // 控制详细设置的显示/隐藏
        $('#vectors_enhanced_batch_delay_settings').toggle(this.settings.batch_delay_enabled);
        if (this.settings.batch_delay_enabled) {
          updateDelayInfo();
        }
      });

    // 延迟触发块数
    $('#vectors_enhanced_batch_delay_chunks')
      .val(this.settings.batch_delay_chunks || 50)
      .on('input', () => {
        this.settings.batch_delay_chunks = Number($('#vectors_enhanced_batch_delay_chunks').val()) || 50;
        this.updateAndSave();
        updateDelayInfo();
      });

    // 延迟秒数
    $('#vectors_enhanced_batch_delay_seconds')
      .val(this.settings.batch_delay_seconds || 60)
      .on('input', () => {
        this.settings.batch_delay_seconds = Number($('#vectors_enhanced_batch_delay_seconds').val()) || 60;
        this.updateAndSave();
        updateDelayInfo();
      });

    // 初始化详细设置的显示状态
    $('#vectors_enhanced_batch_delay_settings').toggle(this.settings.batch_delay_enabled || false);

    // 初始化信息显示
    if (this.settings.batch_delay_enabled) {
      updateDelayInfo();
    }

    // 当块大小变化时也更新信息
    $('#vectors_enhanced_chunk_size').on('input', () => {
      if (this.settings.batch_delay_enabled) {
        updateDelayInfo();
      }
    });
  }

  /**
   * 初始化向量化源设置
   */
  initializeVectorizationSettings() {
    // WebLLM 设置
    $('#vectors_enhanced_webllm_model')
      .val(this.settings.webllm_model || '')
      .on('input', () => {
        this.settings.webllm_model = String($('#vectors_enhanced_webllm_model').val());
        this.updateAndSave();
      });

    // vLLM 设置
    $('#vectors_enhanced_vllm_model')
      .val(this.settings.vllm_model)
      .on('input', () => {
        this.settings.vllm_model = String($('#vectors_enhanced_vllm_model').val());
        this.updateAndSave();
      });

    $('#vectors_enhanced_vllm_url')
      .val(this.settings.vllm_url)
      .on('input', () => {
        this.settings.vllm_url = String($('#vectors_enhanced_vllm_url').val());
        this.updateAndSave();
      });

    // 本地模型设置
    $('#vectors_enhanced_local_model')
      .val(this.settings.local_model)
      .on('input', () => {
        this.settings.local_model = String($('#vectors_enhanced_local_model').val());
        this.updateAndSave();
      });

    // Ollama 设置
    $('#vectors_enhanced_ollama_model')
      .val(this.settings.ollama_model)
      .on('input', () => {
        this.settings.ollama_model = String($('#vectors_enhanced_ollama_model').val());
        this.updateAndSave();
      });

    $('#vectors_enhanced_ollama_url')
      .val(this.settings.ollama_url)
      .on('input', () => {
        this.settings.ollama_url = String($('#vectors_enhanced_ollama_url').val());
        this.updateAndSave();
      });

    $('#vectors_enhanced_ollama_keep')
      .prop('checked', this.settings.ollama_keep)
      .on('input', () => {
        this.settings.ollama_keep = $('#vectors_enhanced_ollama_keep').prop('checked');
        this.updateAndSave();
      });
  }

  /**
   * 初始化 Rerank 设置
   */
  initializeRerankSettings() {
    $('#vectors_enhanced_rerank_enabled')
      .prop('checked', this.settings.rerank_enabled)
      .on('input', () => {
        this.settings.rerank_enabled = $('#vectors_enhanced_rerank_enabled').prop('checked');
        
        // 如果 Rerank 被启用，确保向量查询也被启用
        if (this.settings.rerank_enabled) {
          $('#vectors_enhanced_enabled').prop('checked', true);
          this.settings.enabled = true;
        } else {
          // 如果 Rerank 被禁用，同时禁用依赖的去重功能
          if (this.settings.rerank_deduplication_enabled) {
            this.settings.rerank_deduplication_enabled = false;
            $('#vectors_enhanced_rerank_deduplication_enabled').prop('checked', false);
            $('#rerank_deduplication_settings').slideUp();
          }
        }
        
        this.updateAndSave();
      });

    $('#vectors_enhanced_rerank_url')
      .val(this.settings.rerank_url)
      .on('input', () => {
        this.settings.rerank_url = $('#vectors_enhanced_rerank_url').val();
        this.updateAndSave();
      });

    $('#vectors_enhanced_rerank_apiKey')
      .val(this.settings.rerank_apiKey)
      .on('input', () => {
        this.settings.rerank_apiKey = $('#vectors_enhanced_rerank_apiKey').val();
        this.updateAndSave();
      });

    $('#vectors_enhanced_rerank_model')
      .val(this.settings.rerank_model)
      .on('input', () => {
        this.settings.rerank_model = $('#vectors_enhanced_rerank_model').val();
        this.updateAndSave();
      });

    $('#vectors_enhanced_rerank_top_n')
      .val(this.settings.rerank_top_n)
      .on('input', () => {
        this.settings.rerank_top_n = Number($('#vectors_enhanced_rerank_top_n').val());
        this.updateAndSave();
      });

    $('#vectors_enhanced_rerank_hybrid_alpha')
      .val(this.settings.rerank_hybrid_alpha)
      .on('input', () => {
        this.settings.rerank_hybrid_alpha = Number($('#vectors_enhanced_rerank_hybrid_alpha').val());
        this.updateAndSave();
      });

    $('#vectors_enhanced_rerank_success_notify')
      .prop('checked', this.settings.rerank_success_notify)
      .on('input', () => {
        this.settings.rerank_success_notify = $('#vectors_enhanced_rerank_success_notify').prop('checked');
        this.updateAndSave();
      });
  }

  /**
   * 初始化查询设置
   */
  initializeQuerySettings() {
    // 启用向量查询
    $('#vectors_enhanced_enabled')
      .prop('checked', this.settings.enabled)
      .on('input', () => {
        this.settings.enabled = $('#vectors_enhanced_enabled').prop('checked');
        
        // 如果向量查询被禁用，同时禁用依赖的功能
        if (!this.settings.enabled) {
          // 禁用查询指令增强
          if (this.settings.query_instruction_enabled) {
            this.settings.query_instruction_enabled = false;
            $('#vectors_enhanced_query_instruction_enabled').prop('checked', false);
            $('#query_instruction_settings').slideUp();
          }
        }
        
        this.updateAndSave();
      });

    // 查询消息数
    $('#vectors_enhanced_query_messages')
      .val(this.settings.query_messages)
      .on('input', () => {
        this.settings.query_messages = Number($('#vectors_enhanced_query_messages').val());
        this.updateAndSave();
      });

    // 最大结果数
    $('#vectors_enhanced_max_results')
      .val(this.settings.max_results)
      .on('input', () => {
        this.settings.max_results = Number($('#vectors_enhanced_max_results').val());
        this.updateAndSave();
      });

    // 显示查询通知
    $('#vectors_enhanced_show_query_notification')
      .prop('checked', this.settings.show_query_notification)
      .on('input', () => {
        this.settings.show_query_notification = $('#vectors_enhanced_show_query_notification').prop('checked');
        this.updateAndSave();
        // 控制详细选项的显示/隐藏
        $('#vectors_enhanced_notification_details').toggle(this.settings.show_query_notification);
      });

    // 详细通知模式
    $('#vectors_enhanced_detailed_notification')
      .prop('checked', this.settings.detailed_notification)
      .on('input', () => {
        this.settings.detailed_notification = $('#vectors_enhanced_detailed_notification').prop('checked');
        this.updateAndSave();
      });
      
    // 初始化详细选项的显示状态
    $('#vectors_enhanced_notification_details').toggle(this.settings.show_query_notification);
  }

  /**
   * 初始化内容选择设置
   */
  async initializeContentSelectionSettings() {
    const { updateFileList, updateWorldInfoList } = this.dependencies;

    // 聊天消息
    $('#vectors_enhanced_chat_enabled')
      .prop('checked', this.settings.selected_content.chat.enabled)
      .on('input', () => {
        this.settings.selected_content.chat.enabled = $('#vectors_enhanced_chat_enabled').prop('checked');
        this.updateAndSave();
        updateContentSelection(this.settings);
      });

    // 文件
    $('#vectors_enhanced_files_enabled')
      .prop('checked', this.settings.selected_content.files.enabled)
      .on('input', async () => {
        this.settings.selected_content.files.enabled = $('#vectors_enhanced_files_enabled').prop('checked');
        this.updateAndSave();
        updateContentSelection(this.settings);
        if (this.settings.selected_content.files.enabled) {
          await updateFileList();
        }
      });

    // 世界信息
    $('#vectors_enhanced_wi_enabled')
      .prop('checked', this.settings.selected_content.world_info.enabled)
      .on('input', async () => {
        this.settings.selected_content.world_info.enabled = $('#vectors_enhanced_wi_enabled').prop('checked');
        this.updateAndSave();
        updateContentSelection(this.settings);
        if (this.settings.selected_content.world_info.enabled) {
          await updateWorldInfoList();
        }
        // 渲染标签规则UI
        renderTagRulesUI();
      });

    // 聊天设置
    this.initializeChatSettings();

    // 刷新按钮
    // File and WI refresh are handled in ContentSelectionSettings.js
    // Removed duplicate bindings to prevent double updates
  }

  /**
   * 初始化聊天设置
   */
  initializeChatSettings() {
    // 确保所有属性都存在
    const chatRange = this.settings.selected_content.chat.range || { start: 0, end: -1 };
    const chatTypes = this.settings.selected_content.chat.types || { user: true, assistant: true };

    // 消息范围
    $('#vectors_enhanced_chat_start')
      .val(chatRange.start)
      .on('input', () => {
        if (!this.settings.selected_content.chat.range) {
          this.settings.selected_content.chat.range = { start: 0, end: -1 };
        }
        this.settings.selected_content.chat.range.start = Number($('#vectors_enhanced_chat_start').val());
        this.updateAndSave();
      });

    $('#vectors_enhanced_chat_end')
      .val(chatRange.end)
      .on('input', () => {
        if (!this.settings.selected_content.chat.range) {
          this.settings.selected_content.chat.range = { start: 0, end: -1 };
        }
        this.settings.selected_content.chat.range.end = Number($('#vectors_enhanced_chat_end').val());
        this.updateAndSave();
      });

    // 消息类型
    $('#vectors_enhanced_chat_user')
      .prop('checked', chatTypes.user)
      .on('input', () => {
        if (!this.settings.selected_content.chat.types) {
          this.settings.selected_content.chat.types = { user: true, assistant: true };
        }
        this.settings.selected_content.chat.types.user = $('#vectors_enhanced_chat_user').prop('checked');
        this.updateAndSave();
      });

    $('#vectors_enhanced_chat_assistant')
      .prop('checked', chatTypes.assistant)
      .on('input', () => {
        if (!this.settings.selected_content.chat.types) {
          this.settings.selected_content.chat.types = { user: true, assistant: true };
        }
        this.settings.selected_content.chat.types.assistant = $('#vectors_enhanced_chat_assistant').prop('checked');
        this.updateAndSave();
      });

    // 包含隐藏消息
    $('#vectors_enhanced_chat_include_hidden')
      .prop('checked', this.settings.selected_content.chat.include_hidden || false)
      .on('input', () => {
        if (!this.settings.selected_content.chat) {
          this.settings.selected_content.chat = {};
        }
        this.settings.selected_content.chat.include_hidden = $('#vectors_enhanced_chat_include_hidden').prop('checked');
        this.updateAndSave();
      });

    // 对第0层应用标签提取规则
    $('#vectors_enhanced_apply_tags_to_first_message')
      .prop('checked', this.settings.selected_content.chat.apply_tags_to_first_message || false)
      .on('input', () => {
        if (!this.settings.selected_content.chat) {
          this.settings.selected_content.chat = {};
        }
        this.settings.selected_content.chat.apply_tags_to_first_message = $('#vectors_enhanced_apply_tags_to_first_message').prop('checked');
        this.updateAndSave();
      });
  }

  /**
   * 初始化内容标签设置
   */
  initializeContentTagSettings() {
    // 确保向后兼容
    if (!this.settings.content_tags) {
      this.settings.content_tags = {
        chat: 'past_chat',
        file: 'databank',
        world_info: 'world_part',
      };
    }

    $('#vectors_enhanced_tag_chat')
      .val(this.settings.content_tags.chat)
      .on('input', () => {
        const value = $('#vectors_enhanced_tag_chat').val().trim() || 'past_chat';
        this.settings.content_tags.chat = value;
        this.updateAndSave();
      });

    $('#vectors_enhanced_tag_wi')
      .val(this.settings.content_tags.world_info)
      .on('input', () => {
        const value = $('#vectors_enhanced_tag_wi').val().trim() || 'world_part';
        this.settings.content_tags.world_info = value;
        this.updateAndSave();
      });

    $('#vectors_enhanced_tag_file')
      .val(this.settings.content_tags.file)
      .on('input', () => {
        const value = $('#vectors_enhanced_tag_file').val().trim() || 'databank';
        this.settings.content_tags.file = value;
        this.updateAndSave();
      });
  }

  /**
   * 初始化注入设置
   */
  initializeInjectionSettings() {
    // 初始化模板预设
    this.initializeTemplatePresets();
    
    // 模板
    $('#vectors_enhanced_template')
      .val(this.settings.template)
      .on('input', () => {
        this.settings.template = String($('#vectors_enhanced_template').val());
        this.updateAndSave();
        // 用户手动修改了模板，但保持当前预设选择（允许用户基于预设进行修改）
      });

    // 深度
    $('#vectors_enhanced_depth')
      .val(this.settings.depth)
      .on('input', () => {
        this.settings.depth = Number($('#vectors_enhanced_depth').val());
        this.updateAndSave();
      });

    // 位置
    $(`input[name="vectors_position"][value="${this.settings.position}"]`).prop('checked', true);
    $('input[name="vectors_position"]').on('change', () => {
      this.settings.position = Number($('input[name="vectors_position"]:checked').val());
      this.updateAndSave();
    });

    // 深度角色
    $('#vectors_enhanced_depth_role')
      .val(this.settings.depth_role)
      .on('change', () => {
        this.settings.depth_role = Number($('#vectors_enhanced_depth_role').val());
        this.updateAndSave();
      });

    // 包含世界信息
    $('#vectors_enhanced_include_wi')
      .prop('checked', this.settings.include_wi)
      .on('input', () => {
        this.settings.include_wi = $('#vectors_enhanced_include_wi').prop('checked');
        this.updateAndSave();
      });
  }

  /**
   * 初始化模板预设功能
   */
  initializeTemplatePresets() {
    // 确保设置中有预设数据
    if (!this.settings.template_presets) {
      this.settings.template_presets = {
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
      };
      this.updateAndSave();
    }

    // 初始化自定义预设的显示
    this.updateCustomPresetOptions();

    // 设置当前选中的预设
    if (this.settings.active_preset_id) {
      $('#vectors_enhanced_template_preset').val(this.settings.active_preset_id);
      this.updateRenameButtonVisibility();
    }

    // 预设选择变化事件
    $('#vectors_enhanced_template_preset').on('change', () => {
      const selectedId = $('#vectors_enhanced_template_preset').val();
      if (selectedId) {
        this.applyPreset(selectedId);
      }
      this.updateRenameButtonVisibility();
    });

    // 重命名预设按钮事件
    $('#vectors_enhanced_rename_preset').on('click', async () => {
      try {
        await this.renameCustomPreset();
      } catch (error) {
        console.error('Error renaming preset:', error);
        if (typeof toastr !== 'undefined') {
          toastr.error('重命名失败: ' + error.message);
        }
      }
    });
  }

  /**
   * 应用预设模板
   * @param {string} presetId 预设ID
   */
  applyPreset(presetId) {
    // 查找预设
    let preset = this.settings.template_presets.default.find(p => p.id === presetId);
    if (!preset) {
      preset = this.settings.template_presets.custom.find(p => p.id === presetId);
    }

    if (preset) {
      // 应用模板
      $('#vectors_enhanced_template').val(preset.template);
      this.settings.template = preset.template;
      this.settings.active_preset_id = presetId;
      this.updateAndSave();
      
      // 如果是自定义模板，保存用户的修改
      if (presetId.startsWith('custom')) {
        $('#vectors_enhanced_template').off('input.custom').on('input.custom', () => {
          const newTemplate = $('#vectors_enhanced_template').val();
          preset.template = newTemplate;
          this.settings.template = newTemplate;
          this.updateAndSave();
        });
      } else {
        $('#vectors_enhanced_template').off('input.custom');
      }
    }
  }

  /**
   * 重命名自定义预设
   */
  async renameCustomPreset() {
    const selectedId = $('#vectors_enhanced_template_preset').val();
    if (!selectedId || !selectedId.startsWith('custom')) {
      return;
    }

    const preset = this.settings.template_presets.custom.find(p => p.id === selectedId);
    if (!preset) {
      return;
    }

    const { callGenericPopup, POPUP_TYPE, POPUP_RESULT } = await import('../../../../../popup.js');
    
    // 使用 INPUT 类型，直接传入当前名称作为默认值
    const result = await callGenericPopup(
      '请输入新的模板名称：', 
      POPUP_TYPE.INPUT, 
      preset.name,  // 默认值
      { 
        okButton: '确定',
        cancelButton: '取消'
      }
    );

    if (result !== null && result !== false) {
      // INPUT 类型会直接返回输入的字符串值
      const newName = String(result).trim();
      
      if (!newName) {
        if (typeof toastr !== 'undefined') {
          toastr.warning('请输入新名称');
        }
        return;
      }

      // 更新名称
      preset.name = newName;

      // 更新UI并保存
      this.updateCustomPresetOptions();
      
      // 保持选中状态
      $('#vectors_enhanced_template_preset').val(selectedId);
      
      this.updateAndSave();

      if (typeof toastr !== 'undefined') {
        toastr.success(`已重命名为"${newName}"`);
      }
    }
  }

  // /**
  //  * 删除自定义预设 - 已弃用，改为固定3个自定义模板
  //  */
  // async deleteCustomPreset() {
  //   const selectedId = $('#vectors_enhanced_template_preset').val();
  //   if (!selectedId || !selectedId.startsWith('custom_')) {
  //     return;
  //   }

  //   const preset = this.settings.template_presets.custom.find(p => p.id === selectedId);
  //   if (!preset) {
  //     return;
  //   }

  //   const { callGenericPopup, POPUP_TYPE, POPUP_RESULT } = await import('../../../popup.js');
    
  //   const result = await callGenericPopup(
  //     `确定要删除预设"${preset.name}"吗？`,
  //     POPUP_TYPE.CONFIRM,
  //     '删除预设'
  //   );

  //   if (result === POPUP_RESULT.AFFIRMATIVE) {
  //     // 从列表中移除
  //     const index = this.settings.template_presets.custom.findIndex(p => p.id === selectedId);
  //     if (index !== -1) {
  //       this.settings.template_presets.custom.splice(index, 1);
  //     }

  //     // 重置选择
  //     $('#vectors_enhanced_template_preset').val('');
  //     this.settings.active_preset_id = null;
      
  //     // 更新UI
  //     this.updateCustomPresetOptions();
  //     this.updateRenameButtonVisibility();
  //     this.updateAndSave();

  //     if (typeof toastr !== 'undefined') {
  //       toastr.success(`预设"${preset.name}"已删除`);
  //     }
  //   }
  // }

  /**
   * 更新自定义预设选项
   */
  updateCustomPresetOptions() {
    const customGroup = $('#vectors_enhanced_custom_presets_group');
    customGroup.empty();

    // 总是显示自定义预设，包括默认的3个
    if (this.settings.template_presets && this.settings.template_presets.custom) {
      this.settings.template_presets.custom.forEach(preset => {
        const option = $('<option></option>')
          .attr('value', preset.id)
          .attr('title', preset.description || '')
          .text(preset.name);
        customGroup.append(option);
      });
    }
    customGroup.show();
  }

  /**
   * 更新重命名按钮的可见性
   */
  updateRenameButtonVisibility() {
    const selectedId = $('#vectors_enhanced_template_preset').val();
    const isCustom = selectedId && selectedId.startsWith('custom');
    $('#vectors_enhanced_rename_preset').toggle(isCustom);
  }

  /**
   * 初始化其他设置
   */
  initializeMiscellaneousSettings() {
    // 内容过滤黑名单
    $('#vectors_enhanced_content_blacklist')
      .val(Array.isArray(this.settings.content_blacklist) ? this.settings.content_blacklist.join('\n') : '')
      .on('input', () => {
        const blacklistText = $('#vectors_enhanced_content_blacklist').val();
        this.settings.content_blacklist = blacklistText
          .split('\n')
          .map(line => line.trim())
          .filter(line => line);
        this.updateAndSave();
      });
  }

  /**
   * 初始化UI状态
   */
  initializeUIState() {
    // 切换设置显示
    toggleSettings(this.settings);
    
    // 更新内容选择
    updateContentSelection(this.settings);
    
    // 更新聊天设置
    updateChatSettings();
    
    // 初始化通知详细选项的显示状态
    $('#vectors_enhanced_notification_details').toggle(this.settings.show_query_notification);
    
    // 隐藏进度条和重置按钮状态
    $('#vectors_enhanced_progress').hide();
    $('#vectors_enhanced_vectorize').show();
    $('#vectors_enhanced_abort').hide();
    
    // 重置进度条样式
    $('#vectors_enhanced_progress .progress-bar-inner').css('width', '0%');
    $('#vectors_enhanced_progress .progress-text').text('准备中...');
  }

  /**
   * 绑定其他事件
   */
  bindOtherEvents() {
    const { 
      toggleMessageRangeVisibility, 
      showTagExamples, 
      scanAndSuggestTags 
    } = this.dependencies;

    // 隐藏消息管理按钮
    $('#vectors_enhanced_hide_range').on('click', async () => {
      const start = Number($('#vectors_enhanced_chat_start').val()) || 0;
      const end = Number($('#vectors_enhanced_chat_end').val()) || -1;
      await toggleMessageRangeVisibility(start, end, true);
      MessageUI.updateHiddenMessagesInfo();
    });

    $('#vectors_enhanced_unhide_range').on('click', async () => {
      const start = Number($('#vectors_enhanced_chat_start').val()) || 0;
      const end = Number($('#vectors_enhanced_chat_end').val()) || -1;
      await toggleMessageRangeVisibility(start, end, false);
      MessageUI.updateHiddenMessagesInfo();
    });

    $('#vectors_enhanced_show_hidden').on('click', async () => {
      await MessageUI.showHiddenMessages();
    });

    // 标签相关按钮
    $('#vectors_enhanced_tag_examples').on('click', async () => {
      await showTagExamples();
    });

    $('#vectors_enhanced_tag_scanner').on('click', async () => {
      await scanAndSuggestTags();
    });

    // 添加新规则按钮
    $('#vectors_enhanced_add_rule').on('click', () => {
      if (!this.settings.selected_content.chat.tag_rules) {
        this.settings.selected_content.chat.tag_rules = [];
      }
      this.settings.selected_content.chat.tag_rules.push({
        type: 'include',
        value: '',
        enabled: true,
      });
      this.updateAndSave();
      renderTagRulesUI();
    });

    // 清除标签建议按钮
    $('#vectors_enhanced_clear_suggestions').on('click', () => {
      clearTagSuggestions();
    });

    // 排除小CoT按钮
    $('#vectors_enhanced_exclude_cot').on('click', () => {
      if (!this.settings.selected_content.chat.tag_rules) {
        this.settings.selected_content.chat.tag_rules = [];
      }

      const cotRule = {
        type: 'regex_exclude',
        value: '<!--[\\s\\S]*?-->',
        enabled: true,
      };

      const alreadyExists = this.settings.selected_content.chat.tag_rules.some(
        rule => rule.type === cotRule.type && rule.value === cotRule.value
      );

      if (alreadyExists) {
        toastr.info('已存在排除HTML注释的规则。');
        return;
      }

      this.settings.selected_content.chat.tag_rules.push(cotRule);
      this.updateAndSave();
      renderTagRulesUI();
      toastr.success('已添加规则：排除HTML注释');
    });

    // 掉格式兼容按钮
    $('#vectors_enhanced_format_fix').on('click', async () => {
      if (!this.settings.selected_content.chat.tag_rules) {
        this.settings.selected_content.chat.tag_rules = [];
      }

      // 弹出输入框询问标签名称
      const { callGenericPopup, POPUP_TYPE } = this.dependencies;
      const tagName = await callGenericPopup(
        '请输入要保留的标签名称（如 content）：',
        POPUP_TYPE.INPUT,
        'content',
        {
          okButton: '确认',
          cancelButton: '取消',
        }
      );

      if (!tagName || !tagName.trim()) {
        return;
      }

      const formatFixRule = {
        type: 'regex_exclude',
        value: `^[\\s\\S]*?<${tagName.trim()}>`,
        enabled: true,
      };

      const alreadyExists = this.settings.selected_content.chat.tag_rules.some(
        rule => rule.type === formatFixRule.type && rule.value === formatFixRule.value
      );

      if (alreadyExists) {
        toastr.info(`已存在删除 <${tagName}> 之前内容的规则。`);
        return;
      }

      this.settings.selected_content.chat.tag_rules.push(formatFixRule);
      this.updateAndSave();
      renderTagRulesUI();
      toastr.success(`已添加规则：删除 <${tagName}> 标签之前的所有内容`);
    });

    // 初始化标签预设管理器
    tagPresetManager.initializeEventHandlers();
  }

  /**
   * 更新设置并保存
   */
  updateAndSave() {
    const { extension_settings, saveSettingsDebounced } = this.dependencies;
    // 使用深度合并以保留嵌套对象
    this.deepMerge(extension_settings.vectors_enhanced, this.settings);
    saveSettingsDebounced();
  }
  
  /**
   * 深度合并工具函数
   */
  deepMerge(target, source) {
    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          if (!target[key] || typeof target[key] !== 'object') {
            target[key] = {};
          }
          this.deepMerge(target[key], source[key]);
        } else {
          target[key] = source[key];
        }
      }
    }
    return target;
  }

  /**
   * 初始化列表（如果启用）
   */
  async initializeLists() {
    const { updateFileList, updateWorldInfoList } = this.dependencies;

    if (this.settings.selected_content.files.enabled) {
      await updateFileList();
    }
    if (this.settings.selected_content.world_info.enabled) {
      await updateWorldInfoList();
    }
  }

  /**
   * 初始化任务列表
   */
  async initializeTaskList() {
    const { getChatTasks, renameVectorTask, removeVectorTask } = this.dependencies;
    await updateTaskList(getChatTasks, renameVectorTask, removeVectorTask);
  }

  /**
   * 初始化记忆管理UI
   */
  async initializeMemoryUI() {
    const { getContext, toastr } = this.dependencies;
    
    // 创建记忆服务
    this.memoryService = new MemoryService({
      getContext,
      eventBus,
      getRequestHeaders: this.dependencies.getRequestHeaders
    });
    
    // 创建并初始化MemoryUI组件
    this.memoryUI = new MemoryUI({
      memoryService: this.memoryService,
      toastr,
      eventBus,
      getContext,
      oai_settings: this.dependencies.oai_settings,
      settings: this.settings, // 传入settings引用
      saveSettingsDebounced: this.dependencies.saveSettingsDebounced, // 传入保存函数
      setExtensionPrompt: this.dependencies.setExtensionPrompt, // 传入注入API
      substituteParamsExtended: this.dependencies.substituteParamsExtended, // 传入模板替换API
      generateRaw: this.dependencies.generateRaw, // 传入generateRaw API
      eventSource: this.dependencies.eventSource || window.eventSource, // 传入eventSource
      event_types: this.dependencies.event_types || window.event_types, // 传入event_types
      saveChatConditional: this.dependencies.saveChatConditional, // 传入saveChatConditional
      chat_metadata: this.dependencies.chat_metadata, // 传入chat_metadata
      saveChatDebounced: this.dependencies.saveChatDebounced, // 传入saveChatDebounced
      refreshSwipeButtons: this.dependencies.refreshSwipeButtons // 传入refreshSwipeButtons
    });
    
    await this.memoryUI.init();
    
    // 暴露到全局作用域以便测试
    window.vectorsMemoryUI = this.memoryUI;
  }
  
  /**
   * 初始化实验性设置
   */
  initializeExperimentalSettings() {
    // 文本处理管道开关
    $('#vectors_enhanced_use_pipeline')
      .prop('checked', this.settings.use_pipeline || false)
      .on('change', () => {
        this.settings.use_pipeline = $('#vectors_enhanced_use_pipeline').prop('checked');
        this.updateAndSave();
        
        // Log the state change
        console.log(`Vectors Enhanced: Pipeline mode ${this.settings.use_pipeline ? 'enabled' : 'disabled'}`);
        
        // Show notification
        const message = this.settings.use_pipeline 
          ? '已启用文本处理管道 (实验性功能)' 
          : '已禁用文本处理管道，使用传统实现';
        
        // toastr is available globally in SillyTavern
        if (typeof toastr !== 'undefined') {
          toastr.info(message);
        } else {
          console.log(message);
        }
      });
  }

  /**
   * 初始化外挂任务UI
   */
  async initializeExternalTaskUI() {
    try {
      // 动态导入ExternalTaskUI - 使用完整路径解决模块加载问题
      const modulePath = '/scripts/extensions/third-party/vectors-enhanced/src/ui/components/ExternalTaskUI.js';
      const { ExternalTaskUI } = await import(modulePath);
      
      // 创建并初始化外挂任务UI
      const externalTaskUI = new ExternalTaskUI();
      
      // 使用 null 作为 taskManager（已移除）
      // 传入 null、settings 和 dependencies 对象
      await externalTaskUI.init(null, this.settings, this.dependencies);
        
        // 监听聊天切换事件以更新外挂任务列表
        if (window.eventSource) {
          window.eventSource.on('chatLoaded', async (chatId) => {
            await externalTaskUI.updateChatContext(chatId);
          });
        }
        
        // 初始更新
        try {
          const currentChatId = window.getContext?.()?.chatId;
          if (currentChatId && currentChatId !== 'null' && currentChatId !== 'undefined') {
            await externalTaskUI.updateChatContext(currentChatId);
          }
        } catch (error) {
          console.warn('Failed to get current chat context:', error);
        }
        
        // 保存引用以便后续使用
        this.externalTaskUI = externalTaskUI;
        
        console.log('External Task UI initialized successfully (legacy mode)');
    } catch (error) {
      console.error('Failed to initialize External Task UI:', error);
    }
  }

  /**
   * 初始化向量存储路径UI
   */
  async initializeVectorStoragePathUI() {
    try {
      // 动态导入VectorStoragePathUI
      const modulePath = '/scripts/extensions/third-party/vectors-enhanced/src/ui/components/VectorStoragePathUI.js';
      const { VectorStoragePathUI } = await import(modulePath);
      
      // 创建并初始化向量存储路径UI
      const vectorStoragePathUI = new VectorStoragePathUI();
      
      // 传入settings对象
      await vectorStoragePathUI.init(this.settings);
        
      // 保存引用以便后续使用
      this.vectorStoragePathUI = vectorStoragePathUI;
        
      console.log('Vector Storage Path UI initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Vector Storage Path UI:', error);
    }
  }
}