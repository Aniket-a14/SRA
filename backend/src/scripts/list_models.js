import dotenv from "dotenv";
dotenv.config({ path: './.env' });

async function checkModels() {
    if (!process.env.GEMINI_API_KEY) {
        console.error("No API KEY");
        return;
    }
    const key = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        if (data.models) {
            console.log(`Found ${data.models.length} models.`);
            console.log("First 3 models:", JSON.stringify(data.models.slice(0, 3), null, 2));

            console.log("\nSearching for embedding models:");
            const embeddingModels = data.models.filter(m =>
                m.name.includes("embed") ||
                (m.supportedGenerationMethods && m.supportedGenerationMethods.some(method => method.includes("embed")))
            );

            if (embeddingModels.length > 0) {
                embeddingModels.forEach(m => {
                    console.log(`- ${m.name} [${m.supportedGenerationMethods?.join(", ")}]`);
                });
            } else {
                console.log("No embedding models found matching criteria.");
            }
        } else {
            console.log("No models found or error:", data);
        }
    } catch (e) {
        console.error("Fetch error:", e);
    }
}

checkModels();
