import { Request, Response, NextFunction } from 'express';
import { buyersService } from '../services/buyersService.js';

export class BuyersController {
  async getAll(_req: Request, res: Response, next: NextFunction) {
    try {
      const buyers = await buyersService.getAllBuyers();
      res.json(buyers);
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const id = parseInt(idParam, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid buyer ID' });
      }

      const buyer = await buyersService.getBuyerById(id);
      if (!buyer) {
        return res.status(404).json({ error: 'Buyer not found' });
      }

      res.json(buyer);
    } catch (err) {
      next(err);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const newBuyer = await buyersService.createBuyer(req.body);
      res.status(201).json(newBuyer);
    } catch (err) {
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const id = parseInt(idParam, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid buyer ID' });
      }

      const updated = await buyersService.updateBuyer(id, req.body);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }

  async getCalendar(req: Request, res: Response, next: NextFunction) {
    try {
      const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const id = parseInt(idParam, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid buyer ID' });
      }

      const calendar = await buyersService.getBuyerCalendar(id);
      if (!calendar) {
        return res.status(404).json({ error: 'Buyer not found' });
      }

      res.json(calendar);
    } catch (err) {
      next(err);
    }
  }

  async recordDispatch(req: Request, res: Response, next: NextFunction) {
    try {
      const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const id = parseInt(idParam, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid buyer ID' });
      }

      const result = await buyersService.recordMilkDispatch(id, req.body);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async autoAssign(_req: Request, res: Response, next: NextFunction) {
    try {
      const result = await buyersService.autoAssignMonthlyDispatches();
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
}

export const buyersController = new BuyersController();
