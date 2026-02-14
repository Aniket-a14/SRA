import express from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import { createProject, getProjects, getProject, updateProject, deleteProject } from '../controllers/projectController.js';
import { getFullProjectGraph } from '../services/graphService.js';

const router = express.Router();

router.use(authenticate);

// Get the full Knowledge Graph for a project
router.get('/:id/graph', async (req, res) => {
    try {
        const graph = await getFullProjectGraph(req.params.id);
        res.json(graph);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/', createProject);
router.get('/', getProjects);
router.get('/:id', getProject);
router.put('/:id', updateProject);
router.delete('/:id', deleteProject);

export default router;
