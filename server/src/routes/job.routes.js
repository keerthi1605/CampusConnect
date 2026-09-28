import { Router } from 'express';
import { z } from 'zod';
import { listJobs, getJob, createJob, updateJob, deleteJob } from '../controllers/job.controller.js';
import { protect, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { ROLES } from '../models/User.js';
import { idParams } from '../validators/common.js';
import { createJobSchema, updateJobSchema, listJobsSchema } from '../validators/job.validators.js';

const router = Router();

router.use(protect);

// Any signed-in user (student or admin) can browse
router.get('/', validate(listJobsSchema), listJobs);
router.get('/:id', validate(idParams), getJob);

// Admin-only writes
router.post('/', authorize(ROLES.ADMIN), validate(createJobSchema), createJob);
router.put(
  '/:id',
  authorize(ROLES.ADMIN),
  validate({ params: z.object({ id: idParams.params.shape.id }), body: updateJobSchema.body }),
  updateJob
);
router.delete('/:id', authorize(ROLES.ADMIN), validate(idParams), deleteJob);

export default router;
