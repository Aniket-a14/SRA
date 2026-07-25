import express from 'express';
import { listFormats, getFormat, isValidFormatId, DEFAULT_FORMAT_ID } from '../formats/index.js';
import { successResponse } from '../utils/response.js';

const router = express.Router();

// Deliberately unauthenticated. The format registry is static, non-sensitive metadata that
// already ships inside the public frontend bundle; requiring a key here would only stop
// `sra formats` from working before `sra init`, which is exactly when it is most useful.

/** GET /api/formats — every SRS standard the pipeline can generate. */
router.get('/', (req, res) => {
    return successResponse(res, {
        defaultFormatId: DEFAULT_FORMAT_ID,
        formats: listFormats()
    });
});

/**
 * GET /api/formats/:id — the full descriptor (sections, kinds, requirement model).
 * This is what lets the CLI round-trip a spec without duplicating the registry: it can
 * find the sections that actually carry requirements for *this* format instead of
 * assuming IEEE's `systemFeatures`.
 */
router.get('/:id', (req, res, next) => {
    const { id } = req.params;

    if (!isValidFormatId(id)) {
        const error = new Error(`Unknown format '${id}'`);
        error.statusCode = 404;
        return next(error);
    }

    const spec = getFormat(id);
    return successResponse(res, {
        id: spec.id,
        name: spec.name,
        description: spec.description,
        tier: spec.tier,
        requirementModel: spec.requirementModel,
        sections: spec.sections.map(({ id: sectionId, number, title, kind, requirementModel, appendix, fields }) => ({
            id: sectionId,
            number,
            title,
            kind,
            requirementModel,
            appendix: Boolean(appendix),
            fields: Array.isArray(fields) ? fields.map(({ id: fieldId, label, kind: fieldKind }) => ({ id: fieldId, label, kind: fieldKind })) : undefined
        }))
    });
});

export default router;
