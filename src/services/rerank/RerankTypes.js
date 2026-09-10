/**
 * Type definitions for the Rerank module
 * @typedef {Object} RerankConfig
 * @property {boolean} enabled - Whether rerank is enabled
 * @property {string} url - Rerank API URL
 * @property {string} secretKey - SillyTavern secret type
 * @property {string} secretId - Optional SillyTavern secret UUID; active key when empty
 * @property {string} model - Model to use for reranking
 * @property {number} top_n - Number of top results to return
 * @property {number} hybrid_alpha - Weight for hybrid scoring (0-1)
 * @property {boolean} success_notify - Whether to show success notifications
 * @property {boolean} deduplication_enabled - Whether to enable deduplication
 * @property {string} deduplication_instruction - Instruction for deduplication
 */

/**
 * @typedef {Object} RerankRequest
 * @property {string} query - The query text
 * @property {string[]} documents - Array of document texts
 * @property {string} model - Model to use
 * @property {number} top_n - Number of results to return
 * @property {string} [instruct] - Optional instruction for deduplication
 */

/**
 * @typedef {Object} RerankResult
 * @property {number} index - Original document index
 * @property {number} relevance_score - Relevance score from rerank
 * @property {number} [score] - Alternative score field (for compatibility)
 */

/**
 * @typedef {Object} RerankResponse
 * @property {RerankResult[]} results - Array of reranked results
 */

/**
 * @typedef {Object} RerankItem
 * @property {string} text - The text content
 * @property {number} score - Original similarity score
 * @property {Object} metadata - Additional metadata
 * @property {number} [hybrid_score] - Calculated hybrid score
 * @property {number} [rerank_score] - Score from rerank API
 * @property {number} [original_score] - Original score before rerank
 */

export { };
