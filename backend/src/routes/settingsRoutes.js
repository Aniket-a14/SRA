import express from 'express';
import { getProviderKeys, putProviderKey, removeProviderKey, verifyProviderKey, refreshProviderKeyModels } from '../controllers/settingsController.js';
import { authenticate, requireScope } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validationMiddleware.js';
import { providerKeyBodySchema, providerParamSchema, verifyProviderKeySchema } from '../utils/validationSchemas.js';

const router = express.Router();

router.use(authenticate);

// Provider keys are the user's third-party billing credentials. Reading the masked list is
// ordinary; writing, replacing or deleting one requires 'admin', so a CI key that runs
// analyses cannot swap out the credential those analyses are charged to.
router.get('/provider-keys', getProviderKeys);
router.post('/provider-keys/verify', requireScope('admin'), validate(verifyProviderKeySchema), verifyProviderKey);
router.put('/provider-keys', requireScope('admin'), validate(providerKeyBodySchema), putProviderKey);
router.post('/provider-keys/:provider/refresh', requireScope('admin'), validate(providerParamSchema), refreshProviderKeyModels);
router.delete('/provider-keys/:provider', requireScope('admin'), validate(providerParamSchema), removeProviderKey);

export default router;
