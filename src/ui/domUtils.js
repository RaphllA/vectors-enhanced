/**
 * @file domUtils.js
 * @description DOM 操作工具模块，用于封装所有与UI相关的DOM操作。
 * @module ui/domUtils
 */

import { Logger } from '../utils/Logger.js';

const logger = new Logger('domUtils');

/**
 * Updates content selection UI based on settings.
 * @param {object} settings The extension settings object.
 */
export function updateContentSelection(settings) {
  $('#vectors_enhanced_chat_settings').toggle(settings.selected_content.chat.enabled);
  $('#vectors_enhanced_files_settings').toggle(settings.selected_content.files.enabled);
  $('#vectors_enhanced_wi_settings').toggle(settings.selected_content.world_info.enabled);
}

/**
 * 存放所有DOM操作相关的函数
 */
const DOMUtils = {
    // 后续将从 ui-manager.js 和其他地方迁移DOM操作函数到这里
    // 例如：createDOMElement, updateElementContent, etc.
};

export default DOMUtils;

/**
 * Updates UI state based on master switch.
 * @param {object} settings The extension settings object.
 */
export function updateMasterSwitchState(settings) {
  const isEnabled = settings.master_enabled;

  // 控制主要设置区域的显示/隐藏 - 更新为新模板的ID
  $('#vectors_enhanced_vectorization_settings').toggle(isEnabled);
  $('#vectors_enhanced_rerank_settings').toggle(isEnabled);
  $('#vectors_enhanced_injection_settings').toggle(isEnabled);
  $('#vectors_enhanced_content_settings').toggle(isEnabled);
  $('#vectors_enhanced_tasks_settings').toggle(isEnabled);
  $('#vectors_enhanced_actions_settings').toggle(isEnabled);
  $('#vectors_enhanced_experimental_settings').toggle(isEnabled);

  // 如果禁用，还需要禁用所有输入控件（作为额外保护）
  const settingsContainer = $('#vectors_enhanced_container');
  settingsContainer
    .find('input, select, textarea, button')
    .not('#vectors_enhanced_master_enabled')
    .prop('disabled', !isEnabled);

  // 更新视觉效果
  if (isEnabled) {
    settingsContainer.removeClass('vectors-disabled');
  } else {
    settingsContainer.addClass('vectors-disabled');
  }
}

/**
 * Updates UI based on vector source settings.
 * @param {object} settings The extension settings object.
 */
export function toggleSettings(settings) {
  $('#vectors_enhanced_vllm_settings').toggle(settings.source === 'vllm');
  $('#vectors_enhanced_ollama_settings').toggle(settings.source === 'ollama');
  $('#vectors_enhanced_webllm_settings').toggle(settings.source === 'webllm');
  $('#vectors_enhanced_local_settings').toggle(settings.source === 'transformers');
  $('#vectors_enhanced_transformers_settings').toggle(settings.source === 'transformers');
}

/**
 * Hides progress display
 */
export function hideProgress() {
  $('#vectors_enhanced_progress').hide();
  $('#vectors_enhanced_progress .progress-bar-inner').css('width', '0%');
  $('#vectors_enhanced_progress .progress-text').text('准备中...');
}

/**
 * Updates progress display
 * @param {number} current Current progress
 * @param {number} total Total items
 * @param {string} message Progress message
 */
export function updateProgress(current, total, message) {
  const percent = Math.round((current / total) * 100);
  $('#vectors_enhanced_progress').show();
  $('#vectors_enhanced_progress .progress-bar-inner').css('width', `${percent}%`);
  $('#vectors_enhanced_progress .progress-text').text(`${message} (${current}/${total})`);
}

/**
 * Triggers a file download in the browser
 * @param {string} content The file content
 * @param {string} filename The filename to use for download
 * @param {string} mimeType The MIME type of the file (default: 'text/plain;charset=utf-8')
 */
export function triggerDownload(content, filename, mimeType = 'text/plain;charset=utf-8') {
  logger.log(`Triggering download: ${filename}`);
  
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  logger.log('Download triggered successfully');
}
