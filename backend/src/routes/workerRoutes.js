import express from 'express';
import { processJob, reconcileJobs } from '../controllers/workerController.js';
import { Receiver } from "@upstash/qstash";
import { log } from '../middleware/logger.js';
import { aiLimiter, apiLimiter } from '../middleware/rateLimiters.js';

const router = express.Router();

const receiver = new Receiver({
    currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY,
    nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY,
});

// Middleware to verify QStash signature
const verifyQStash = async (req, res, next) => {
    // In dev without QStash signatures, verify using a shared secret
    if (process.env.NODE_ENV === 'development' && !req.headers['upstash-signature']) {
        const devToken = req.headers['x-worker-secret'];
        if (devToken === process.env.QSTASH_TOKEN || process.env.MOCK_QSTASH === 'true') {
            return next();
        }
        log.error("Worker endpoint called in dev without valid x-worker-secret header");
        return res.status(401).send("Unauthorized: Missing worker secret");
    }

    const signature = req.headers["upstash-signature"];
    const body = req.rawBody ? req.rawBody.toString() : "";

    // Derive from the actual request path (not hardcoded to /process) so this
    // middleware verifies correctly on every route it's mounted on, e.g. /reconcile —
    // QStash signs each scheduled call against its real destination URL.
    const baseUrl = process.env.BACKEND_URL.replace(/\/$/, "");
    const url = `${baseUrl}${req.originalUrl}`;

    try {
        const isValid = await receiver.verify({
            signature,
            body,
            url
        });

        if (!isValid) {
            log.error("QStash signature verification failed");
            return res.status(401).send("Invalid Signature");
        }
        next();
    } catch (err) {
        log.error({ msg: "QStash Verification Failed", error: err.message });
        res.status(401).send("Invalid Signature");
    }
};

router.post('/process', aiLimiter, verifyQStash, processJob);
router.post('/reconcile', apiLimiter, verifyQStash, reconcileJobs);

export default router;
