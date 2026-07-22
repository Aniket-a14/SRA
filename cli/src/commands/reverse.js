import { logger } from '../utils/logger.js';

export async function reverse() {
    logger.warn('sra reverse is not implemented yet (Roadmap v4.0) — it currently does nothing.');
    logger.info('Track progress or contribute at the SRA repository.');
    // Non-zero exit so scripts/CI invoking this don't mistake a no-op for success.
    process.exitCode = 1;
}
