import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/authRoutes.js';
import analysisRoutes from './routes/analysisRoutes.js';
import projectRoutes from './routes/projectRoutes.js';
import validationRoutes from './routes/validationRoutes.js';
import aiEndpoint from './routes/aiEndpoint.js';
import { errorHandler } from './middleware/errorMiddleware.js';
import { logger } from './middleware/logger.js';


const app = express();

// Trust proxy for Render deployment
app.set('trust proxy', 1);

// CORS setup
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

app.use(helmet());

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 150, // Increased for dev: Limit each IP to 5000 requests per `window`
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});
app.use(limiter);

app.use(cors({
    origin: FRONTEND_URL,
    credentials: true,
}));

app.use(express.json({
    limit: '10mb',
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
})); // Increase limit for large SRS data
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
// Public/Protected Routes
app.use(['/auth', '/api/auth'], authRoutes);
app.use(['/analyze', '/api/analyze'], analysisRoutes);
app.use(['/projects', '/api/projects'], projectRoutes);
import workerRoutes from './routes/workerRoutes.js';

app.use(['/validation', '/api/validation'], validationRoutes);
app.use(['/worker', '/api/worker'], workerRoutes);


// Error Handler
app.use(errorHandler);

export default app;
