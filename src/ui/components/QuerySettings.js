/**
 * QuerySettings Component - Manages query-related settings including Rerank
 * 
 * Handles:
 * - Rerank enable/disable
 * - Rerank API configuration (URL, API Key, Model)
 * - Rerank parameters (Top N, Hybrid Alpha)
 * - Rerank notifications
 */

import { formatSecretReference, getSecretReferences, refreshSecretReferences } from '../../infrastructure/SecretReferences.js';

export class QuerySettings {
    constructor(dependencies = {}) {
        this.settings = dependencies.settings;
        this.configManager = dependencies.configManager;
        this.onSettingsChange = dependencies.onSettingsChange || (() => {});
        this.toastr = dependencies.toastr || window.toastr;
        
        // Dependencies for preview functionality
        this.callGenericPopup = dependencies.callGenericPopup;
        this.POPUP_TYPE = dependencies.POPUP_TYPE;
        this.rearrangeChat = dependencies.rearrangeChat;
        this.getContext = dependencies.getContext;
        this.getCurrentChatId = dependencies.getCurrentChatId;
        
        // Rerank configuration fields
        this.rerankFields = [
            'rerank_enabled',
            'rerank_success_notify',
            'rerank_url',
            'rerank_secret_key',
            'rerank_secret_id',
            'rerank_model',
            'rerank_top_n',
            'rerank_hybrid_alpha'
        ];
        
        this.initialized = false;
    }

    /**
     * Initialize QuerySettings component
     */
    async init() {
        if (this.initialized) {
            console.warn('QuerySettings: Already initialized');
            return;
        }

        try {
            this.bindEventListeners();
            this.loadCurrentSettings();
            await this.refreshRerankSecretOptions();
            // loadCurrentSettings() now calls updateRerankVisibility(), so no need to call it again
            this.initialized = true;
            console.log('QuerySettings: Initialized successfully');
        } catch (error) {
            console.error('QuerySettings: Initialization failed:', error);
            throw error;
        }
    }

    /**
     * Bind event listeners for query settings
     */
    bindEventListeners() {
        // Rerank enable/disable
        $('#vectors_enhanced_rerank_enabled').on('change', (e) => {
            this.handleRerankToggle(e.target.checked);
        });

        // Rerank API configuration
        $('#vectors_enhanced_rerank_url').on('input', (e) => {
            this.handleFieldChange('rerank_url', e.target.value);
        });

        $('#vectors_enhanced_rerank_secret_key').on('change', (e) => {
            delete this.settings.rerank_apiKey;
            delete this.configManager?.getAll()?.rerank_apiKey;
            this.handleFieldChange('rerank_secret_key', e.target.value);
            this.handleFieldChange('rerank_secret_id', '');
            this.populateRerankSecretOptions();
        });

        $('#vectors_enhanced_rerank_secret_id').on('change', (e) => {
            delete this.settings.rerank_apiKey;
            delete this.configManager?.getAll()?.rerank_apiKey;
            this.handleFieldChange('rerank_secret_id', e.target.value);
        });

        $('#vectors_enhanced_rerank_refresh_secrets').on('click', () => this.refreshRerankSecretOptions(true));

        $('#vectors_enhanced_rerank_model').on('input', (e) => {
            this.handleFieldChange('rerank_model', e.target.value);
        });

        // Rerank parameters
        $('#vectors_enhanced_rerank_top_n').on('input', (e) => {
            const value = parseInt(e.target.value) || 1;
            this.handleFieldChange('rerank_top_n', value);
        });

        $('#vectors_enhanced_rerank_hybrid_alpha').on('input', (e) => {
            const value = parseFloat(e.target.value) || 0;
            this.handleFieldChange('rerank_hybrid_alpha', value);
        });

        // Rerank success notification
        $('#vectors_enhanced_rerank_success_notify').on('change', (e) => {
            this.handleFieldChange('rerank_success_notify', e.target.checked);
        });

        // Query instruction settings
        $('#vectors_enhanced_query_instruction_enabled').on('change', (e) => {
            this.handleQueryInstructionToggle(e.target.checked);
        });

        $('#vectors_enhanced_query_instruction_template').on('input', (e) => {
            this.handleFieldChange('query_instruction_template', e.target.value);
        });

        // Query instruction preset selector
        $('#vectors_enhanced_query_instruction_preset').on('change', (e) => {
            this.handlePresetChange(e.target.value);
        });

        // Rerank deduplication settings
        $('#vectors_enhanced_rerank_deduplication_enabled').on('change', (e) => {
            this.handleRerankDeduplicationToggle(e.target.checked);
        });

        $('#vectors_enhanced_rerank_deduplication_instruction').on('input', (e) => {
            this.handleFieldChange('rerank_deduplication_instruction', e.target.value);
        });

        // Reset button for rerank deduplication instruction
        $('#reset_rerank_deduplication_instruction').on('click', () => {
            this.resetRerankDeduplicationInstruction();
        });

        // Preview injection button
        $('#vectors_enhanced_preview_injection').on('click', () => {
            this.previewInjectedContent();
        });

        console.log('QuerySettings: Event listeners bound');
    }

