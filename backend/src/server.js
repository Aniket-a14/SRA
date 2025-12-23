import 'dotenv/config';
import app from './app.js';


const PORT = process.env.PORT || 3000;

// Startup Validation
const requiredEnv = ['GEMINI_API_KEY', 'DATABASE_URL', 'JWT_SECRET'];
const missingEnv = requiredEnv.filter(env => !process.env[env]);
if (missingEnv.length > 0) {
    console.error(`FATAL: Missing required environment variables: ${missingEnv.join(', ')}`);
    process.exit(1);
}

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Internal Analysis Service available at http://localhost:${PORT}/internal/analyze`);
});
