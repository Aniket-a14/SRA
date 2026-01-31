import 'dotenv/config';
import app from './app.js';


const PORT = process.env.PORT || 3000;

import { validateEnv } from './config/env.js';

// Startup Validation (Hardening)
validateEnv();

const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Internal Analysis Service available at http://localhost:${PORT}/internal/analyze`);
});

// Graceful Shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
    });
});
