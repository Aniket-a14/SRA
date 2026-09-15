import { describe, it, expect } from '@jest/globals';
import { SchemaType } from '@google/generative-ai';
import { geminiSchemaToZod, summarizeZodIssues } from '../../src/utils/geminiSchemaToZod.js';

describe('geminiSchemaToZod', () => {
    it('converts primitive types', () => {
        expect(geminiSchemaToZod({ type: SchemaType.STRING }).safeParse('hi').success).toBe(true);
        expect(geminiSchemaToZod({ type: SchemaType.STRING }).safeParse(5).success).toBe(false);
        expect(geminiSchemaToZod({ type: SchemaType.NUMBER }).safeParse(5).success).toBe(true);
        expect(geminiSchemaToZod({ type: SchemaType.INTEGER }).safeParse(5.5).success).toBe(false);
        expect(geminiSchemaToZod({ type: SchemaType.INTEGER }).safeParse(5).success).toBe(true);
        expect(geminiSchemaToZod({ type: SchemaType.BOOLEAN }).safeParse(true).success).toBe(true);
    });

    it('converts arrays of the item type', () => {
        const schema = geminiSchemaToZod({ type: SchemaType.ARRAY, items: { type: SchemaType.STRING } });
        expect(schema.safeParse(['a', 'b']).success).toBe(true);
        expect(schema.safeParse(['a', 5]).success).toBe(false);
        expect(schema.safeParse('not an array').success).toBe(false);
    });

    it('makes required fields required and everything else optional', () => {
        const schema = geminiSchemaToZod({
            type: SchemaType.OBJECT,
            properties: {
                name: { type: SchemaType.STRING },
                nickname: { type: SchemaType.STRING },
            },
            required: ['name'],
        });

        expect(schema.safeParse({ name: 'Ada' }).success).toBe(true);
        expect(schema.safeParse({ nickname: 'only optional given' }).success).toBe(false);
    });

    it('rejects a required field that is null', () => {
        const schema = geminiSchemaToZod({
            type: SchemaType.OBJECT,
            properties: { name: { type: SchemaType.STRING } },
            required: ['name'],
        });

        expect(schema.safeParse({ name: null }).success).toBe(false);
    });

    it('passes through fields not declared in the schema instead of rejecting them', () => {
        const schema = geminiSchemaToZod({
            type: SchemaType.OBJECT,
            properties: { name: { type: SchemaType.STRING } },
            required: ['name'],
        });

        const result = schema.safeParse({ name: 'Ada', unexpectedField: 'from a non-Gemini provider' });
        expect(result.success).toBe(true);
        expect(result.data.unexpectedField).toBe('from a non-Gemini provider');
    });

    it('recurses through nested objects and arrays of objects', () => {
        const schema = geminiSchemaToZod({
            type: SchemaType.OBJECT,
            properties: {
                features: {
                    type: SchemaType.ARRAY,
                    items: {
                        type: SchemaType.OBJECT,
                        properties: { name: { type: SchemaType.STRING }, priority: { type: SchemaType.STRING } },
                        required: ['name', 'priority'],
                    },
                },
            },
            required: ['features'],
        });

        expect(schema.safeParse({ features: [{ name: 'Login', priority: 'High' }] }).success).toBe(true);
        expect(schema.safeParse({ features: [{ name: 'Login' }] }).success).toBe(false); // missing priority
    });

    it('falls back to z.unknown() for an unrecognized or missing type rather than throwing', () => {
        expect(() => geminiSchemaToZod({ type: 'some-future-type' })).not.toThrow();
        expect(geminiSchemaToZod({ type: 'some-future-type' }).safeParse('anything').success).toBe(true);
        expect(() => geminiSchemaToZod(null)).not.toThrow();
        expect(() => geminiSchemaToZod(undefined)).not.toThrow();
    });
});

describe('summarizeZodIssues', () => {
    it('lists each issue with its field path', () => {
        const schema = geminiSchemaToZod({
            type: SchemaType.OBJECT,
            properties: { title: { type: SchemaType.STRING }, count: { type: SchemaType.NUMBER } },
            required: ['title', 'count'],
        });
        const result = schema.safeParse({ count: 'not a number' });

        const summary = summarizeZodIssues(result.error);
        expect(summary).toContain('title');
        expect(summary).toContain('count');
    });

    it('caps the listed issues and notes how many more there were', () => {
        const properties = {};
        const required = [];
        for (let i = 0; i < 20; i++) {
            properties[`field${i}`] = { type: SchemaType.STRING };
            required.push(`field${i}`);
        }
        const schema = geminiSchemaToZod({ type: SchemaType.OBJECT, properties, required });
        const result = schema.safeParse({});

        const summary = summarizeZodIssues(result.error, 5);
        expect(summary).toContain('...and 15 more');
        expect(summary.split('\n').filter((l) => l.startsWith('- field')).length).toBe(5);
    });
});
