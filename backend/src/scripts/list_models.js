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

            console.log("\nSearching for generative models:");
            const genModels = data.models.filter(m =>
                m.supportedGenerationMethods && m.supportedGenerationMethods.includes("generateContent")
            );

            if (genModels.length > 0) {
                genModels.forEach(m => {
                    console.log(`- ${m.name} [${m.supportedGenerationMethods?.join(", ")}]`);
                });
            } else {
                console.log("No generative models found.");
            }
        } else {
            console.log("No models found or error:", data);
        }
    } catch (e) {
        console.error("Fetch error:", e);
    }
}

checkModels();
