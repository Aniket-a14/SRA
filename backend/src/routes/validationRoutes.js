import express from 'express';
import { validateRequirements } from '../services/validationService.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(authenticate);

router.post('/', async (req, res, next) => {
    try {
        const srsData = req.body;

        if (!srsData || typeof srsData !== 'object') {
            const error = new Error("Invalid SRS Data provided.");
            error.statusCode = 400;
            throw error;
        }

        const validationResult = await validateRequirements(srsData);
        res.json(validationResult);

    } catch (error) {
        next(error);
    }
});

export default router;
