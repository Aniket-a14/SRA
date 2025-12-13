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

    res.json(response);
  } catch (error) {
    next(error);
  }
});

export default router;
