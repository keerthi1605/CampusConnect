import { Router } from 'express';
import { register, login, getMe } from '../controllers/auth.controller.js';
import { loginAccountLimiter, loginIpLimiter, registerLimiter } from '../config/rateLimit.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { registerSchema, loginSchema } from '../validators/auth.validators.js';

const router = Router();

router.post('/register', registerLimiter, validate(registerSchema), register);
router.post('/login', loginIpLimiter, loginAccountLimiter, validate(loginSchema), login);
router.get('/me', protect, getMe);

export default router;
