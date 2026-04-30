import { extension_settings } from '../../../../../../extensions.js';
import { saveSettingsDebounced } from '../../../../../../../script.js';
import { callGenericPopup, POPUP_TYPE, POPUP_RESULT } from '../../../../../../popup.js';
import { renderTagRulesUI } from './TagRulesEditor.js';

/**
 * Tag preset manager for saving and switching between different tag rule configurations
 */
export class TagPresetManager {
    constructor() {
        this.localSettings = null;
        this.initializePresets();
    }

    /**
     * Initialize preset storage if not exists
     */
    initializePresets() {
        // 首先确保 vectors_enhanced 设置对象存在
        if (!extension_settings.vectors_enhanced) {
            extension_settings.vectors_enhanced = {};
        }

        // 然后再安全地检查和初始化 tagPresets
        if (!extension_settings.vectors_enhanced.tagPresets) {
            extension_settings.vectors_enhanced.tagPresets = {
                presets: {},
                activePresetId: null
            };
            saveSettingsDebounced();
        }
    }

    /**
     * Save current tag rules as a new preset
     */
    async saveCurrentAsPreset() {
        const presetName = await callGenericPopup(
            '输入预设名称：',
            POPUP_TYPE.INPUT,
            '',
            { okButton: '保存', cancelButton: '取消' }
        );

        if (!presetName || !presetName.trim()) {
            return;
        }

        const presetId = `preset_${Date.now()}`;
        const currentRules = extension_settings.vectors_enhanced.selected_content.chat.tag_rules || [];
        const applyToFirstMessage = extension_settings.vectors_enhanced.selected_content.chat.apply_tags_to_first_message || false;

        extension_settings.vectors_enhanced.tagPresets.presets[presetId] = {
            id: presetId,
            name: presetName.trim(),
            rules: JSON.parse(JSON.stringify(currentRules)), // Deep copy
            applyToFirstMessage: applyToFirstMessage,
            createdAt: Date.now()
        };

        extension_settings.vectors_enhanced.tagPresets.activePresetId = presetId;
        saveSettingsDebounced();
        this._syncToLocalSettings();

        this.updatePresetSelector();
        toastr.success(`预设 "${presetName}" 已保存`);
    }

    /**
     * Load a preset by ID
     */
    loadPreset(presetId) {
        if (!presetId) {
            this._clearActivePresetState();
        } else {
            const preset = extension_settings.vectors_enhanced.tagPresets.presets[presetId];
            if (!preset) {
                toastr.error('预设不存在');
                return;
            }

            extension_settings.vectors_enhanced.selected_content.chat.tag_rules = JSON.parse(JSON.stringify(preset.rules));
            extension_settings.vectors_enhanced.selected_content.chat.apply_tags_to_first_message = preset.applyToFirstMessage;
            extension_settings.vectors_enhanced.tagPresets.activePresetId = presetId;
        }

        saveSettingsDebounced();
        this._syncToLocalSettings();
        renderTagRulesUI();

        // Update checkbox state
        $('#vectors_enhanced_apply_tags_to_first_message').prop('checked',
            extension_settings.vectors_enhanced.selected_content.chat.apply_tags_to_first_message);
    }

    /**
     * Rename an existing preset
     */
    async renamePreset(presetId) {
        const preset = extension_settings.vectors_enhanced.tagPresets.presets[presetId];
        if (!preset) {
            toastr.error('预设不存在');
            return;
        }

        const newName = await callGenericPopup(
            '输入新的预设名称：',
            POPUP_TYPE.INPUT,
            preset.name,
            { okButton: '确定', cancelButton: '取消' }
        );

        if (!newName || !newName.trim() || newName.trim() === preset.name) {
            return;
        }

        preset.name = newName.trim();
        saveSettingsDebounced();
        this._syncToLocalSettings();
        this.updatePresetSelector();
        toastr.success(`预设已重命名为 "${newName}"`);
    }

    /**
     * Set reference to local settings for bidirectional sync.
     * Called from index.js after initialization.
     */
    setLocalSettings(settings) {
        this.localSettings = settings;
    }

