import 'dotenv/config';
import mongoose from 'mongoose';
import app from './app.js';
import { connectDB } from './config/db.js';
import { assertEnv } from './config/env.js';

const PORT = process.env.PORT || 5000;

const fail = (err) => {
  console.error(`Startup failed: ${err.message}`);
  process.exit(1);
};

try {
  assertEnv();
  await connectDB();
} catch (err) {
  fail(err);
}

// Express 5 passes listen errors (e.g. EADDRINUSE) to this callback
const server = app.listen(PORT, (err) => {
  if (err) fail(err);
  console.log(`API listening on http://localhost:${PORT}`);
});

// Hosts send SIGTERM on deploys: finish in-flight requests, close the DB, then exit
const shutdown = (signal) => {
  console.log(`${signal} received, shutting down`);
  server.close(async () => {
    await mongoose.disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
