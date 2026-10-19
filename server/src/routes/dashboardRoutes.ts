import { Router } from 'express';
import { dashboardController } from '../controllers/dashboardController.js';

const router = Router();

router.get('/today', (req, res, next) => dashboardController.getToday(req, res, next));

export default router;
