import { Router } from 'express';
import { getAdvisors, createAdvisor } from '../controllers/advisorController';

const router = Router();

// Gestión de asesores
router.get('/', getAdvisors);
router.post('/', createAdvisor);

export default router;
