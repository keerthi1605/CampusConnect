import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { buildCorsOptions } from './config/cors.js';
import { apiLimiter } from './config/rateLimit.js';
import routes from './routes/index.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

const app = express();

// Behind a hosting proxy (Render, Railway...) set TRUST_PROXY=1 so req.ip is the real client
// and rate limits apply per visitor, not to the proxy as a whole. Leave unset when not proxied.
if (process.env.TRUST_PROXY) {
  const hops = Number(process.env.TRUST_PROXY);
  app.set('trust proxy', Number.isNaN(hops) ? process.env.TRUST_PROXY : hops);
}

app.use(helmet());
app.use(cors(buildCorsOptions()));
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}
// Largest legitimate body is a job posting (~5k-character description), so 20kb is generous;
// bigger requests get a 413 before they are parsed
app.use(express.json({ limit: process.env.BODY_LIMIT || '20kb' }));

app.use('/api', apiLimiter, routes);

app.use(notFound);
app.use(errorHandler);

export default app;
