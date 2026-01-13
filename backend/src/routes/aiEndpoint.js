import express from "express";
import { analyzeText } from "../services/aiService.js";

const router = express.Router();

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
