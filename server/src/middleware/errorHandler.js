import mongoose from 'mongoose';
import { ZodError } from 'zod';
import ApiError from '../utils/ApiError.js';

export function notFound(req, _res, next) {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
}

const formatZodIssues = (issues) =>
  issues.map((i) => ({ field: i.path.join('.'), message: i.message }));

// Maps any thrown error to { statusCode, message, errors? }
function normalize(err) {
  if (err instanceof ApiError) {
    return { statusCode: err.statusCode, message: err.message, errors: err.errors };
  }
  if (err instanceof ZodError) {
    return { statusCode: 400, message: 'Validation failed', errors: formatZodIssues(err.issues) };
  }
  if (err instanceof mongoose.Error.ValidationError) {
    const errors = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    return { statusCode: 400, message: 'Validation failed', errors };
  }
  if (err instanceof mongoose.Error.CastError) {
    return { statusCode: 400, message: `Invalid ${err.path}: ${err.value}` };
  }
  if (err.code === 11000) {
    const fields = Object.keys(err.keyPattern || {});
    return { statusCode: 409, message: `Duplicate value for: ${fields.join(', ') || 'unique field'}` };
  }
  if (err.name === 'TokenExpiredError') {
    return { statusCode: 401, message: 'Token expired' };
  }
  if (err.name === 'JsonWebTokenError') {
    return { statusCode: 401, message: 'Invalid token' };
  }
  if (err.type === 'entity.parse.failed') {
    return { statusCode: 400, message: 'Malformed JSON in request body' };
  }
  if (err.type === 'entity.too.large') {
    return { statusCode: 413, message: 'Request body too large' };
  }
  return { statusCode: 500, message: 'Internal server error' };
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  const { statusCode, message, errors } = normalize(err);

  if (statusCode >= 500) console.error(err);

  res.status(statusCode).json({
    success: false,
    message,
    ...(errors && { errors }),
    ...(process.env.NODE_ENV !== 'production' && statusCode >= 500 && { stack: err.stack }),
  });
}
