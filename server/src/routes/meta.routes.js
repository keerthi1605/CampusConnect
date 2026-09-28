import { Router } from 'express';
import { BRANCHES } from '../constants/branches.js';
import { JOB_TYPES } from '../constants/jobTypes.js';

const router = Router();

// Lets the frontend build dropdowns from the same lists the API validates against
router.get('/branches', (_req, res) => {
  res.json({ success: true, branches: BRANCHES });
});

router.get('/job-types', (_req, res) => {
  res.json({ success: true, jobTypes: JOB_TYPES });
});

export default router;