    /**
     * Handle rerank enable/disable toggle
     */
    handleRerankToggle(enabled) {
        console.log(`QuerySettings: Rerank ${enabled ? 'enabled' : 'disabled'}`);
        
        this.settings.rerank_enabled = enabled;
        this.saveSettings();
        this.updateRerankVisibility();
        
        // Validate configuration if enabled
        if (enabled) {
            this.validateRerankConfig();
        }
        
        this.onSettingsChange('rerank_enabled', enabled);
    }

    /**
     * Handle individual field changes
     */
    handleFieldChange(field, value) {
        console.log(`QuerySettings: Field ${field} changed to:`, value);
        
        this.settings[field] = value;
        this.saveSettings();
        
        // Validate on changes if rerank is enabled
        if (this.settings.rerank_enabled) {
            this.validateRerankConfig();
        }
        
        this.onSettingsChange(field, value);
    }

    /**
     * Update rerank settings visibility based on enable state
     */
    updateRerankVisibility() {
        const rerankEnabled = this.settings.rerank_enabled;
        const rerankDetails = $('#vectors_enhanced_rerank_enabled').closest('details');
        
        // 注释掉自动展开的逻辑，保持用户的折叠状态
        // if (rerankEnabled) {
        //     rerankDetails.attr('open', true);
        // }
        
        // Enable/disable rerank configuration fields
        const configFields = [
            '#vectors_enhanced_rerank_url',
            '#vectors_enhanced_rerank_secret_key',
            '#vectors_enhanced_rerank_secret_id',
            '#vectors_enhanced_rerank_refresh_secrets',
            '#vectors_enhanced_rerank_manage_secrets',
            '#vectors_enhanced_rerank_model',
            '#vectors_enhanced_rerank_top_n',
            '#vectors_enhanced_rerank_hybrid_alpha',
            '#vectors_enhanced_rerank_success_notify'
        ];
        
        configFields.forEach(fieldId => {
            const field = $(fieldId);
            if (field.length) {
                field.prop('disabled', !rerankEnabled);
                
                // Visual feedback - use proper CSS classes and opacity
                if (rerankEnabled) {
                    field.removeClass('disabled').css('opacity', '1');
                } else {
                    field.addClass('disabled').css('opacity', '0.5');
                }
            }
        });
        
        console.log(`QuerySettings: Updated rerank visibility (enabled: ${rerankEnabled})`);
    }

    async refreshRerankSecretOptions(showNotification = false) {
        try {
            await refreshSecretReferences();
            this.populateRerankSecretOptions();
            if (showNotification) {
                this.toastr.success('Rerank 密钥列表已刷新');
            }
        } catch (error) {
            console.error('QuerySettings: Failed to refresh SillyTavern secrets:', error);
            this.toastr.error('无法读取 SillyTavern 密钥列表，请确认已升级到 1.18.0');
        }
    }

