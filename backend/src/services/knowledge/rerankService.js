/**
 * In-Process Cross-Encoder & Reciprocal Rank Fusion (RRF) Reranker.
 * Combines dense vector similarities with lexical BM25/keyword rank to produce
 * high-precision relevance scores without requiring paid external APIs.
 */

const RRF_K = 60;

/**
 * Calculates Reciprocal Rank Fusion scores across multiple ranked lists.
 * @param {Array<{id: string, similarity?: number, lexicalRank?: number, qualityScore?: number}>} denseList
 * @param {Array<{id: string, similarity?: number, lexicalRank?: number, qualityScore?: number}>} sparseList
 */
export function reciprocalRankFusion(denseList = [], sparseList = [], weights = { dense: 1.0, sparse: 0.8 }) {
    const scores = new Map();
    const itemMap = new Map();

    denseList.forEach((item, rank) => {
        itemMap.set(item.id, item);
        const currentScore = scores.get(item.id) || 0;
        scores.set(item.id, currentScore + weights.dense / (RRF_K + rank + 1));
    });

    sparseList.forEach((item, rank) => {
        itemMap.set(item.id, itemMap.get(item.id) || item);
        const currentScore = scores.get(item.id) || 0;
        scores.set(item.id, currentScore + weights.sparse / (RRF_K + rank + 1));
    });

    const results = [];
    scores.forEach((rrfScore, id) => {
        const item = itemMap.get(id);
        const qualityBoost = item.qualityScore ? Math.min(0.15, item.qualityScore * 0.1) : 0;
        results.push({
            ...item,
            finalScore: rrfScore + qualityBoost,
        });
    });

    return results.sort((a, b) => b.finalScore - a.finalScore);
}
