import express from "express";
import dotenv from "dotenv";
import analyzeRoute from "./routes/analyze.js";
import cors from "cors";
import { errorHandler } from "./middleware/errorHandler.js";
import { logger } from "./middleware/logger.js";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());
app.use(logger);

app.use("/analyze", analyzeRoute);

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