    populateRerankSecretOptions() {
        const secretKey = $('#vectors_enhanced_rerank_secret_key').val() || 'api_key_vllm';
        const selectedId = this.settings.rerank_secret_id || '';
        const select = $('#vectors_enhanced_rerank_secret_id');

        select.empty().append(new Option('-- 使用该类型的 active Key --', ''));
        for (const secret of getSecretReferences(secretKey)) {
            select.append(new Option(formatSecretReference(secret), secret.id));
        }
        if (selectedId && !getSecretReferences(secretKey).some(secret => secret.id === selectedId)) {
            select.append(new Option(`[已保存但当前不可用] ${selectedId}`, selectedId));
        }
        select.val(selectedId);
        $('#vectors_enhanced_rerank_manage_secrets').attr('data-key', secretKey).data('key', secretKey);
    }


    /**
     * Handle query instruction toggle
     */
    handleQueryInstructionToggle(enabled) {
        // 检查是否已经启用了向量化查询
        if (enabled && !this.settings.enabled) {
            // 如果向量化查询未启用，则不允许启用查询增强
            this.toastr.warning('请先启用向量化查询功能');
            $('#vectors_enhanced_query_instruction_enabled').prop('checked', false);
            return;
        }
        
        console.log(`QuerySettings: Query instruction ${enabled ? 'enabled' : 'disabled'}`);
        
        this.settings.query_instruction_enabled = enabled;
        this.saveSettings();
        this.onSettingsChange('query_instruction_enabled', enabled);
        
        // 显示/隐藏查询指令设置
        if (enabled) {
            $('#query_instruction_settings').slideDown();
        } else {
            $('#query_instruction_settings').slideUp();
        }
    }

    /**
     * Handle preset change
     */
    handlePresetChange(presetKey) {
        console.log(`QuerySettings: Preset changed to: ${presetKey}`);
        
        this.settings.query_instruction_preset = presetKey;
        
        // Update template from preset
        if (this.settings.query_instruction_presets && this.settings.query_instruction_presets[presetKey]) {
            this.settings.query_instruction_template = this.settings.query_instruction_presets[presetKey];
            $('#vectors_enhanced_query_instruction_template').val(this.settings.query_instruction_template);
        }
        
        this.saveSettings();
        this.onSettingsChange('query_instruction_preset', presetKey);
        this.onSettingsChange('query_instruction_template', this.settings.query_instruction_template);
    }

    /**
     * Handle rerank deduplication toggle
     */
    handleRerankDeduplicationToggle(enabled) {
        // 检查是否已经启用了rerank
        if (enabled && !this.settings.rerank_enabled) {
            // 如果rerank未启用，则不允许启用去重
            this.toastr.warning('请先启用Rerank功能');
            $('#vectors_enhanced_rerank_deduplication_enabled').prop('checked', false);
            return;
        }
        
        console.log(`QuerySettings: Rerank deduplication ${enabled ? 'enabled' : 'disabled'}`);
        
        this.settings.rerank_deduplication_enabled = enabled;
        this.saveSettings();
        this.onSettingsChange('rerank_deduplication_enabled', enabled);
        
        // 显示/隐藏去重设置
        if (enabled) {
            $('#rerank_deduplication_settings').slideDown();
        } else {
            $('#rerank_deduplication_settings').slideUp();
        }
    }

