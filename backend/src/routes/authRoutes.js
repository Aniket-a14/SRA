import express from 'express';
import { signup, login, googleStart, googleCallback, githubStart, githubCallback, getMe, refreshToken, logout, getSessions, revokeSessionEndpoint } from '../controllers/authController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validationMiddleware.js';
import { signupSchema, loginSchema } from '../utils/validationSchemas.js';

const router = express.Router();

router.post('/signup', validate(signupSchema), signup);
router.post('/login', validate(loginSchema), login);
router.get('/google/start', googleStart);
router.get('/google/callback', googleCallback);
router.get('/github/start', githubStart);
router.get('/github/callback', githubCallback);
router.get('/me', authenticate, getMe);
router.post('/refresh', refreshToken);
router.post('/logout', logout);
router.get('/sessions', authenticate, getSessions);
router.delete('/sessions/:sessionId', authenticate, revokeSessionEndpoint);

import { createKey, listKeys, revokeKey } from '../controllers/apiKeyController.js';

router.post('/keys', authenticate, createKey);
router.get('/keys', authenticate, listKeys);
router.delete('/keys/:id', authenticate, revokeKey);

export default router;
