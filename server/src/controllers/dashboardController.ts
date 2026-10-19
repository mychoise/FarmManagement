import { Request, Response, NextFunction } from 'express';
import { dashboardService } from '../services/dashboardService.js';

export class DashboardController {
  async getToday(req: Request, res: Response, next: NextFunction) {
    try {
      const date = req.query.date as string | undefined;
      const data = await dashboardService.getTodayDashboard(date);
      res.json(data);
    } catch (err) {
      next(err);
    }
  }
}

export const dashboardController = new DashboardController();