    /**
     * Load current settings into UI elements
     */
    loadCurrentSettings() {
        console.log('QuerySettings: Loading current settings...');
        
        this.rerankFields.forEach(field => {
            const fieldId = `#vectors_enhanced_${field}`;
            const element = $(fieldId);
            
            if (element.length && this.settings[field] !== undefined) {
                if (element.attr('type') === 'checkbox') {
                    element.prop('checked', this.settings[field]);
                } else {
                    element.val(this.settings[field]);
                }
            }
        });
        
        // Load experimental settings
        const experimentalFields = [
            'query_instruction_enabled',
            'query_instruction_template',
            'query_instruction_preset',
            'rerank_deduplication_enabled',
            'rerank_deduplication_instruction'
        ];
        
        experimentalFields.forEach(field => {
            const fieldId = `#vectors_enhanced_${field}`;
            const element = $(fieldId);
            
            if (element.length && this.settings[field] !== undefined) {
                if (element.attr('type') === 'checkbox') {
                    element.prop('checked', this.settings[field]);
                } else {
                    element.val(this.settings[field]);
                }
            }
        });
        
        // 根据设置更新实验性功能的显示状态
        if (this.settings.query_instruction_enabled) {
            $('#query_instruction_settings').show();
        } else {
            $('#query_instruction_settings').hide();
        }
        
        if (this.settings.rerank_deduplication_enabled) {
            $('#rerank_deduplication_settings').show();
        } else {
            $('#rerank_deduplication_settings').hide();
        }
        
        // Update visibility after loading settings
        this.updateRerankVisibility();
        
        console.log('QuerySettings: Settings loaded');
    }

    /**
     * Validate rerank configuration
     */
    validateRerankConfig() {
        if (!this.settings.rerank_enabled) {
            return true; // No validation needed if disabled
        }

        const errors = [];
        let isValid = true;

        // Required fields for rerank
        if (!this.settings.rerank_url || this.settings.rerank_url.trim() === '') {
            errors.push('Rerank API URL is required');
            isValid = false;
        }

        if (!this.settings.rerank_secret_key || this.settings.rerank_secret_key.trim() === '') {
            errors.push('Rerank secret type is required');
            isValid = false;
        }

        if (!this.settings.rerank_model || this.settings.rerank_model.trim() === '') {
            errors.push('Rerank model is required');
            isValid = false;
        }

        // Validate numeric parameters
        if (this.settings.rerank_top_n <= 0 || this.settings.rerank_top_n > 100) {
            errors.push('Rerank Top N must be between 1 and 100');
            isValid = false;
        }

        if (this.settings.rerank_hybrid_alpha < 0 || this.settings.rerank_hybrid_alpha > 1) {
            errors.push('Rerank hybrid alpha must be between 0 and 1');
            isValid = false;
        }

        // Validate URL format
        if (this.settings.rerank_url) {
            try {
                new URL(this.settings.rerank_url);
            } catch (e) {
                errors.push('Rerank API URL must be a valid URL');
                isValid = false;
            }
        }

        if (errors.length > 0) {
            console.warn('QuerySettings: Rerank validation errors:', errors);
            this.showValidationErrors(errors);
        } else {
            this.clearValidationErrors();
        }

        return isValid;
    }

    /**
     * Show validation errors in the UI
     */
    showValidationErrors(errors) {
        // Create or update error message display
        let errorContainer = $('#vectors_enhanced_rerank_errors');
        
        if (errorContainer.length === 0) {
            errorContainer = $('<div>', {
                id: 'vectors_enhanced_rerank_errors',
                class: 'text-danger m-t-0-5',
                style: 'font-size: 0.9em;'
            });
            
            $('#vectors_enhanced_rerank_enabled').closest('details').append(errorContainer);
        }
        
        const errorHtml = errors.map(error => `<div>• ${error}</div>`).join('');
        errorContainer.html(`<strong>配置错误:</strong>${errorHtml}`).show();
    }

    /**
     * Clear validation error display
     */
    clearValidationErrors() {
        $('#vectors_enhanced_rerank_errors').hide();
    }

    /**
     * Save settings using ConfigManager
     */
    saveSettings() {
        if (this.configManager) {
            console.debug('QuerySettings: Settings saved via ConfigManager');
        } else {
            console.warn('QuerySettings: No ConfigManager available for saving');
        }
    }

    /**
     * Refresh the component - reload settings and update UI
     */
    async refresh() {
        console.log('QuerySettings: Refreshing...');
        this.loadCurrentSettings();
        this.updateRerankVisibility();
        
        if (this.settings.rerank_enabled) {
            this.validateRerankConfig();
        }
        
        console.log('QuerySettings: Refresh completed');
    }

