import { describe, test, expect } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import formatRoutes from '../../src/routes/formatRoutes.js';
import { listFormats, listAllSectionIds } from '../../src/formats/index.js';
import { updateAnalysisSchema } from '../../src/utils/validationSchemas.js';

const app = express();
app.use(express.json());
app.use('/api/formats', formatRoutes);
// Minimal error handler so a 404 from the route surfaces as a status, not a hang. Express
// identifies an error handler by arity, so the fourth parameter has to be declared.
// eslint-disable-next-line no-unused-vars
app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ message: error.message }));

describe('GET /api/formats', () => {
    test('lists every registered format with a default', async () => {
        const response = await request(app).get('/api/formats');

        expect(response.status).toBe(200);
        const payload = response.body.data || response.body;
        expect(payload.defaultFormatId).toBe('ieee830');
        expect(payload.formats.map(f => f.id).sort()).toEqual(listFormats().map(f => f.id).sort());
    });

    test('needs no credentials — the CLI reads it before `sra init` has run', async () => {
        const response = await request(app).get('/api/formats');
        expect(response.status).toBe(200);
    });
});

describe('GET /api/formats/:id', () => {
    test('returns the sections the CLI needs to round-trip a document', async () => {
        const response = await request(app).get('/api/formats/volere');

        expect(response.status).toBe(200);
        const spec = response.body.data || response.body;
        expect(spec.id).toBe('volere');
        expect(Array.isArray(spec.sections)).toBe(true);
        expect(spec.sections.every(s => s.id && s.kind)).toBe(true);
    });

    test('exposes at least one requirement-carrying section per format', async () => {
        // Without one, `sra sync` has nothing to trace to code for that format.
        const carriers = new Set(['feature-list', 'user-stories', 'requirement-group', 'shell-list']);

        for (const { id } of listFormats()) {
            const response = await request(app).get(`/api/formats/${id}`);
            const spec = response.body.data || response.body;
            const hasCarrier = spec.sections.some(s => carriers.has(s.kind)) ||
                spec.sections.some(s => (s.fields || []).some(f => carriers.has(f.kind)));
            expect(hasCarrier).toBe(true);
        }
    });

    test('404s on an unknown format rather than silently serving the default', async () => {
        const response = await request(app).get('/api/formats/not-a-format');
        expect(response.status).toBe(404);
    });
});

describe('updateAnalysis write whitelist', () => {
    const parse = (body) => updateAnalysisSchema.parse({
        params: { id: '123e4567-e89b-12d3-a456-426614174000' },
        body
    });

    test('covers every section of every registered format', () => {
        // Hand-listed, this whitelist only ever knew IEEE's sections, so edits to a
        // Volere/ISO/Agile section were stripped by validation and silently discarded.
        for (const sectionId of listAllSectionIds()) {
            const result = parse({ [sectionId]: [{ id: 'X-1', description: 'A requirement.' }] });
            expect(result.body[sectionId]).toBeDefined();
        }
    });

    test('keeps the cross-format pipeline keys writable', () => {
        const result = parse({ projectTitle: 'Demo', qualityAudit: { score: 90 }, layer3Status: 'ALIGNED' });
        expect(result.body.projectTitle).toBe('Demo');
        expect(result.body.qualityAudit).toEqual({ score: 90 });
    });

    test('still strips a key no format defines', () => {
        const result = parse({ systemFeatures: [], somethingInvented: 'should not persist' });
        expect(result.body).not.toHaveProperty('somethingInvented');
    });

    test('accepts the CLI traceability record as metadata', () => {
        const result = parse({
            inPlace: true,
            skipAlignment: true,
            metadata: { cliTraceability: { summary: { groups: 2 }, groups: [] } }
        });
        expect(result.body.metadata.cliTraceability.summary.groups).toBe(2);
    });
});
