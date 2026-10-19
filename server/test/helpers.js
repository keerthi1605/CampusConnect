import 'dotenv/config';
import crypto from 'node:crypto';

/**
 * Shared test harness. Each test file runs in its own process and gets:
 *  - its own uniquely named database (campusconnect_test_<random>) on the cluster in MONGO_URI,
 *    dropped afterwards; it refuses to run against any other database name
 *  - its own random JWT secret (your .env secret is never used)
 *  - the real Express app on an ephemeral port, driven over HTTP
 */
export const DB_PREFIX = 'campusconnect_test_';
export const PASSWORD = 'Passw0rdOK';

export const future = (days) => new Date(Date.now() + days * 86_400_000);
export const past = (days) => new Date(Date.now() - days * 86_400_000);

// Limits high enough that ordinary tests never trip them; security.test.js passes small ones
const DEFAULT_LIMITS = {
  RATE_LIMIT_API_MAX: '100000',
  AUTH_LOGIN_MAX: '100000',
  AUTH_LOGIN_IP_MAX: '100000',
  AUTH_REGISTER_MAX: '100000',
};

export async function setupTestApp({ env = {} } = {}) {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is not set. The tests need a MongoDB cluster (see server/.env.example).');
  }

  const dbName = `${DB_PREFIX}${crypto.randomBytes(4).toString('hex')}`;
  Object.assign(process.env, DEFAULT_LIMITS, {
    NODE_ENV: 'test',
    BCRYPT_ROUNDS: '4',
    DB_NAME: dbName,
    JWT_SECRET: crypto.randomBytes(48).toString('hex'),
    CLIENT_URL: 'http://localhost:5173',
    ...env,
  });

  // Imported only now, after the environment is in place
  const { default: mongoose } = await import('mongoose');
  const { connectDB } = await import('../src/config/db.js');
  const { default: app } = await import('../src/app.js');
  const { default: User } = await import('../src/models/User.js');
  const { default: StudentProfile } = await import('../src/models/StudentProfile.js');
  const { default: Job } = await import('../src/models/Job.js');
  const { default: Application } = await import('../src/models/Application.js');

  await connectDB();
  if (mongoose.connection.name !== dbName || !dbName.startsWith(DB_PREFIX)) {
    await mongoose.disconnect();
    throw new Error(`Refusing to run tests against database "${mongoose.connection.name}"`);
  }
  await Promise.all([User.init(), StudentProfile.init(), Job.init(), Application.init()]);

  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}/api`;

  /** Calls the API; returns { status, body, headers }. */
  async function api(path, { method = 'GET', body, token, headers = {}, rawBody } = {}) {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: {
        ...(body !== undefined || rawBody !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: rawBody ?? (body !== undefined ? JSON.stringify(body) : undefined),
    });
    return { status: res.status, body: await res.json().catch(() => null), headers: res.headers };
  }

  const uniq = () => crypto.randomBytes(4).toString('hex');

  /** Registers a student account (no profile). */
  async function makeStudent(name = 'Test Student', email = `student-${uniq()}@example.test`) {
    const res = await api('/auth/register', { method: 'POST', body: { name, email, password: PASSWORD } });
    if (res.status !== 201) throw new Error(`register failed: ${JSON.stringify(res.body)}`);
    return { token: res.body.token, user: res.body.user, email };
  }

  /** Registers a student and saves a profile; `profile` overrides the defaults. */
  async function makeStudentWithProfile(profile = {}, name, email) {
    const s = await makeStudent(name, email);
    const res = await api('/students/me', {
      method: 'PUT',
      token: s.token,
      body: { rollNo: `R${uniq()}`, branch: 'CSE', cgpa: 8.5, batchYear: 2026, backlogs: 0, ...profile },
    });
    if (res.status !== 200) throw new Error(`profile failed: ${JSON.stringify(res.body)}`);
    return { ...s, profile: res.body.profile };
  }

  /** Creates an admin directly in the database (public registration can't), then logs in. */
  async function makeAdmin(email = `admin-${uniq()}@example.test`) {
    const doc = await User.create({
      name: 'Test Admin',
      email,
      role: 'admin',
      passwordHash: await User.hashPassword(PASSWORD),
    });
    const res = await api('/auth/login', { method: 'POST', body: { email, password: PASSWORD } });
    return { token: res.body.token, user: res.body.user, doc, email };
  }

  /** Posts a job as the given admin; `overrides` can replace any field. */
  async function makeJob(admin, overrides = {}) {
    const res = await api('/jobs', {
      method: 'POST',
      token: admin.token,
      body: {
        title: 'Software Engineer',
        company: 'Acme',
        description: 'A role worth applying to.',
        type: 'full-time',
        deadline: future(10).toISOString(),
        eligibility: {},
        ...overrides,
      },
    });
    if (res.status !== 201) throw new Error(`job failed: ${JSON.stringify(res.body)}`);
    return res.body.job;
  }

  async function teardown() {
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
    if (mongoose.connection.name === dbName) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }

  return {
    api,
    base,
    teardown,
    makeStudent,
    makeStudentWithProfile,
    makeAdmin,
    makeJob,
    models: { User, StudentProfile, Job, Application },
    mongoose,
    dbName,
  };
}
