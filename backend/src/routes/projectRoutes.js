import express from 'express';
import { authenticate, requireScope } from '../middleware/authMiddleware.js';
import { createProject, getProjects, getProject, updateProject, deleteProject } from '../controllers/projectController.js';
import { getFullProjectGraph } from '../services/knowledge/graphService.js';
import { successResponse } from '../utils/response.js';
import { validate } from '../middleware/validationMiddleware.js';
import { projectCreateSchema, projectUpdateSchema } from '../utils/validationSchemas.js';

const router = express.Router();

router.use(authenticate);

// Get the full Knowledge Graph for a project
router.get('/:id/graph', requireScope('read'), async (req, res, next) => {
    try {
        const graph = await getFullProjectGraph(req.params.id, req.user.userId);
        return successResponse(res, graph, 'Knowledge Graph retrieved successfully');
    } catch (error) {
        next(error);
    }
});

router.post('/', requireScope('write'), validate(projectCreateSchema), createProject);
router.get('/', requireScope('read'), getProjects);
router.get('/:id', requireScope('read'), getProject);
router.put('/:id', requireScope('write'), validate(projectUpdateSchema), updateProject);
router.delete('/:id', requireScope('admin'), deleteProject);

export default router;
