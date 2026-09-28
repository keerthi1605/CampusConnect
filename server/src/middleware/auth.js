import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import { verifyToken } from '../utils/token.js';

/** Requires a valid "Authorization: Bearer <jwt>" and attaches the user to req.user. */
export async function protect(req, _res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw ApiError.unauthorized('Authentication required');
  }

  // Expired/invalid tokens throw JWT errors, which the error handler maps to 401
  const payload = verifyToken(token);

  // Load the user each request: deleted users lose access immediately and
  // role changes take effect without waiting for the token to expire
  const user = await User.findById(payload.sub);
  if (!user) throw ApiError.unauthorized('User no longer exists');

  req.user = user;
  next();
}

/** Restricts a route to the given roles. Must run after protect. */
export const authorize =
  (...roles) =>
  (req, _res, next) => {
    if (!req.user) throw ApiError.unauthorized('Authentication required');
    if (!roles.includes(req.user.role)) throw ApiError.forbidden();
    next();
  };
