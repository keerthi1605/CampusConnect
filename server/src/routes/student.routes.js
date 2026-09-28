import { Router } from 'express';
import {
  getMyProfile,
  upsertMyProfile,
  listStudents,
  getStudent,
} from '../controllers/student.controller.js';
import { protect, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { ROLES } from '../models/User.js';
import { idParams } from '../validators/common.js';
import { upsertProfileSchema, listStudentsSchema } from '../validators/student.validators.js';

const router = Router();

router.use(protect);

// Student: own profile. Declared before '/:id' so "me" is never treated as an id.
router.get('/me', authorize(ROLES.STUDENT), getMyProfile);
router.put('/me', authorize(ROLES.STUDENT), validate(upsertProfileSchema), upsertMyProfile);

// Admin: browse students
router.get('/', authorize(ROLES.ADMIN), validate(listStudentsSchema), listStudents);
router.get('/:id', authorize(ROLES.ADMIN), validate(idParams), getStudent);

export default router;