    /**
     * Get rerank configuration status
     */
    getRerankStatus() {
        return {
            enabled: this.settings.rerank_enabled,
            configured: this.validateRerankConfig(),
            settings: this.getRerankSettings()
        };
    }

    /**
     * Get all rerank settings
     */
    getRerankSettings() {
        return {
            rerank_enabled: this.settings.rerank_enabled,
            rerank_success_notify: this.settings.rerank_success_notify,
            rerank_url: this.settings.rerank_url,
            rerank_secret_key: this.settings.rerank_secret_key,
            rerank_secret_id: this.settings.rerank_secret_id,
            rerank_model: this.settings.rerank_model,
            rerank_top_n: this.settings.rerank_top_n,
            rerank_hybrid_alpha: this.settings.rerank_hybrid_alpha
        };
    }

    /**
     * Test rerank connection (for future implementation)
     */
    async testRerankConnection() {
        if (!this.validateRerankConfig()) {
            throw new Error('Rerank configuration is invalid');
        }

        // TODO: Implement actual connection test
        console.log('QuerySettings: Testing rerank connection...');
        
        // This would make an actual API call to test the connection
        // For now, just validate the configuration
        return {
            success: true,
            message: 'Configuration appears valid (connection test not implemented)'
        };
    }

    /**
     * Reset rerank settings to defaults
     */
    resetRerankSettings() {
        console.log('QuerySettings: Resetting rerank settings...');
        
        const defaults = {
            rerank_enabled: false,
            rerank_success_notify: true,
            rerank_url: '',
            rerank_secret_key: 'api_key_vllm',
            rerank_secret_id: '',
            rerank_model: '',
            rerank_top_n: 10,
            rerank_hybrid_alpha: 0.7
        };

        Object.assign(this.settings, defaults);
        this.saveSettings();
        this.loadCurrentSettings();
        this.updateRerankVisibility();
        
        console.log('QuerySettings: Rerank settings reset to defaults');
    }

    /**
     * Reset rerank deduplication instruction to default
     */
    resetRerankDeduplicationInstruction() {
        const defaultInstruction = 'Execute the following operations:\n1. Sort documents by relevance in descending order\n2. Consider documents as duplicates if they meet ANY of these conditions:\n   - Core content overlap exceeds 60% (reduced from 80% for better precision)\n   - Contains identical continuous passages of 5+ words\n   - Shares the same examples, data points, or evidence\n3. When evaluating duplication, consider metadata differences:\n   - Different originalIndex values indicate temporal separation\n   - Different chunk numbers (chunk=X/Y) from the same entry should be preserved\n   - Different floor numbers represent different chronological positions\n   - Different world info entries or chapter markers indicate distinct contexts\n4. For identified duplicates, keep only the most relevant one, demote others to bottom 30% positions (reduced from 50% for gentler deduplication)';
        
        this.settings.rerank_deduplication_instruction = defaultInstruction;
        $('#vectors_enhanced_rerank_deduplication_instruction').val(defaultInstruction);
        
        this.saveSettings();
        this.onSettingsChange('rerank_deduplication_instruction', defaultInstruction);
        
        // Show feedback
        if (this.toastr) {
            this.toastr.success('已重置为默认去重指令');
        }
    }

