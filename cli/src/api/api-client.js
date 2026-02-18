import axios from 'axios';
import { configManager } from '../config/config-manager.js';
import { logger } from '../utils/logger.js';

class ApiClient {
    constructor() {
        this.client = axios.create({
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'SRA-CLI/Enterprise'
            }
        });

        this._setupInterceptors();
    }

    _setupInterceptors() {
        // Request Interceptor: Inject Token & BaseURL
        this.client.interceptors.request.use(async (config) => {
            const sraConfig = await configManager.load();

            // Priority: Local Config > Env Var > Default
            if (!config.baseURL) {
                config.baseURL = sraConfig.backendUrl || process.env.SRA_BACKEND_URL || 'https://sra-backend-six.vercel.app';
            }

            // Authentication Fallback
            const token = sraConfig.token || process.env.SRA_API_KEY;
            if (token && !config.headers.Authorization) {
                config.headers.Authorization = `Bearer ${token}`;
            }

            logger.debug(`Outgoing Request: ${config.method.toUpperCase()} ${config.url}`);
            return config;
        });

        // Response Interceptor: Global Error Handling
        this.client.interceptors.response.use(
            (response) => {
                logger.debug(`Response received from ${response.config.url}`);
                return response.data; // Flatten response
            },
            (error) => {
                if (error.response) {
                    const { status, data } = error.response;
                    if (status === 401) {
                        logger.error('Authentication Failed: Your token/API key is invalid or expired.');
                    } else if (status === 429) {
                        logger.error('Rate Limit Exceeded: Please slow down your requests.');
                    } else {
                        logger.error(`Server Error (${status}):`, data.message || error.message);
                    }
                } else if (error.code === 'ECONNREFUSED') {
                    logger.error('Connection Refused: Backend server is unreachable.');
                } else {
                    logger.error('Network Error:', error.message);
                }
                return Promise.reject(error);
            }
        );
    }

    async get(url, config = {}) {
        return this.client.get(url, config);
    }

    async post(url, data, config = {}) {
        return this.client.post(url, data, config);
    }

    async put(url, data, config = {}) {
        return this.client.put(url, data, config);
    }
}

export const api = new ApiClient();
