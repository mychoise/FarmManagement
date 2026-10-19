import { Request, Response, NextFunction } from 'express';
import { paymentsService } from '../services/paymentsService.js';

export class PaymentsController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await paymentsService.recordPayment(req.body);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }
}

export const paymentsController = new PaymentsController();
