/**
 * Unit tests are hermetic: no request leaves the machine.
 *
 * Every provider SDK the backend uses (Gemini, OpenAI, Anthropic, Grok via OpenAI) sends
 * through global fetch. Code under test often swallows a failed call (countTokens returns 0,
 * the alignment check used to return ALIGNED), so a thrown error alone would go unnoticed.
 * Each blocked attempt is recorded too, and the afterEach below fails the test that made it.
 *
 * A test that needs fetch mocks it with jest.spyOn(globalThis, 'fetch') or by assigning
 * globalThis.fetch; restoreMocks puts this guard back afterwards.
 */
import { afterEach } from '@jest/globals';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
const blocked = [];
const realFetch = globalThis.fetch;

const urlOf = (input) => {
    if (typeof input === 'string') return input;
    if (input instanceof URL) return input.href;
    return input?.url || String(input);
};

const guardedFetch = async (input, init) => {
    const url = urlOf(input);
    let host = '';
    try { host = new URL(url).hostname; } catch { /* relative or malformed: not external */ }
    if (host && !LOCAL_HOSTS.has(host)) {
        blocked.push(url);
        throw new Error(`Network access is blocked in unit tests (attempted: ${url})`);
    }
    return realFetch(input, init);
};

globalThis.fetch = guardedFetch;

/** For the guard's own test: read and clear what was blocked, so afterEach stays quiet. */
export const drainBlockedRequests = () => blocked.splice(0);

afterEach(() => {
    // A test that replaced fetch and did not restore it must not disable the guard for the
    // rest of the file.
    globalThis.fetch = guardedFetch;
    if (blocked.length > 0) {
        const urls = blocked.splice(0).join(', ');
        throw new Error(`Test attempted external network access: ${urls}`);
    }
});
