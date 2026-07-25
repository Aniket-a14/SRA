import express from 'express';
import { validateRequirements } from '../services/validationService.js';
import { resolveProviderForUser } from '../services/providers/providerKeyService.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = express.Router();

// Authenticated: this endpoint makes a real LLM call, and every LLM call is funded by the
// caller's own key. Unauthenticated it had no key to charge but the platform's — an open
// drain on the platform Gemini quota that BYOK makes unfundable anyway.
router.use(authenticate);

router.post('/', async (req, res, next) => {
    try {
        const srsData = req.body;

        if (!srsData || typeof srsData !== 'object') {
            const error = new Error("Invalid SRS Data provided.");
            error.statusCode = 400;
            throw error;
        }

        const validationResult = await validateRequirements(
            srsData,
            await resolveProviderForUser(req.user.userId, srsData?.settings)
        );
        res.json(validationResult);

    } catch (error) {
        next(error);
    }
});

export default router;
