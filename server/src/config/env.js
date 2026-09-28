const REQUIRED = ['MONGO_URI', 'JWT_SECRET'];

// Fail fast at startup instead of on the first login attempt
export function assertEnv() {
  const missing = REQUIRED.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Missing environment variables: ${missing.join(', ')} (see server/.env.example)`);
  }
  if (process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long');
  }
}
