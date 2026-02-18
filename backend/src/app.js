import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import fs from 'fs';
import yaml from 'js-yaml';
import path from 'path';
import { fileURLToPath } from 'url';

import { authLimiter, aiLimiter, apiLimiter } from './middleware/rateLimiters.js';
import { requestIdMiddleware } from './middleware/requestIdMiddleware.js';
import { errorHandler } from './middleware/errorMiddleware.js';
import { logger } from './middleware/logger.js';

import authRoutes from './routes/authRoutes.js';
import analysisRoutes from './routes/analysisRoutes.js';
import projectRoutes from './routes/projectRoutes.js';
import validationRoutes from './routes/validationRoutes.js';
import aiEndpoint from './routes/aiEndpoint.js';
import healthRoutes from './routes/healthRoutes.js';
import workerRoutes from './routes/workerRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resilient Swagger Loading
let swaggerDocument;
try {
    const swaggerPath = path.resolve(__dirname, 'swagger.yaml');
    swaggerDocument = yaml.load(fs.readFileSync(swaggerPath, 'utf8'));
} catch (e) {
    console.warn("Failed to load swagger.yaml, documentation will be unavailable", e.message);
}

import { getCSP } from './config/security.js';
import { auditLogger } from './middleware/auditLogger.js';

// ... imports remain the same

const app = express();

// Trust proxy for Render deployment
app.set('trust proxy', 1);

// CORS setup
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3001';

// Dynamic CSP based on environment
const isDev = process.env.NODE_ENV !== 'production';
app.use(helmet({
    contentSecurityPolicy: getCSP(isDev),
    crossOriginEmbedderPolicy: false,
}));

// Rate Limiter
app.use(apiLimiter);

// Global Audit Logger
app.use(auditLogger);

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

app.use('/api/health', healthRoutes);

app.use(requestIdMiddleware);
app.use(logger);

app.get('/', (req, res) => {
    res.json({
        message: 'Smart Requirements Analyzer Backend Running',
        version: '3.0.8',
        environment: process.env.NODE_ENV || 'development'
    });
});


app.get('/favicon.ico', (req, res) => res.status(204).end());

// Swagger API Documentation
if (swaggerDocument) {
    const swaggerOptions = {
        explorer: false,
        customCss: '.swagger-ui .topbar { display: none }',
        customCssUrl: 'https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.11.0/swagger-ui.css',
        customJs: [
            'https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.11.0/swagger-ui-bundle.js',
            'https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.11.0/swagger-ui-standalone-preset.js'
        ],
        customSiteTitle: "SRA API Documentation"
    };
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, swaggerOptions));
}

// Internal AI Endpoint
app.use('/internal/analyze', aiEndpoint);

// Public/Protected Routes
// Public/Protected Routes
app.use((req, res, next) => {
    // console.log(`[RAW REQUEST] ${req.method} ${req.url}`);
    next();
});

app.use(['/auth', '/api/auth'], authLimiter, authRoutes);
app.use(['/analyze', '/api/analyze'], aiLimiter, analysisRoutes);
app.use(['/projects', '/api/projects'], projectRoutes);
app.use(['/validation', '/api/validation'], validationRoutes);
app.use(['/worker', '/api/worker'], workerRoutes);


// Error Handler
app.use(errorHandler);

export default app;
