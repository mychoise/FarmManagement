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
      const month = req.query.month as string | undefined;
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      const label = req.query.label as string | undefined;

      if (!startDate && (!month || !/^\d{4}-\d{2}$/.test(month))) {
        return res.status(400).json({
          error: 'Query parameter "month" (YYYY-MM) or "startDate" & "endDate" (YYYY-MM-DD) required',
        });
      }

      const report = await reportsService.getMonthlyReport(month || '', startDate, endDate, label);
      res.json(report);
    } catch (err) {
      next(err);
    }
  }
}

export const reportsController = new ReportsController();