    /**
     * Preview injected content with experimental features
     */
    async previewInjectedContent() {
        try {
            // 直接获取最后注入的内容
            const lastInjected = window.vectors_getLastInjectedContent ? window.vectors_getLastInjectedContent() : null;
            
            if (!lastInjected || !lastInjected.content) {
                this.toastr.info('还没有注入过任何内容，请先发送一条消息');
                return;
            }

            const capturedContent = lastInjected.content;
            const stats = lastInjected.stats || {};
            const details = lastInjected.details || null;

            // 分析内容
            const queryInstructionEnabled = stats.queryInstructionEnabled || false;
            const rerankEnabled = stats.rerankEnabled || false;
            const deduplicationEnabled = stats.deduplicationEnabled || false;
            
            // 构建显示内容
            let displayHtml = '<div style="max-height: 600px; overflow-y: auto; text-align: left;">';
            
            // 顶部信息栏 - 横向排列
            displayHtml += '<div style="margin-bottom: 15px; padding: 10px; background-color: var(--SmartThemeBlurTintColor); border-radius: 5px; display: flex; flex-wrap: wrap; gap: 20px; align-items: center;">';
            
            // 统计信息
            displayHtml += '<div style="display: flex; gap: 15px; flex-wrap: wrap;">';
            displayHtml += `<span><strong>${stats.totalChars || capturedContent.length}</strong> 字符</span>`;
            if (stats.originalQueryCount && stats.finalCount) {
                displayHtml += `<span>查询 <strong>${stats.originalQueryCount}</strong> → 注入 <strong>${stats.finalCount}</strong> 块</span>`;
            }
            if (stats.chatCount > 0) displayHtml += `<span>聊天 <strong>${stats.chatCount}</strong></span>`;
            if (stats.fileCount > 0) displayHtml += `<span>文件 <strong>${stats.fileCount}</strong></span>`;
            if (stats.worldInfoCount > 0) displayHtml += `<span>世界信息 <strong>${stats.worldInfoCount}</strong></span>`;
            displayHtml += '</div>';
            
            // 功能状态 - 只显示查询增强和rerank增强的开启状态
            displayHtml += '<div style="margin-left: auto; display: flex; gap: 10px; align-items: center; font-size: 0.9em;">';
            
            // 查询增强状态
            displayHtml += '<span style="padding: 2px 8px; border: 1px solid var(--SmartThemeBorderColor); border-radius: 3px;">查询增强: ';
            displayHtml += queryInstructionEnabled ? '<span style="color: var(--SmartThemeQuoteColor);">开启</span>' : '<span style="opacity: 0.6;">关闭</span>';
            displayHtml += '</span>';
            
            // Rerank增强状态
            displayHtml += '<span style="padding: 2px 8px; border: 1px solid var(--SmartThemeBorderColor); border-radius: 3px;">Rerank增强: ';
            displayHtml += rerankEnabled ? '<span style="color: var(--SmartThemeQuoteColor);">开启</span>' : '<span style="opacity: 0.6;">关闭</span>';
            displayHtml += '</span>';
            
            displayHtml += '</div>';
            
            displayHtml += '</div>';
            
            // 如果有详细信息，显示重排前后对比
            if (details && details.rerankApplied && details.resultsBeforeRerank && details.resultsAfterRerank) {
                displayHtml += '<div style="margin-bottom: 15px;">';
                displayHtml += '<div style="margin-bottom: 10px; font-weight: bold;">查询结果处理流程：</div>';
                
                // 使用表格显示对比 - 三列并排
                displayHtml += '<div style="display: flex; gap: 15px; margin-bottom: 15px; align-items: flex-start;">';
                
                // 重排前
                displayHtml += '<div style="flex: 1; min-width: 280px;">';
                displayHtml += '<div style="margin-bottom: 5px; font-weight: bold; font-size: 0.9em;">重排前（原始分数）</div>';
                displayHtml += '<div style="padding: 10px; border: 1px solid var(--SmartThemeBorderColor); border-radius: 5px; height: 400px; overflow-y: auto;">';
                details.resultsBeforeRerank.forEach((result, index) => {
                    displayHtml += `<div style="margin-bottom: 8px; padding: 5px; border-bottom: 1px solid var(--SmartThemeBorderColor);">`;
                    displayHtml += `<div style="margin-bottom: 3px;">`;
                    displayHtml += `<span style="font-weight: bold;">#${index + 1}</span>`;
                    displayHtml += `</div>`;
                    displayHtml += `<div style="font-size: 0.85em; opacity: 0.9; white-space: pre-wrap;">${this._escapeHtml(result.text)}</div>`;
                    displayHtml += `</div>`;
                });
                displayHtml += '</div>';
                displayHtml += '</div>';
                
                // 重排后
                displayHtml += '<div style="flex: 1; min-width: 280px;">';
                displayHtml += '<div style="margin-bottom: 5px; font-weight: bold; font-size: 0.9em;">重排后（Rerank分数）</div>';
                displayHtml += '<div style="padding: 10px; border: 1px solid var(--SmartThemeBorderColor); border-radius: 5px; height: 400px; overflow-y: auto;">';
                details.resultsAfterRerank.forEach((result, index) => {
                    displayHtml += `<div style="margin-bottom: 8px; padding: 5px; border-bottom: 1px solid var(--SmartThemeBorderColor);">`;
                    displayHtml += `<div style="margin-bottom: 3px;">`;
                    displayHtml += `<span style="font-weight: bold;">#${index + 1}</span>`;
                    displayHtml += `</div>`;
                    displayHtml += `<div style="font-size: 0.85em; opacity: 0.9; white-space: pre-wrap;">${this._escapeHtml(result.text)}</div>`;
                    displayHtml += `</div>`;
                });
                displayHtml += '</div>';
                displayHtml += '</div>';
                
                // 最终注入顺序（按originalIndex排序后）
                if (details.finalSortedResults) {
                    displayHtml += '<div style="flex: 1; min-width: 280px;">';
                    displayHtml += '<div style="margin-bottom: 5px; font-weight: bold; font-size: 0.9em;">最终注入顺序（按originalIndex排序）</div>';
                    displayHtml += '<div style="padding: 10px; border: 1px solid var(--SmartThemeBorderColor); border-radius: 5px; height: 400px; overflow-y: auto;">';
                    details.finalSortedResults.forEach((result, index) => {
                        // 解码metadata以获取类型和originalIndex
                        const decoded = this._decodeMetadataFromText(result.text);
                        const type = decoded.metadata.type || result.metadata?.type || 'unknown';
                        const originalIndex = decoded.metadata.originalIndex ?? result.metadata?.originalIndex ?? '?';
                        
                        displayHtml += `<div style="margin-bottom: 8px; padding: 5px; border-bottom: 1px solid var(--SmartThemeBorderColor);">`;
                        displayHtml += `<div style="margin-bottom: 3px;">`;
                        displayHtml += `<span style="font-weight: bold;">#${index + 1}</span>`;
                        displayHtml += ` <span style="font-size: 0.8em; color: var(--SmartThemeQuoteColor);">[${type}, idx:${originalIndex}]</span>`;
                        displayHtml += `</div>`;
                        displayHtml += `<div style="font-size: 0.85em; opacity: 0.9; white-space: pre-wrap;">${this._escapeHtml(result.text)}</div>`;
                        displayHtml += `</div>`;
                    });
                    displayHtml += '</div>';
                    displayHtml += '</div>';
                }
                
                displayHtml += '</div>';
                displayHtml += '</div>';
            } else if (!details || !details.rerankApplied) {
                // 如果没有重排，但有最终排序结果
                if (details && details.finalSortedResults) {
                    displayHtml += '<div style="margin-bottom: 15px;">';
                    displayHtml += '<div style="margin-bottom: 10px; font-weight: bold;">查询结果（按originalIndex排序）：</div>';
                    displayHtml += '<div style="padding: 10px; border: 1px solid var(--SmartThemeBorderColor); border-radius: 5px; max-height: 400px; overflow-y: auto;">';
                    details.finalSortedResults.forEach((result, index) => {
                        // 解码metadata以获取类型和originalIndex
                        const decoded = this._decodeMetadataFromText(result.text);
                        const type = decoded.metadata.type || result.metadata?.type || 'unknown';
                        const originalIndex = decoded.metadata.originalIndex ?? result.metadata?.originalIndex ?? '?';
                        
                        displayHtml += `<div style="margin-bottom: 8px; padding: 5px; border-bottom: 1px solid var(--SmartThemeBorderColor);">`;
                        displayHtml += `<div style="margin-bottom: 3px;">`;
                        displayHtml += `<span style="font-weight: bold;">#${index + 1}</span>`;
                        displayHtml += ` <span style="font-size: 0.8em; color: var(--SmartThemeQuoteColor);">[${type}, idx:${originalIndex}]</span>`;
                        displayHtml += `</div>`;
                        displayHtml += `<div style="font-size: 0.85em; opacity: 0.9; white-space: pre-wrap;">${this._escapeHtml(result.text)}</div>`;
                        displayHtml += `</div>`;
                    });
                    displayHtml += '</div>';
                    displayHtml += '</div>';
                } else {
                    // 兜底显示原始结果
                    displayHtml += '<div style="margin-bottom: 10px;">';
                    displayHtml += '<div style="margin-bottom: 5px; font-weight: bold;">查询结果：</div>';
                    displayHtml += '<pre style="white-space: pre-wrap; word-wrap: break-word; border: 1px solid var(--SmartThemeBorderColor); padding: 10px; border-radius: 5px; max-height: 400px; overflow-y: auto; margin: 0; text-align: left;">';
                    displayHtml += this._escapeHtml(capturedContent);
                    displayHtml += '</pre>';
                    displayHtml += '</div>';
                }
            }
            
            displayHtml += '</div>';

            // 显示弹窗
            if (this.callGenericPopup && this.POPUP_TYPE) {
                await this.callGenericPopup(displayHtml, this.POPUP_TYPE.TEXT, '', {
                    wide: true,
                    large: true,
                    okButton: '关闭',
                    allowHorizontalScrolling: true,
                    allowVerticalScrolling: true
                });
            } else {
                // 降级到 alert
                alert('注入内容预览:\n\n' + capturedContent);
            }
            
        } catch (error) {
            console.error('预览注入内容失败:', error);
            this.toastr.error('预览失败: ' + error.message);
        }
    }

