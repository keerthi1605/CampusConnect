import ApiError from '../utils/ApiError.js';

// CLIENT_URL may hold several comma-separated origins (e.g. local + production)
const parseOrigins = () =>
  (process.env.CLIENT_URL || '')
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean);

export function buildCorsOptions() {
  const allowed = parseOrigins();

  return {
    origin(origin, callback) {
      // No Origin header = non-browser client (curl, Postman, server-to-server)
      if (!origin || allowed.includes(origin)) return callback(null, true);
      callback(ApiError.forbidden(`Origin ${origin} is not allowed by CORS`));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600,
  };
}
