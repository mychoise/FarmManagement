import { Router } from 'express';
import buyersRoutes from './buyersRoutes.js';
import entriesRoutes from './entriesRoutes.js';
import dashboardRoutes from './dashboardRoutes.js';
import paymentsRoutes from './paymentsRoutes.js';
import reportsRoutes from './reportsRoutes.js';

const router = Router();

router.use('/buyers', buyersRoutes);
router.use('/entries', entriesRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/payments', paymentsRoutes);
router.use('/reports', reportsRoutes);

// Health check endpoint
router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'Green Pasture Dairy Ledger API',
    database: 'AbhishekFarm',
    timestamp: new Date().toISOString(),
  });
});

export default router;