    /**
     * Sync tagPresets and selected_content from extension_settings
     * back to local settings. This prevents the dual-object overwrite
     * bug where stale local settings overwrite extension_settings changes.
     */
    _syncToLocalSettings() {
        if (!this.localSettings) {
            console.warn('TagPresetManager: _syncToLocalSettings skipped - localSettings not set');
            return;
        }
        if (extension_settings.vectors_enhanced?.tagPresets) {
            this.localSettings.tagPresets = extension_settings.vectors_enhanced.tagPresets;
        }
        if (extension_settings.vectors_enhanced?.selected_content) {
            this.localSettings.selected_content = extension_settings.vectors_enhanced.selected_content;
        }
    }

    /**
     * Clear the active preset state back to defaults
     */
    _clearActivePresetState() {
        extension_settings.vectors_enhanced.tagPresets.activePresetId = null;
        extension_settings.vectors_enhanced.selected_content.chat.tag_rules = [];
        extension_settings.vectors_enhanced.selected_content.chat.apply_tags_to_first_message = false;
    }

    /**
     * Delete an existing preset
     */
    async deletePreset(presetId) {
        if (!presetId) {
            toastr.error('未选择预设');
            return;
        }
        const presets = extension_settings.vectors_enhanced.tagPresets?.presets;
        if (!presets || !presets[presetId]) {
            toastr.error('预设不存在');
            return;
        }
        const presetName = presets[presetId].name;
        const confirm = await callGenericPopup(
            `确定要删除预设 "${presetName}" 吗？此操作不可撤销。`,
            POPUP_TYPE.CONFIRM,
            '',
            { okButton: '删除', cancelButton: '取消' }
        );
        if (confirm !== POPUP_RESULT.AFFIRMATIVE) return;

        const wasActive = (extension_settings.vectors_enhanced.tagPresets.activePresetId === presetId);
        delete presets[presetId];

        if (wasActive) {
            this._clearActivePresetState();
        }

        saveSettingsDebounced();
        this._syncToLocalSettings();
        this.updatePresetSelector();

        if (wasActive) {
            renderTagRulesUI();
            $('#vectors_enhanced_apply_tags_to_first_message').prop('checked', false);
        }
        toastr.success(`预设 "${presetName}" 已删除`);
    }

    /**
     * Update the preset selector dropdown
     */
    updatePresetSelector() {
        const selector = $('#vectors_enhanced_tag_preset_selector');
        selector.empty();

        // Add default option
        selector.append('<option value="">默认规则</option>');

        // Add all presets
        const presets = extension_settings.vectors_enhanced.tagPresets.presets;
        for (const presetId in presets) {
            const preset = presets[presetId];
            const option = $('<option>')
                .val(presetId)
                .text(preset.name);

            if (extension_settings.vectors_enhanced.tagPresets.activePresetId === presetId) {
                option.prop('selected', true);
            }

            selector.append(option);
        }

        // Update rename button visibility
        this.updateRenameButtonVisibility();
    }

    /**
     * Update rename button visibility based on current selection
     */
    updateRenameButtonVisibility() {
        const activePresetId = extension_settings.vectors_enhanced.tagPresets.activePresetId;
        const renameButton = $('#vectors_enhanced_tag_preset_rename');
        const deleteButton = $('#vectors_enhanced_tag_preset_delete');

        if (activePresetId && activePresetId !== '') {
            renameButton.show();
            deleteButton.show();
        } else {
            renameButton.hide();
            deleteButton.hide();
        }
    }

    /**
     * Initialize event handlers
     */
    initializeEventHandlers() {
        // Save preset button
        $('#vectors_enhanced_tag_preset_save').off('click').on('click', () => {
            this.saveCurrentAsPreset();
        });

        // Rename preset button
        $('#vectors_enhanced_tag_preset_rename').off('click').on('click', () => {
            const activePresetId = extension_settings.vectors_enhanced.tagPresets.activePresetId;
            if (activePresetId) {
                this.renamePreset(activePresetId);
            }
        });

        // Delete preset button
        $('#vectors_enhanced_tag_preset_delete').off('click').on('click', () => {
            const activePresetId = extension_settings.vectors_enhanced.tagPresets.activePresetId;
            if (activePresetId) {
                this.deletePreset(activePresetId);
            }
        });

        // Preset selector change
        $('#vectors_enhanced_tag_preset_selector').off('change').on('change', (e) => {
            const selectedPresetId = $(e.target).val();
            this.loadPreset(selectedPresetId);
            this.updateRenameButtonVisibility();
        });

        // Initialize selector on load
        this.updatePresetSelector();
    }
}

// Export a singleton instance
export const tagPresetManager = new TagPresetManager();
