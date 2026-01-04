import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.GEMINI_API_KEY && process.env.MOCK_AI !== 'true') {
  throw new Error("GEMINI_API_KEY is missing in .env");
}

export const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
