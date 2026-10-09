import { Router } from 'express';
import {
  listMyApplications,
  withdrawApplication,
  updateApplicationStatus,
} from '../controllers/application.controller.js';
import { protect, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { ROLES } from '../models/User.js';
import { idParams } from '../validators/common.js';
import {
  listMyApplicationsSchema,
  updateStatusSchema,
} from '../validators/application.validators.js';

const router = Router();

router.use(protect);

// Student. '/me' is declared before '/:id' so it is never treated as an id.
router.get('/me', authorize(ROLES.STUDENT), validate(listMyApplicationsSchema), listMyApplications);
router.delete('/:id', authorize(ROLES.STUDENT), validate(idParams), withdrawApplication);

// Admin
router.patch('/:id/status', authorize(ROLES.ADMIN), validate(updateStatusSchema), updateApplicationStatus);

export default router;
