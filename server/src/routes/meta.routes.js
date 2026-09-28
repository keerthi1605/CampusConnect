import { Router } from 'express';
import { BRANCHES } from '../constants/branches.js';

const router = Router();

// Lets the frontend build dropdowns from the same list the API validates against
router.get('/branches', (_req, res) => {
  res.json({ success: true, branches: BRANCHES });
});

export default router;
