import express from "express";
import { timingSafeEqual } from 'crypto';
import { analyzeText } from "../services/aiService.js";

const router = express.Router();

const verifyInternalApiKey = (req, res, next) => {
  const expectedSecret = process.env.INTERNAL_API_SECRET;

  if (!expectedSecret) {
    if (process.env.NODE_ENV === 'production') {
      const error = new Error('Internal endpoint secret is not configured');
      error.statusCode = 500;
      return next(error);
    }

    // In dev, only allow if running with local mock queue
    if (process.env.MOCK_QSTASH === 'true') {
      return next();
    }

    const error = new Error('INTERNAL_API_SECRET or MOCK_QSTASH=true required');
    error.statusCode = 403;
    return next(error);
  }

  const providedSecret = req.headers['x-internal-api-key'];
  if (typeof providedSecret !== 'string') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const expectedBuffer = Buffer.from(expectedSecret);
  const providedBuffer = Buffer.from(providedSecret);
  const isValid = expectedBuffer.length === providedBuffer.length && timingSafeEqual(expectedBuffer, providedBuffer);

  if (!isValid) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  return next();
};

router.use(verifyInternalApiKey);

router.post("/", async (req, res, next) => {
  try {
    const { text, settings } = req.body;

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      const error = new Error("Text input required and must be a non-empty string.");
      error.statusCode = 400;
      throw error;
    }

    const response = await analyzeText(text, settings);

    if (!response.success) {
      const error = new Error(response.error || "AI Analysis Failed");
      error.statusCode = 500;
      throw error;
    }

    res.json({ srs: response.srs, meta: response.meta });
  } catch (error) {
    next(error);
  }
});

export default router;
