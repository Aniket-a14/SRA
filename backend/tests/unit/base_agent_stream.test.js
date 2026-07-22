import { describe, it, expect, afterEach } from '@jest/globals';
import { BaseAgent } from '../../src/agents/BaseAgent.js';

async function drain(generator) {
    const chunks = [];
    for await (const chunk of generator) chunks.push(chunk);
    return chunks;
}

describe('BaseAgent.streamText', () => {
    const originalMockAi = process.env.MOCK_AI;

    afterEach(() => {
        process.env.MOCK_AI = originalMockAi;
    });

    it('yields the mocked reply word-by-word in MOCK_AI mode', async () => {
        process.env.MOCK_AI = 'true';
        const agent = new BaseAgent('Test Agent');

        const chunks = await drain(agent.streamText('prompt', { mockText: 'Hello world' }));

        expect(chunks.join('')).toBe('Hello world ');
        expect(chunks.length).toBe(2);
    });

    it('delegates to the adapter and yields its chunks', async () => {
        process.env.MOCK_AI = 'false';
        const agent = new BaseAgent('Test Agent', { provider: 'gemini' });

        agent.getAdapter = () => ({
            generateContentStream: async function* () {
                yield 'chunk-1 ';
                yield 'chunk-2';
            }
        });

        const chunks = await drain(agent.streamText('prompt'));
        expect(chunks).toEqual(['chunk-1 ', 'chunk-2']);
    });

    it('wraps an adapter streaming failure in a named error', async () => {
        process.env.MOCK_AI = 'false';
        const agent = new BaseAgent('Test Agent', { provider: 'gemini' });

        agent.getAdapter = () => ({
            generateContentStream: async function* () {
                throw new Error('upstream exploded');
                // eslint-disable-next-line no-unreachable
                yield 'unreachable';
            }
        });

        await expect(drain(agent.streamText('prompt'))).rejects.toThrow('Test Agent failed to stream content: upstream exploded');
    });
});
