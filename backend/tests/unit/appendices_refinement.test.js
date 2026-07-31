import { jest, describe, it, expect } from '@jest/globals';

/**
 * A finished document must still have its diagrams.
 *
 * The reflection loop picks the Appendices section whenever feedback mentions a diagram, a
 * flowchart or an ERD — which the Critic's feedback usually does, and it is the first branch
 * tested. `refineSRS` then mapped a response schema for Shell, Features and Requirements and
 * had no entry for Appendices, so that refinement fell through to the whole-document schema:
 * the model was shown one section, asked for an entire SRS, and the result was spread over the
 * draft. The Mermaid models the refinement existed to repair were dropped, and the finished
 * document had no diagrams at all.
 *
 * It stayed invisible while runs were being killed at the function time limit mid-loop,
 * because the failsafe then persisted the pre-reflection draft — which still had them.
 */

const { runReflectionLoop, mergeRefinedAppendices } =
    await import('../../src/services/pipeline/reflectionStage.js');
const { DeveloperAgent, hasCompleteAppendices } = await import('../../src/agents/DeveloperAgent.js');
const { SRSAppendicesSchema } = await import('../../src/utils/aiSchemas.js');

const diagram = (code) => ({ syntaxExplanation: 'x', code, caption: 'A caption' });

const draftWithDiagrams = () => ({
    projectTitle: 'Leave Tracker',
    introduction: { purpose: 'Track leave.' },
    systemFeatures: [{ name: 'F1' }],
    appendices: {
        analysisModels: {
            flowchartDiagram: diagram('flowchart TD\n A --> B'),
            sequenceDiagram: diagram('sequenceDiagram\n A->>B: hi'),
            entityRelationshipDiagram: diagram('erDiagram\n USER ||--o{ LEAVE : "files"'),
            additionalDiagrams: [{ type: 'stateDiagram-v2', title: 'Leave states', code: 'stateDiagram-v2\n [*] --> Draft' }]
        },
        tbdList: ['Retention period']
    }
});

describe('refineSRS — section schema', () => {
    it('constrains an Appendices refinement to the Appendices schema', async () => {
        const agent = new DeveloperAgent();
        const callLLM = jest.spyOn(agent, 'callLLM').mockResolvedValue({});

        await agent.refineSRS('input', {}, {}, { appendices: {} }, 'Appendices', []);

        // 4th positional argument to callLLM is the response schema.
        expect(callLLM.mock.calls[0][3]).toBe(SRSAppendicesSchema);
    });

    it('refuses a section it cannot constrain instead of using the whole-document schema', async () => {
        const agent = new DeveloperAgent();
        jest.spyOn(agent, 'callLLM').mockResolvedValue({});

        // Falling back here is what produced a whole document from one section and spread it
        // over the draft. Skipping a quality pass is the cheaper failure.
        await expect(agent.refineSRS('input', {}, {}, {}, 'Glossary', [])).rejects.toThrow(/no schema/i);
    });
});

describe('generateAppendices — diagram contract', () => {
    const complete = () => ({
        appendices: {
            analysisModels: {
                flowchartDiagram: diagram('flowchart TD\n A --> B'),
                sequenceDiagram: diagram('sequenceDiagram\n A->>B: hi'),
                entityRelationshipDiagram: diagram('erDiagram\n USER ||--o{ LEAVE : "files"')
            },
            tbdList: []
        }
    });

    it('recognises only appendices with all required diagram code', () => {
        expect(hasCompleteAppendices(complete())).toBe(true);
        expect(hasCompleteAppendices({ appendices: { analysisModels: {} } })).toBe(false);
    });

    it('recovers once when a provider returns an appendix without diagrams', async () => {
        const agent = new DeveloperAgent();
        const callLLM = jest.spyOn(agent, 'callLLM')
            .mockResolvedValueOnce({ appendices: { analysisModels: {}, tbdList: [] } })
            .mockResolvedValueOnce(complete());

        const result = await agent.generateAppendices('input', {}, {}, {}, {
            appendicesSystemInstruction: 'system'
        });

        expect(callLLM).toHaveBeenCalledTimes(2);
        expect(hasCompleteAppendices(result)).toBe(true);
    });

    it('resets the active stream before retrying an incomplete appendix', async () => {
        const agent = new DeveloperAgent();
        const events = [];
        const callLLM = jest.spyOn(agent, 'callLLM')
            .mockImplementationOnce(async (...args) => {
                args[6]?.onStream?.({ type: 'delta', text: '{"appendices":' });
                return { appendices: { analysisModels: {}, tbdList: [] } };
            })
            .mockImplementationOnce(async (...args) => {
                args[6]?.onStream?.({ type: 'delta', text: '{"appendices":"complete"}' });
                return complete();
            });

        await agent.generateAppendices('input', {}, {}, {}, {
            appendicesSystemInstruction: 'system',
            onStream: (event) => events.push(event)
        });

        expect(callLLM).toHaveBeenCalledTimes(2);
        expect(events.map((event) => event.type)).toEqual(['delta', 'reset', 'delta']);
    });
});

