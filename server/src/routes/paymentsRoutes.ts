import { Router } from 'express';
import { z } from 'zod';
import { paymentsController } from '../controllers/paymentsController.js';
import { validateBody } from '../middleware/validate.js';

const router = Router();

const createPaymentSchema = z.object({
  buyerId: z.number().int().positive('buyerId must be a positive integer'),
  amount: z.number().positive('amount must be greater than 0'),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'paymentDate must be formatted as YYYY-MM-DD'),
  note: z.string().optional().nullable(),
});

router.post('/', validateBody(createPaymentSchema), (req, res, next) =>
  paymentsController.create(req, res, next)
);

export default router;
