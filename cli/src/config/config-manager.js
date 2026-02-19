import fs from 'fs/promises';
import path from 'path';
import os from 'os';

class ConfigManager {
    constructor() {
        this.configPath = path.join(process.cwd(), 'sra.config.json');
        this.globalPath = path.join(os.homedir(), '.srarating'); // Hidden global config
        this.memoryConfig = null;
    }

    async load() {
        if (this.memoryConfig) return this.memoryConfig;

        let localConfig = {};
        try {
            const data = await fs.readFile(this.configPath, 'utf-8');
            localConfig = JSON.parse(data);
        } catch (e) {
            // Local config might not exist yet
        }

        this.memoryConfig = {
            ...localConfig,
            token: process.env.SRA_TOKEN || process.env.SRA_API_KEY || localConfig.token
        };
        return this.memoryConfig;
    }

    async save(config) {
        this.memoryConfig = { ...this.memoryConfig, ...config };
        await fs.writeFile(this.configPath, JSON.stringify(this.memoryConfig, null, 2));
    }

    get(key) {
        return this.memoryConfig ? this.memoryConfig[key] : null;
    }

    async exists() {
        try {
            await fs.access(this.configPath);
            return true;
        } catch {
            return false;
        }
    }
}

export const configManager = new ConfigManager();
