import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pinoHttp from 'pino-http';
import { env } from './config/env.js';
import { initVault } from './config/vault.js';
import { generalLimiter } from './middleware/rateLimit.js';
import { errorHandler } from './middleware/errorHandler.js';
import routes from './routes/index.js';
import { logger } from './utils/logger.js';

// Import bus to register event listeners
import './services/bus.service.js';
// Import index-engine to register bus→index event listeners
import './services/index-engine.service.js';
// Import notification scheduler to register bus→push listeners
import './services/notification-scheduler.service.js';

const app = express();

// Security headers
app.use(helmet());

// CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));

// Body parsing — capture raw body for webhook HMAC verification
app.use(express.json({
  limit: '1mb',
  verify: (req: express.Request, _res, buf) => {
    (req as express.Request & { rawBody?: Buffer }).rawBody = buf;
  },
}));

// Request logging (redacts sensitive fields)
app.use(pinoHttp({ logger: logger as any }));

// Global rate limit
app.use(generalLimiter);

// Routes
app.use('/api', routes);

// Error handler
app.use(errorHandler);

// Start
async function start() {
  try {
    await initVault();
    logger.info('Vault connection established');
  } catch {
    logger.warn('Vault not available — running without encryption key management');
  }

  app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, 'HOX Identity backend running');
  });
}

start();
