import 'dotenv/config';
import app from './app.js';
import './workers/analysisWorker.js'; // Start background worker

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Internal Analysis Service available at http://localhost:${PORT}/internal/analyze`);
});
