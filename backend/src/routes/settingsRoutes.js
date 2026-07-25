import express from 'express';
import { getProviderKeys, putProviderKey, removeProviderKey, verifyProviderKey, refreshProviderKeyModels } from '../controllers/settingsController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validationMiddleware.js';
import { providerKeyBodySchema, providerParamSchema, verifyProviderKeySchema } from '../utils/validationSchemas.js';

const router = express.Router();

router.use(authenticate);

router.get('/provider-keys', getProviderKeys);
router.post('/provider-keys/verify', validate(verifyProviderKeySchema), verifyProviderKey);
router.put('/provider-keys', validate(providerKeyBodySchema), putProviderKey);
router.post('/provider-keys/:provider/refresh', validate(providerParamSchema), refreshProviderKeyModels);
router.delete('/provider-keys/:provider', validate(providerParamSchema), removeProviderKey);

export default router;
