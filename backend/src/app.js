import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import fs from 'fs';
import yaml from 'js-yaml';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

import { authLimiter, aiLimiter, apiLimiter } from './middleware/rateLimiters.js';
import { requestIdMiddleware } from './middleware/requestIdMiddleware.js';
import { errorHandler } from './middleware/errorMiddleware.js';
import { logger } from './middleware/logger.js';

import authRoutes from './routes/authRoutes.js';
import analysisRoutes from './routes/analysisRoutes.js';
import projectRoutes from './routes/projectRoutes.js';
import validationRoutes from './routes/validationRoutes.js';
import healthRoutes from './routes/healthRoutes.js';
import workerRoutes from './routes/workerRoutes.js';
import reuseRoutes from './routes/reuseRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import formatRoutes from './routes/formatRoutes.js';
// Note: the former unauthenticated `/internal/analyze` HTTP route was removed — it had no
// caller and exposed an expensive AI endpoint anonymously. `analyzeText` remains an
// in-process service function (used by validation/quality/refine services + controllers).

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
import { corsOriginCallback } from './config/allowedOrigins.js';
import { auditLogger } from './middleware/auditLogger.js';


const app = express();

if (process.env.NODE_ENV !== 'production') {
    // DEBUG: Log raw request URL as early as possible (dev only — this previously ran
    // unconditionally and captured OAuth `code`/`state` query params to stdout in prod).
    app.use((req, res, next) => {
        if (req.url.includes('callback')) {
            console.log('🔍 RAW REQUEST URL:', req.url);
            console.log('🔍 QUERY PARAMS:', JSON.stringify(req.query));
        }
        next();
    });
}

// Trust proxy for Render deployment
app.set('trust proxy', 1);

// CORS setup — the allowlist itself lives in config/allowedOrigins.js because the CSRF guard
// on the cookie-authenticated auth routes has to agree with it.

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
    origin: corsOriginCallback,
    credentials: true,
}));

app.use(express.json({
    limit: '15mb'
}));

app.use('/api/health', healthRoutes);

app.use(requestIdMiddleware);
app.use(logger);

// Read version from package.json
const require = createRequire(import.meta.url);
const pkg = require('../../package.json');

app.get('/', (req, res) => {
    res.json({
        message: 'Smart Requirements Analyzer Backend Running',
        version: pkg.version,
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

// Public/Protected Routes
app.use(['/auth', '/api/auth'], authLimiter, authRoutes);
app.use(['/analyze', '/api/analyze'], aiLimiter, analysisRoutes);
app.use(['/projects', '/api/projects'], projectRoutes);
app.use(['/validation', '/api/validation'], validationRoutes);
app.use(['/worker', '/api/worker'], workerRoutes);
app.use(['/reuse', '/api/reuse'], reuseRoutes);
app.use(['/settings', '/api/settings'], settingsRoutes);
app.use(['/formats', '/api/formats'], formatRoutes);


// Error Handler
app.use(errorHandler);

export default app;
