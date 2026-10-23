import { Router } from 'express';
import { z } from 'zod';
import { buyersController } from '../controllers/buyersController.js';
import { validateBody } from '../middleware/validate.js';

const router = Router();

const createBuyerSchema = z.object({
  name: z.string().min(1, 'Buyer name is required'),
  phone: z
    .string()
    .refine((val) => {
      if (!val || val.trim().length === 0) return true;
      const digits = val.replace(/\D/g, '');
      const nat = digits.startsWith('977') && digits.length === 13 ? digits.slice(3) : digits;
      return nat.length === 10;
    }, 'Phone number must be exactly 10 digits')
    .optional()
    .nullable(),
  buyerType: z.enum(['monthly', 'one_time']).optional().default('monthly'),
  defaultLiters: z.number().min(0).optional().nullable(),
  defaultRate: z.number().positive().optional().nullable(),
  defaultSession: z.enum(['morning', 'evening', 'both']).optional().default('morning'),
  autoAssign: z.boolean().optional().default(true),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be formatted as YYYY-MM-DD').optional().nullable(),
});

const updateBuyerSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z
    .string()
    .refine((val) => {
      if (!val || val.trim().length === 0) return true;
      const digits = val.replace(/\D/g, '');
      const nat = digits.startsWith('977') && digits.length === 13 ? digits.slice(3) : digits;
      return nat.length === 10;
    }, 'Phone number must be exactly 10 digits')
    .optional()
    .nullable(),
  buyerType: z.enum(['monthly', 'one_time']).optional(),
  defaultLiters: z.number().min(0).optional().nullable(),
  defaultRate: z.number().positive().optional().nullable(),
  defaultSession: z.enum(['morning', 'evening', 'both']).optional(),
  autoAssign: z.boolean().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be formatted as YYYY-MM-DD').optional().nullable(),
});

const recordDispatchSchema = z.object({
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be formatted as YYYY-MM-DD'),
  session: z.enum(['morning', 'evening', 'both']),
  liters: z.number().min(0, 'Liters cannot be negative'),
  ratePerLiter: z.number().positive('Rate must be positive'),
  paidAmount: z.number().min(0).optional().default(0),
  saveAsDefault: z.boolean().optional(),
});

router.post('/auto-assign', (req, res, next) =>
  buyersController.autoAssign(req, res, next)
);
router.get('/', (req, res, next) => buyersController.getAll(req, res, next));
router.get('/:id', (req, res, next) => buyersController.getById(req, res, next));
router.get('/:id/calendar', (req, res, next) => buyersController.getCalendar(req, res, next));
router.post('/', validateBody(createBuyerSchema), (req, res, next) =>
  buyersController.create(req, res, next)
);
router.patch('/:id', validateBody(updateBuyerSchema), (req, res, next) =>
  buyersController.update(req, res, next)
);
router.put('/:id', validateBody(updateBuyerSchema), (req, res, next) =>
  buyersController.update(req, res, next)
);
router.post('/:id/dispatch', validateBody(recordDispatchSchema), (req, res, next) =>
  buyersController.recordDispatch(req, res, next)
);

export default router;
