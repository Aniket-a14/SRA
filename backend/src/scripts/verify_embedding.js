import { embedText } from "../services/embeddingService.js";
import dotenv from "dotenv";

// Ensure env vars are loaded if not already by the service
dotenv.config();

async function verify() {
    console.log("Starting embedding verification...");
    try {
        const text = "This is a test sentence for embedding verification.";
        const embedding = await embedText(text);

        if (embedding && Array.isArray(embedding) && embedding.length > 0) {
            console.log("SUCCESS: Embedding generated successfully.");
            console.log("Embedding length:", embedding.length);
            console.log("Sample:", embedding.slice(0, 5));
        } else {
            console.error("FAILURE: Embedding returned but format is invalid.", embedding);
        }
    } catch (error) {
        console.error("FAILURE: Error generating embedding:", error);
    }
}

verify();
