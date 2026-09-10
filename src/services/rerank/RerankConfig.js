/**
 * Configuration manager for Rerank module
 */
export class RerankConfig {
    constructor(settings) {
        this.settings = settings;
    }

    /**
     * Get rerank configuration
     * @returns {import('./RerankTypes.js').RerankConfig}
     */
    getConfig() {
        return {
            enabled: this.settings.rerank_enabled || false,
            url: this.settings.rerank_url || 'https://api.siliconflow.cn/v1/rerank',
            secretKey: this.settings.rerank_secret_key || 'api_key_vllm',
            secretId: this.settings.rerank_secret_id || '',
            model: this.settings.rerank_model || 'Pro/BAAI/bge-reranker-v2-m3',
            top_n: this.settings.rerank_top_n || 20,
            hybrid_alpha: this.settings.rerank_hybrid_alpha || 0.7,
            success_notify: this.settings.rerank_success_notify !== false,
            deduplication_enabled: this.settings.rerank_deduplication_enabled || false,
            deduplication_instruction: this.settings.rerank_deduplication_instruction || ''
        };
    }

    /**
     * Update rerank configuration
     * @param {Partial<import('./RerankTypes.js').RerankConfig>} updates
     */
    updateConfig(updates) {
        if (updates.enabled !== undefined) {
            this.settings.rerank_enabled = updates.enabled;
        }
        if (updates.url !== undefined) {
            this.settings.rerank_url = updates.url;
        }
        if (updates.secretKey !== undefined) {
            this.settings.rerank_secret_key = updates.secretKey;
        }
        if (updates.secretId !== undefined) {
            this.settings.rerank_secret_id = updates.secretId;
        }
        if (updates.model !== undefined) {
            this.settings.rerank_model = updates.model;
        }
        if (updates.top_n !== undefined) {
            this.settings.rerank_top_n = updates.top_n;
        }
        if (updates.hybrid_alpha !== undefined) {
            this.settings.rerank_hybrid_alpha = updates.hybrid_alpha;
        }
        if (updates.success_notify !== undefined) {
            this.settings.rerank_success_notify = updates.success_notify;
        }
        if (updates.deduplication_enabled !== undefined) {
            this.settings.rerank_deduplication_enabled = updates.deduplication_enabled;
        }
        if (updates.deduplication_instruction !== undefined) {
            this.settings.rerank_deduplication_instruction = updates.deduplication_instruction;
        }
    }

    /**
     * Validate configuration
     * @returns {{valid: boolean, errors: string[]}}
     */
    validateConfig() {
        const errors = [];
        const config = this.getConfig();

        if (config.enabled) {
            if (!config.url) {
                errors.push('Rerank URL is required');
            }
            if (!config.secretKey) {
                errors.push('Rerank secret type is required');
            }
            if (!config.model) {
                errors.push('Rerank model is required');
            }
            if (config.hybrid_alpha < 0 || config.hybrid_alpha > 1) {
                errors.push('Hybrid alpha must be between 0 and 1');
            }
            if (config.top_n < 1) {
                errors.push('Top N must be at least 1');
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Get default configuration
     * @returns {import('./RerankTypes.js').RerankConfig}
     */
    static getDefaultConfig() {
        return {
            enabled: false,
            url: 'https://api.siliconflow.cn/v1/rerank',
            secretKey: 'api_key_vllm',
            secretId: '',
            model: 'Pro/BAAI/bge-reranker-v2-m3',
            top_n: 20,
            hybrid_alpha: 0.7,
            success_notify: true,
            deduplication_enabled: false,
            deduplication_instruction: '执行以下操作：\n1. 对高相关文档降序排列\n2. 若两文档满足任一条件则视为同质化：\n - 核心论点重合度 > 80%\n - 包含连续5词以上完全重复段落\n - 使用相同案例/数据支撑\n3. 同质化文档仅保留最相关的一条，其余降权至后50%位置'
        };
    }
}
