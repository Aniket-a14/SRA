import { jest } from '@jest/globals';
import { constructMasterPrompt } from '../../src/utils/prompts.js';

describe('Prompt Snapshots', () => {
    it('generates consistent system prompt for default profile', () => {
        const prompt = constructMasterPrompt({
            profile: 'default',
            depth: 3,
            strictness: 3
        });
        expect(prompt).toMatchSnapshot();
    });

    it('generates consistent system prompt for business analyst profile', () => {
        const prompt = constructMasterPrompt({
            profile: 'business_analyst',
            depth: 5,
            strictness: 5
        });
        expect(prompt).toMatchSnapshot();
    });

    it('generates consistent system prompt for security analyst profile', () => {
        const prompt = constructMasterPrompt({
            profile: 'security_analyst',
            depth: 1,
            strictness: 1
        });
        expect(prompt).toMatchSnapshot();
    });
});
