import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import studentRoutes from './student.routes.js';
import metaRoutes from './meta.routes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/meta', metaRoutes);
router.use('/auth', authRoutes);
router.use('/students', studentRoutes);
// Phase 4+: router.use('/jobs', ...); router.use('/applications', ...);

export default router;
