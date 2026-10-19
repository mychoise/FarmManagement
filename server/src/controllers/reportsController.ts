import { Request, Response, NextFunction } from 'express';
import { reportsService } from '../services/reportsService.js';

export class ReportsController {
  async getWeekly(req: Request, res: Response, next: NextFunction) {
    try {
      const start = req.query.start as string;
      if (!start || !/^\d{4}-\d{2}-\d{2}$/.test(start)) {
        return res.status(400).json({ error: 'Query parameter "start" must be formatted as YYYY-MM-DD' });
      }

      const report = await reportsService.getWeeklyReport(start);
      res.json(report);
    } catch (err) {
      next(err);
    }
  }

  async getMonthly(req: Request, res: Response, next: NextFunction) {
    try {
      const month = req.query.month as string;
      if (!month || !/^\d{4}-\d{2}$/.test(month)) {
        return res.status(400).json({ error: 'Query parameter "month" must be formatted as YYYY-MM' });
      }

      const report = await reportsService.getMonthlyReport(month);
      res.json(report);
    } catch (err) {
      next(err);
    }
  }
}

export const reportsController = new ReportsController();
