import { Router } from 'express';
import { reportsController } from '../controllers/reportsController.js';

const router = Router();

router.get('/weekly', (req, res, next) => reportsController.getWeekly(req, res, next));
router.get('/monthly', (req, res, next) => reportsController.getMonthly(req, res, next));

export default router;
