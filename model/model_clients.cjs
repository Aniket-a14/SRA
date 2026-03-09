/**
 * HARDENED MODEL CLIENT ADAPTERS
 * Includes: 
 * 1. Exponential Backoff for 429s.
 * 2. Usage Tracking (Tokens/Costs).
 * 3. Robust Error Logging.
 */

const axios = require('axios');
require('dotenv').config();

const LOCAL_URL = process.env.LOCAL_INFERENCE_URL; // e.g., "http://localhost:8000/v1" or "http://127.0.0.1:11434/v1"

const MODEL_ENDPOINTS = {
    "DeepSeek V4": LOCAL_URL || process.env.DEEPSEEK_API_URL || "https://api.deepseek.com/v1",
    "Kimi K2.5": LOCAL_URL || process.env.KIMI_API_URL || "https://api.moonshot.cn/v1",
    "GLM-5": LOCAL_URL || process.env.GLM_API_URL || "https://open.bigmodel.cn/api/paas/v4",
    "Qwen 3.5": LOCAL_URL || process.env.QWEN_API_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1",
    "LLaMA 4 Maverick": LOCAL_URL || process.env.LLAMA_API_URL || "http://localhost:8000/v1"
};

const API_KEYS = {
    "DeepSeek V4": process.env.DEEPSEEK_API_KEY,
    "Kimi K2.5": process.env.KIMI_API_KEY,
    "GLM-5": process.env.GLM_API_KEY,
    "Qwen 3.5": process.env.QWEN_API_KEY,
    "LLaMA 4 Maverick": process.env.LLAMA_API_KEY || "dummy"
};

const MODEL_MAPPING = {
    "DeepSeek V4": "deepseek-chat",
    "Kimi K2.5": "moonshot-v1-8k",
    "GLM-5": "glm-4",
    "Qwen 3.5": "qwen-max",
    "LLaMA 4 Maverick": "llama-4-maverick"
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function callWithRetry(modelName, messages, temperature = 0.1, retries = 5) {
    const url = MODEL_ENDPOINTS[modelName];
    const apiKey = API_KEYS[modelName];
    const modelId = MODEL_MAPPING[modelName];

    for (let i = 0; i < retries; i++) {
        try {
            const response = await axios.post(`${url}/chat/completions`, {
                model: modelId,
                messages: messages,
                temperature: temperature,
                response_format: { type: "json_object" }
            }, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 180000
            });

            return {
                content: response.data.choices[0].message.content,
                usage: response.data.usage || { prompt_tokens: 0, completion_tokens: 0 },
                success: true
            };
        } catch (error) {
            const status = error.response ? error.response.status : 0;
            if (status === 429 && i < retries - 1) {
                const delay = Math.pow(2, i) * 1000 + Math.random() * 1000;
                console.warn(`    [Client] 429 Rate Limit for ${modelName}. Retrying in ${Math.round(delay)}ms...`);
                await sleep(delay);
                continue;
            }
            throw error;
        }
    }
}

async function callModel(modelName, prompt, systemPrompt = "", temperature = 0.1) {
    const startTime = Date.now();
    const messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
    ];

    try {
        const result = await callWithRetry(modelName, messages, temperature);
        const latency = Date.now() - startTime;
        return {
            ...result,
            latency: latency
        };
    } catch (error) {
        const latency = Date.now() - startTime;
        return {
            error: error.message,
            latency: latency,
            success: false
        };
    }
}

module.exports = { callModel, MODELS: Object.keys(MODEL_ENDPOINTS) };
