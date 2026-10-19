import { Router } from 'express';
import { z } from 'zod';
import { entriesController } from '../controllers/entriesController.js';
import { validateBody } from '../middleware/validate.js';

const router = Router();

const milkSaleSchema = z.object({
  liters: z.number().nonnegative('Liters must be non-negative'),
  ratePerLiter: z.number().positive('Rate must be positive'),
  buyerId: z.number().int().positive().optional().nullable(),
  paidAmount: z.number().nonnegative().optional().default(0),
});

const expenseSchema = z.object({
  category: z.enum(['feed', 'medicine', 'labor', 'electricity', 'other']),
  amount: z.number().positive('Expense amount must be positive'),
  note: z.string().optional().nullable(),
});

const saveEntrySchema = z.object({
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be formatted as YYYY-MM-DD'),
  otherIncome: z.number().nonnegative().optional().default(0),
  savings: z.number().nonnegative().optional().default(0),
  notes: z.string().optional().nullable(),
  morningSales: milkSaleSchema,
  eveningSales: milkSaleSchema,
  expenses: z.array(expenseSchema).optional().default([]),
});

router.post('/', validateBody(saveEntrySchema), (req, res, next) =>
  entriesController.save(req, res, next)
);
router.get('/:date', (req, res, next) => entriesController.getByDate(req, res, next));

export default router;
