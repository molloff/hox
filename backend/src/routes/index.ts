import { Router } from 'express';
import authRoutes from './auth.routes.js';
import kycRoutes from './kyc.routes.js';
import profileRoutes from './profile.routes.js';
import vaultRoutes from './vault.routes.js';
import payRoutes from './pay.routes.js';
import dealRoutes from './deal.routes.js';
import indexRoutes from './index.routes.js';
import connectRoutes from './connect.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/kyc', kycRoutes);
router.use('/profile', profileRoutes);
router.use('/vault', vaultRoutes);
router.use('/pay', payRoutes);
router.use('/deal', dealRoutes);
router.use('/index', indexRoutes);
router.use('/connect', connectRoutes);

// Health check
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', modules: ['identity', 'vault', 'pay', 'deal', 'index', 'connect'], timestamp: new Date().toISOString() });
});

export default router;
