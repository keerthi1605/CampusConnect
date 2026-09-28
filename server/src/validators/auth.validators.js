import { z } from 'zod';

const email = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address'));

// bcrypt only uses the first 72 bytes, so cap the length rather than silently truncate
const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters')
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/\d/, 'Password must contain a number');

// No `role` field on purpose: zod strips it, so nobody can self-register as admin
export const registerSchema = {
  body: z.object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
    email,
    password,
  }),
};

export const loginSchema = {
  body: z.object({
    email,
    password: z.string().min(1, 'Password is required').max(72),
  }),
};
