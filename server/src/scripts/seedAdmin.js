import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import User, { ROLES } from '../models/User.js';

const { ADMIN_NAME = 'Placement Admin', ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;

try {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD in server/.env before running the seed');
  }
  if (ADMIN_PASSWORD.length < 8) throw new Error('ADMIN_PASSWORD must be at least 8 characters');

  await connectDB();

  const email = ADMIN_EMAIL.trim().toLowerCase();
  const existing = await User.findOne({ email });

  if (existing) {
    console.log(`User ${email} already exists (role: ${existing.role}); nothing changed.`);
  } else {
    await User.create({
      name: ADMIN_NAME,
      email,
      role: ROLES.ADMIN,
      passwordHash: await User.hashPassword(ADMIN_PASSWORD),
    });
    console.log(`Admin created: ${email}`);
  }
} catch (err) {
  console.error(`Seed failed: ${err.message}`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
