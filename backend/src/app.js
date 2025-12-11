import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/authRoutes.js';
import analysisRoutes from './routes/analysisRoutes.js';
import aiEndpoint from './routes/aiEndpoint.js';
import { errorHandler } from './middleware/errorMiddleware.js';
import { logger } from './middleware/logger.js';


const app = express();

// CORS setup
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
app.use(cors({
    origin: FRONTEND_URL,
    credentials: true,
}));

app.use(express.json());
app.use(cookieParser());
app.use(logger);

// Root health check
app.get('/', (req, res) => {
    res.json({ message: 'Smart Requirements Analyzer Backend Running' });
});

// Internal AI Endpoint
// Mounted as /internal/analyze so it doesn't conflict with the main /analyze route
// Update your ANALYZER_URL env var to point here (e.g. http://localhost:3000/internal/analyze)
app.use('/internal/analyze', aiEndpoint);

// Public/Protected Routes
app.use('/auth', authRoutes);
app.use('/analyze', analysisRoutes);

// Error Handler
app.use(errorHandler);

export default app;
