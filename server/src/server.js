import 'dotenv/config';
import app from './app.js';
import { connectDB } from './config/db.js';
import { assertEnv } from './config/env.js';

const PORT = process.env.PORT || 5000;

try {
  assertEnv();
  await connectDB();
  // Express 5 passes listen errors (e.g. EADDRINUSE) to this callback
  app.listen(PORT, (err) => {
    if (err) {
      console.error(`Startup failed: ${err.message}`);
      process.exit(1);
    }
    console.log(`API listening on http://localhost:${PORT}`);
  });
} catch (err) {
  console.error(`Startup failed: ${err.message}`);
  process.exit(1);
}
