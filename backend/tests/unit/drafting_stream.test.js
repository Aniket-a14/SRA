import { BaseAgent } from '../../src/agents/BaseAgent.js';
import { createTokenBroadcaster } from '../../src/services/pipeline/tokenStream.js';

// The drafting stream end to end, minus Redis: a real agent call through the broadcaster.
describe('drafting token stream', () => {
    const collect = async () => {
        const events = [];
        const emitProgress = (stage, message, extra) => events.push({ stage, message, ...extra });
        const tokens = createTokenBroadcaster(emitProgress);

        const agent = new BaseAgent('Test Developer');
        const result = await agent.callLLM('draft something', 0.7, true, null, 3, 5000, {
            onStream: tokens.onStream
        });
        tokens.flush();

        return { events, result, text: events.map(e => e.token || '').join('') };
    };

    it('publishes the prose of the answer as it arrives', async () => {
        const { events, text } = await collect();

        expect(events.length).toBeGreaterThan(0);
        expect(text).toContain('Mocked purpose');
        expect(text).toContain('Mock Feature');
        expect(text).toContain('This is a mock description.');
    });

    it('publishes no JSON syntax and no field names', async () => {
        const { text } = await collect();

        expect(text).not.toMatch(/[{}[\]"]/);
        expect(text).not.toContain('projectTitle');
        expect(text).not.toContain('scopeSummary');
        expect(text).not.toContain('nonFunctionalRequirements');
    });

    it('still returns the parsed object the pipeline needs', async () => {
        // Streaming is a view onto the call, not a replacement for it.
        const { result } = await collect();

        expect(result.projectTitle).toBe('Mocked Project');
        expect(result.features[0].name).toBe('Mock Feature');
    });

    it('token frames carry no stage message, so they cannot displace the stage label', async () => {
        const { events } = await collect();
        const tokenFrames = events.filter(e => typeof e.token === 'string');

        expect(tokenFrames.length).toBeGreaterThan(0);
        for (const frame of tokenFrames) {
            expect(frame.message).toBeUndefined();
        }
    });

    it('a reset tells the client to drop what an abandoned attempt drew', async () => {
        const events = [];
        const tokens = createTokenBroadcaster((stage, message, extra) => events.push({ stage, message, ...extra }));

        tokens.onStream({ type: 'delta', text: '{"name":"Half a sen' });
        tokens.onStream({ type: 'reset' });
        tokens.onStream({ type: 'delta', text: '{"name":"Restarted"}' });
        tokens.flush();

        expect(events.some(e => e.tokenReset)).toBe(true);
        const afterReset = events.slice(events.findIndex(e => e.tokenReset) + 1);
        expect(afterReset.map(e => e.token || '').join('')).toBe('Restarted\n');
    });

    it('newDocument keeps finished text but clears scanner state between sections', async () => {
        // A section ending mid-string must not leave the next one trapped inside that string.
        const events = [];
        const tokens = createTokenBroadcaster((stage, message, extra) => events.push({ stage, message, ...extra }));

        tokens.onStream({ type: 'delta', text: '{"name":"Truncated mid' });
        tokens.newDocument();
        tokens.onStream({ type: 'delta', text: '{"name":"Next section"}' });
        tokens.flush();

        expect(events.some(e => e.tokenReset)).toBe(false);
        expect(events.map(e => e.token || '').join('')).toContain('Next section');
    });
});