describe('SRSAppendicesSchema — required diagram fields', () => {
    it('requires the fixed diagram set and its code fields', () => {
        const appendices = SRSAppendicesSchema.properties.appendices;
        const models = appendices.properties.analysisModels;

        expect(appendices.required).toEqual(expect.arrayContaining(['analysisModels', 'tbdList']));
        expect(models.required).toEqual(expect.arrayContaining([
            'flowchartDiagram',
            'sequenceDiagram',
            'entityRelationshipDiagram'
        ]));
        for (const diagramKey of ['flowchartDiagram', 'sequenceDiagram', 'entityRelationshipDiagram']) {
            expect(models.properties[diagramKey].required).toEqual(
                expect.arrayContaining(['syntaxExplanation', 'code', 'caption'])
            );
        }
    });
});

describe('mergeRefinedAppendices', () => {
    it('keeps a diagram the refinement did not return', () => {
        const merged = mergeRefinedAppendices(draftWithDiagrams(), {
            appendices: { analysisModels: { flowchartDiagram: diagram('flowchart TD\n A --> C') }, tbdList: [] }
        });

        const models = merged.appendices.analysisModels;
        expect(models.flowchartDiagram.code).toContain('A --> C');       // rewritten
        expect(models.sequenceDiagram.code).toContain('A->>B: hi');      // untouched, kept
        expect(models.entityRelationshipDiagram.code).toContain('erDiagram');
        expect(models.additionalDiagrams).toHaveLength(1);
    });

    it('keeps a diagram the refinement returned empty', () => {
        const merged = mergeRefinedAppendices(draftWithDiagrams(), {
            appendices: {
                analysisModels: {
                    flowchartDiagram: { syntaxExplanation: 'x', code: '   ', caption: '' },
                    additionalDiagrams: []
                }
            }
        });

        const models = merged.appendices.analysisModels;
        expect(models.flowchartDiagram.code).toContain('A --> B');
        expect(models.additionalDiagrams).toHaveLength(1);
    });

    it('survives a refinement that dropped analysisModels entirely', () => {
        // The exact shape that emptied the section: appendices came back with only a TBD list.
        const merged = mergeRefinedAppendices(draftWithDiagrams(), {
            appendices: { tbdList: ['Retention period', 'Approval chain'] }
        });

        const models = merged.appendices.analysisModels;
        expect(models.flowchartDiagram.code).toContain('A --> B');
        expect(models.sequenceDiagram.code).toContain('A->>B: hi');
        expect(models.entityRelationshipDiagram.code).toContain('erDiagram');
        expect(merged.appendices.tbdList).toContain('Approval chain');
    });

    it('leaves the rest of the document alone', () => {
        const merged = mergeRefinedAppendices(draftWithDiagrams(), { appendices: { tbdList: [] } });

        expect(merged.projectTitle).toBe('Leave Tracker');
        expect(merged.introduction.purpose).toBe('Track leave.');
        expect(merged.systemFeatures).toHaveLength(1);
    });
});

describe('runReflectionLoop — refining the Appendices', () => {
    it('finishes with its diagrams intact when the refinement returns none', async () => {
        const devAgent = {
            refineSRS: jest.fn().mockResolvedValue({ appendices: { tbdList: ['Retention period'] } })
        };
        const qaAgent = {
            reviewSRS: jest.fn()
                .mockResolvedValueOnce({ status: 'REJECTED', feedback: [{ issue: 'The ERD diagram is malformed' }] })
                .mockResolvedValue({ status: 'APPROVED', feedback: [] })
        };
        const criticAgent = {
            auditSRS: jest.fn()
                .mockResolvedValueOnce({ overallScore: 60, criticalIssues: [], suggestions: [] })
                .mockResolvedValue({ overallScore: 92, criticalIssues: [], suggestions: [] })
        };

        const draft = draftWithDiagrams();
        const result = await runReflectionLoop({
            text: 'input', poOutput: { features: [] }, archOutput: {}, projectName: 'P',
            sections: {
                srsShell: { introduction: draft.introduction },
                allFeatures: draft.systemFeatures,
                srsRequirements: {},
                srsAppendices: { appendices: draft.appendices },
                srsDraft: draft
            },
            agents: { devAgent, qaAgent, criticAgent },
            sleep: () => Promise.resolve(), emitProgress: () => {}, reflectionCooldownMs: 0
        });

        expect(devAgent.refineSRS.mock.calls[0][4]).toBe('Appendices');
        const models = result.srsDraft.appendices.analysisModels;
        expect(models.flowchartDiagram.code).toBeTruthy();
        expect(models.sequenceDiagram.code).toBeTruthy();
        expect(models.entityRelationshipDiagram.code).toBeTruthy();
        expect(models.additionalDiagrams).toHaveLength(1);
    });
});
