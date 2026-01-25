import 'dotenv/config';
import app from './app.js';


const PORT = process.env.PORT || 3000;

import { validateEnv } from './config/env.js';

// Startup Validation (Hardening)
validateEnv();

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Internal Analysis Service available at http://localhost:${PORT}/internal/analyze`);
});
