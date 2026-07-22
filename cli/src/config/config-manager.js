import fs from 'fs/promises';
import path from 'path';

class ConfigManager {
    constructor() {
        this.configPath = path.join(process.cwd(), 'sra.config.json');
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
        await this._ensureGitignored();
    }

    // sra.config.json can carry a bearer token (see CLI-01 hardening) — make sure it
    // never gets committed by accident, without requiring the user to remember to do it.
    async _ensureGitignored() {
        const gitignorePath = path.join(process.cwd(), '.gitignore');
        const entry = 'sra.config.json';

        let contents = '';
        try {
            contents = await fs.readFile(gitignorePath, 'utf-8');
        } catch {
            // No .gitignore yet — fine, we'll create one.
        }

        const alreadyIgnored = contents
            .split('\n')
            .some(line => line.trim() === entry);

        if (alreadyIgnored) return;

        const separator = contents.length > 0 && !contents.endsWith('\n') ? '\n' : '';
        await fs.appendFile(gitignorePath, `${separator}${entry}\n`);
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
