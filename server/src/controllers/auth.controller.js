import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import { signToken } from '../utils/token.js';

// Compared against when the email is unknown, so login takes about the same time
// whether or not an account exists (prevents user enumeration by timing)
const DUMMY_HASH = await User.hashPassword('dummy-password-for-timing');

export const register = async (req, res) => {
  const { name, email, password } = req.body;

  if (await User.exists({ email })) throw ApiError.conflict('Email is already registered');

  // Public registration always creates a student; admins come from the seed script
  const user = await User.create({
    name,
    email,
    passwordHash: await User.hashPassword(password),
  });

  res.status(201).json({ success: true, token: signToken(user), user });
};

export const login = async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+passwordHash');

  let valid = false;
  if (user) {
    valid = await user.comparePassword(password);
  } else {
    await bcrypt.compare(password, DUMMY_HASH);
  }

  // Same message for unknown email and wrong password
  if (!valid) throw ApiError.unauthorized('Invalid email or password');

  res.json({ success: true, token: signToken(user), user });
};

export const getMe = (req, res) => {
  res.json({ success: true, user: req.user });
};
