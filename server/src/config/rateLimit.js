import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import ApiError from '../utils/ApiError.js';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

const fromEnv = (name, fallback) => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const build = ({ windowMs, limit, message, keyGenerator, skipSuccessfulRequests = false }) =>
  rateLimit({
    windowMs,
    limit,
    keyGenerator,
    skipSuccessfulRequests,
    standardHeaders: 'draft-7', // RateLimit-* headers, plus Retry-After once blocked
    legacyHeaders: false,
    // Answer in the API's usual error shape instead of the library's plain text
    handler: (_req, _res, next) => next(new ApiError(429, message)),
  });

const ip = (req) => ipKeyGenerator(req.ip);

// Wrong-password attempts are counted per IP *and* email, so one person mistyping (or one
// attacker guessing a single account) is throttled without locking out everyone behind the
// same campus NAT. Successful logins don't count.
const emailOf = (req) =>
  typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase().slice(0, 254) : '';

/** Every /api request, per IP: a broad ceiling against runaway clients. */
export const apiLimiter = build({
  windowMs: 15 * MINUTE,
  limit: fromEnv('RATE_LIMIT_API_MAX', 600),
  keyGenerator: ip,
  message: 'Too many requests. Please slow down and try again shortly.',
});

/** Failed logins for one account from one IP. */
export const loginAccountLimiter = build({
  windowMs: 15 * MINUTE,
  limit: fromEnv('AUTH_LOGIN_MAX', 5),
  keyGenerator: (req) => `${ip(req)}|${emailOf(req)}`,
  skipSuccessfulRequests: true,
  message: 'Too many failed sign-in attempts for this account. Try again in 15 minutes.',
});

/** Failed logins from one IP across all accounts (credential-stuffing guard); generous for shared networks. */
export const loginIpLimiter = build({
  windowMs: 15 * MINUTE,
  limit: fromEnv('AUTH_LOGIN_IP_MAX', 100),
  keyGenerator: ip,
  skipSuccessfulRequests: true,
  message: 'Too many failed sign-in attempts from this network. Try again in 15 minutes.',
});

/** Account creation per IP; high because a whole campus can share one address. */
export const registerLimiter = build({
  windowMs: HOUR,
  limit: fromEnv('AUTH_REGISTER_MAX', 30),
  keyGenerator: ip,
  message: 'Too many accounts created from this network. Try again later.',
});
