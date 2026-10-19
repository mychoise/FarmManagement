import { Request, Response, NextFunction } from 'express';
import { entriesService } from '../services/entriesService.js';

export class EntriesController {
  async save(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await entriesService.saveDailyEntry(req.body);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  async getByDate(req: Request, res: Response, next: NextFunction) {
    try {
      const dateParam = Array.isArray(req.params.date) ? req.params.date[0] : req.params.date;
      if (!dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
        return res.status(400).json({ error: 'Date must be formatted as YYYY-MM-DD' });
      }

      const result = await entriesService.getDailyEntryByDate(dateParam);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
}

export const entriesController = new EntriesController();
