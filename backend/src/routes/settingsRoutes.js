import express from 'express';
import { getProviderKeys, putProviderKey, removeProviderKey } from '../controllers/settingsController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validationMiddleware.js';
import { providerKeyBodySchema, providerParamSchema } from '../utils/validationSchemas.js';

const router = express.Router();

router.use(authenticate);

router.get('/provider-keys', getProviderKeys);
router.put('/provider-keys', validate(providerKeyBodySchema), putProviderKey);
router.delete('/provider-keys/:provider', validate(providerParamSchema), removeProviderKey);

export default router;
