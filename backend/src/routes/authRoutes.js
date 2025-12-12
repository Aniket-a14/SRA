import express from 'express';
import { signup, login, googleStart, googleCallback, githubStart, githubCallback, getMe, refreshToken, logout, getSessions, revokeSessionEndpoint } from '../controllers/authController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/signup', signup);
router.post('/login', login);
router.get('/google/start', googleStart);
router.get('/google/callback', googleCallback);
router.get('/github/start', githubStart);
router.get('/github/callback', githubCallback);
router.get('/me', authenticate, getMe);
router.post('/refresh', refreshToken);
router.post('/logout', logout);
router.get('/sessions', authenticate, getSessions);
router.delete('/sessions/:sessionId', authenticate, revokeSessionEndpoint);

export default router;
