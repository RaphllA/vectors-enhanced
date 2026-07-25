function formatRanges(chatItems) {
    if (!chatItems?.length) {
        return '没有新的聊天记录';
    }

    const indices = chatItems
        .map(item => Number(item?.metadata?.index))
        .filter(Number.isFinite)
        .sort((left, right) => left - right);
    if (!indices.length) {
        return '没有新的聊天记录';
    }

    const ranges = [];
    let start = indices[0];
    let end = indices[0];
    for (let index = 1; index < indices.length; index++) {
        if (indices[index] === end + 1) {
            end = indices[index];
        } else {
            ranges.push(start === end ? `#${start}` : `#${start}-#${end}`);
            start = end = indices[index];
        }
    }
    ranges.push(start === end ? `#${start}` : `#${start}-#${end}`);
    return ranges.join('、');
}

/**
 * Generates a concise, human-readable name for a vectorization task based on its contents.
 * @param {object} task - The task object.
 * @param {Array} task.items - The array of items included in the task.
 * @returns {string} A formatted name for the task.
 */
function generateTaskName(task) {
    const items = task.items || [];
    const chatItems = items.filter(i => i.type === 'chat');
    const fileItems = items.filter(i => i.type === 'file');
    const worldInfoItems = items.filter(i => i.type === 'world_info');

    const parts = [];
    if (chatItems.length > 0) {
        parts.push(`楼层 ${formatRanges(chatItems)} (${chatItems.length}条)`);
    }
    if (fileItems.length > 0) {
        parts.push(`文件 (${fileItems.length}个)`);
    }
    if (worldInfoItems.length > 0) {
        parts.push(`世界信息 (${worldInfoItems.length}条)`);
    }

    if (parts.length === 0) {
        return '空任务';
    }
    if (parts.length > 1) {
        return `混合任务: ${parts.join('; ')}`;
    }
    return parts[0];
}

/**
 * Generates detailed HTML content for a task, listing all its items.
 * @param {object} task - The task object.
 * @param {Array} task.items - The array of items included in the task.
 * @returns {string} An HTML string to be used in a popup.
 */
function generateTaskDetailsHtml(task) {
    const items = task.items || [];
    const chatItems = items.filter(i => i.type === 'chat');
    const fileItems = items.filter(i => i.type === 'file');
    const worldInfoItems = items.filter(i => i.type === 'world_info');

    let html = '<div style="text-align: left; max-height: 400px; overflow-y: auto;">';

    if (chatItems.length > 0) {
        html += `<h4>聊天记录 (${chatItems.length}条)</h4><ul>`;
        const indices = chatItems.map(i => `#${i.metadata.index}`).join(', ');
        html += `<li>${indices}</li>`;
        html += '</ul>';
    }

    if (fileItems.length > 0) {
        html += `<h4>文件 (${fileItems.length}个)</h4><ul>`;
        fileItems.forEach(item => {
            html += `<li>${item.metadata.url}</li>`;
        });
        html += '</ul>';
    }

    if (worldInfoItems.length > 0) {
        html += `<h4>世界信息 (${worldInfoItems.length}条)</h4><ul>`;
        worldInfoItems.forEach(item => {
            html += `<li>${item.metadata.name} (UID: ${item.metadata.uid})</li>`;
        });
        html += '</ul>';
    }

    if (html === '<div style="text-align: left; max-height: 400px; overflow-y: auto;">') {
        html += '<p>此任务没有可供显示的详细信息。</p>';
    }

    html += '</div>';
    return html;
}

export {
    generateTaskName,
    generateTaskDetailsHtml,
};