    /**
     * Analyze injected content
     * @private
     */
    _analyzeInjectedContent(content) {
        const stats = {
            totalChars: content.length,
            chatCount: 0,
            fileCount: 0,
            worldInfoCount: 0
        };

        // Count different content types based on tags
        const chatMatches = content.match(/<past_chat>[\s\S]*?<\/past_chat>/g);
        const fileMatches = content.match(/<databank>[\s\S]*?<\/databank>/g);
        const worldInfoMatches = content.match(/<world_part>[\s\S]*?<\/world_part>/g);

        if (chatMatches) {
            // Count individual chat items within the tag
            chatMatches.forEach(match => {
                // Simple heuristic: count line breaks as rough message count
                const lines = match.split('\n').filter(line => line.trim().length > 0);
                stats.chatCount += Math.max(1, Math.floor(lines.length / 2)); // Rough estimate
            });
        }

        if (fileMatches) {
            stats.fileCount = fileMatches.length;
        }

        if (worldInfoMatches) {
            // Count individual world info items
            worldInfoMatches.forEach(match => {
                const lines = match.split('\n').filter(line => line.trim().length > 0);
                stats.worldInfoCount += Math.max(1, Math.floor(lines.length / 2)); // Rough estimate
            });
        }

        return stats;
    }

    /**
     * Escape HTML for safe display
     * @private
     */
    _escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }

    /**
     * Decode metadata from encoded text
     * @private
     * @param {string} encodedText - Text with metadata prefix
     * @returns {{text: string, metadata: {type?: string, originalIndex?: number}}}
     */
    _decodeMetadataFromText(encodedText) {
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
     * Cleanup - remove event listeners
     */
    destroy() {
        console.log('QuerySettings: Destroying...');
        
        // Remove event listeners
        this.rerankFields.forEach(field => {
            $(`#vectors_enhanced_${field}`).off('input change');
        });
        
        // Clear validation errors
        this.clearValidationErrors();
        
        this.initialized = false;
        console.log('QuerySettings: Destroyed');
    }
}
