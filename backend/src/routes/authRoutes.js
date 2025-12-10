import express from 'express';
import { signup, login, googleStart, googleCallback, getMe } from '../controllers/authController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/signup', signup);
router.post('/login', login);
router.get('/google/start', googleStart);
router.get('/google/callback', googleCallback);
router.get('/me', authenticate, getMe);

export default router;
