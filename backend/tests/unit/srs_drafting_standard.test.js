import { describe, it, expect } from '@jest/globals';
import {
    deriveProjectPrefix,
    draftingConventionFor,
    qualityAttributeRulesFor,
    structuralExpectationsFor,
    defectChecklistFor,
    identifierRules
} from '../../src/utils/prompt_templates/srs_drafting_standard.js';
import { DeveloperAgent } from '../../src/agents/DeveloperAgent.js';
import { ReviewerAgent } from '../../src/agents/ReviewerAgent.js';
import { getFormat } from '../../src/formats/index.js';

describe('deriveProjectPrefix', () => {
    it('acronymises a multi-word name', () => {
        expect(deriveProjectPrefix('Fleet Telemetry Portal')).toBe('FTP');
    });

    it('caps at three letters', () => {
        expect(deriveProjectPrefix('One Two Three Four Five')).toBe('OTT');
    });

    it('falls back to REQ when nothing usable survives', () => {
        expect(deriveProjectPrefix('')).toBe('REQ');
        expect(deriveProjectPrefix('   ')).toBe('REQ');
    });

    it('is what identifierRules states, so the system turn and agents agree', () => {
        expect(identifierRules('Fleet Telemetry Portal')).toContain('"FTP-"');
        expect(identifierRules('Fleet Telemetry Portal')).not.toContain('Fleet Telemetry Portal-');
    });
});

describe('draftingConventionFor', () => {
    it('gives the shall-based standards normative language', () => {
        for (const id of ['ieee830', 'iso29148']) {
            expect(draftingConventionFor(id)).toContain('<normative_language>');
        }
    });

    it('withholds "shall" phrasing from Volere and the Agile PRD', () => {
        // Forcing IEEE phrasing onto these misrepresents the method they claim to follow.
        for (const id of ['volere', 'agile-prd']) {
            expect(draftingConventionFor(id)).not.toContain('<normative_language>');
            expect(draftingConventionFor(id)).toContain('Do NOT');
        }
    });

    it('puts Volere testability in the fit criterion', () => {
        const volere = draftingConventionFor('volere');
        expect(volere).toContain('FIT CRITERION');
        expect(volere).toContain('RATIONALE');
    });

    it('puts PRD testability in Given/When/Then acceptance criteria', () => {
        const prd = draftingConventionFor('agile-prd');
        expect(prd).toContain('Given / When / Then');
        expect(prd).toContain('NON-GOALS');
    });

    it('adds the 29148 requirement construct only for 29148', () => {
        expect(draftingConventionFor('iso29148')).toContain('[Constraint of action]');
        expect(draftingConventionFor('ieee830')).not.toContain('[Constraint of action]');
    });

    it('defaults an unknown format to the shall-based rules', () => {
        expect(draftingConventionFor(undefined)).toContain('<normative_language>');
    });
});

describe('qualityAttributeRulesFor', () => {
    it('applies to the shall-based standards, which quantify in the requirement itself', () => {
        expect(qualityAttributeRulesFor('ieee830')).toContain('<quality_attribute_rules>');
    });

    it('is withheld where the method quantifies elsewhere', () => {
        expect(qualityAttributeRulesFor('volere')).toBe('');
        expect(qualityAttributeRulesFor('agile-prd')).toBe('');
    });
});

describe('review targeting', () => {
    it('names the document under review and lists its own sections', () => {
        const spec = getFormat('volere');
        const text = structuralExpectationsFor(spec);
        expect(text).toContain('a Volere document');
        expect(text).toContain(spec.sections[0].title);
    });

    it('falls back to IEEE 830 when no spec is supplied', () => {
        expect(structuralExpectationsFor(null)).toContain('IEEE 830-1998');
    });

    it('adds method-specific defect checks', () => {
        expect(defectChecklistFor('volere')).toContain('SHELL INCOMPLETE');
        expect(defectChecklistFor('agile-prd')).toContain('STORY DEFECTS');
        expect(defectChecklistFor('iso29148')).toContain('MISSING RATIONALE');
        expect(defectChecklistFor('ieee830')).not.toContain('SHELL INCOMPLETE');
    });

    it('keeps the shared checklist in every variant', () => {
        for (const id of ['ieee830', 'iso29148', 'volere', 'agile-prd']) {
            expect(defectChecklistFor(id)).toContain('UNFAITHFUL');
            expect(defectChecklistFor(id)).toContain('</defect_checklist>');
        }
    });
});

/**
 * The guard that matters: the assembled agent prompt must carry one method's conventions and
 * not another's. A regression here silently produces a document that claims a standard it does
 * not follow, which no schema check would catch.
 */
describe('assembled agent prompts stay within one method', () => {
    const capture = (Base) => {
        let prompt = '';
        const Probe = class extends Base {
            async callLLM(p) { prompt = p; return {}; }
        };
        return { Probe, read: () => prompt };
    };

    const buildChunk = async (formatId) => {
        const { Probe, read } = capture(DeveloperAgent);
        const spec = getFormat(formatId);
        await new Probe().generateFormatChunk('raw input', {
            spec,
            sectionIds: [spec.sections[0].id],
            poOutput: {},
            architecture: {},
            settings: { projectName: 'Fleet Telemetry Portal' }
        });
        return read();
    };

    it('never puts "The system shall" discipline in a Volere or PRD prompt', async () => {
        for (const id of ['volere', 'agile-prd']) {
            expect(await buildChunk(id)).not.toContain('<normative_language>');
        }
    });

    it('never puts fit-criterion or story rules in a shall-based prompt', async () => {
        for (const id of ['ieee830', 'iso29148']) {
            const prompt = await buildChunk(id);
            expect(prompt).not.toContain('FIT CRITERION');
            expect(prompt).not.toContain('Given / When / Then');
        }
    });

    it('uses the acronym prefix, not the full project name', async () => {
        const prompt = await buildChunk('ieee830');
        expect(prompt).toContain('"FTP-"');
        expect(prompt).not.toContain('"Fleet Telemetry Portal-"');
    });

    it('tells the reviewer which format it is judging', async () => {
        const { Probe, read } = capture(ReviewerAgent);
        await new Probe().reviewSRS({}, {}, getFormat('agile-prd'));
        expect(read()).toContain('a Agile PRD document');
        expect(read()).toContain('STORY DEFECTS');
    });
});
