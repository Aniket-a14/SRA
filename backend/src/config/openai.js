import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

export const openai = process.env.OPENAI_API_KEY
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    : null;
