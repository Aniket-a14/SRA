import { searchGoldStandardFragments } from '../services/ragService.js';
import { successResponse } from '../utils/response.js';

export const suggestReuse = async (req, res, next) => {
    try {
        const { query, type } = req.body;

        if (!query) {
            const error = new Error('Search query is required');
            error.statusCode = 400;
            throw error;
        }

        const suggestions = await searchGoldStandardFragments(query, type);

        return successResponse(res, {
            suggestions,
            count: suggestions.length
        }, "Recycling suggestions retrieved");
    } catch (error) {
        next(error);
    }
};
