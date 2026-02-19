import express from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import { createProject, getProjects, getProject, updateProject, deleteProject } from '../controllers/projectController.js';
import { getFullProjectGraph } from '../services/graphService.js';
import { successResponse } from '../utils/response.js';
import { validate } from '../middleware/validationMiddleware.js';
import { projectCreateSchema, projectUpdateSchema } from '../utils/validationSchemas.js';

const router = express.Router();

router.use(authenticate);

// Get the full Knowledge Graph for a project
router.get('/:id/graph', async (req, res, next) => {
    try {
        const graph = await getFullProjectGraph(req.params.id);
        return successResponse(res, graph, 'Knowledge Graph retrieved successfully');
    } catch (error) {
        next(error);
    }
});

router.post('/', validate(projectCreateSchema), createProject);
router.get('/', getProjects);
router.get('/:id', getProject);
router.put('/:id', validate(projectUpdateSchema), updateProject);
router.delete('/:id', deleteProject);

export default router;
