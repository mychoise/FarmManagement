import { sql } from 'drizzle-orm';
import { db, payments, buyers } from '../db/index.js';
import { buyersService } from './buyersService.js';

export interface CreatePaymentInput {
  buyerId: number;
  amount: number;
  paymentDate: string;
  paymentMethod?: 'cash' | 'online' | 'bank' | string;
  reference?: string | null;
  note?: string | null;
}

export class PaymentsService {
  async recordPayment(input: CreatePaymentInput) {
    return await db.transaction(async (tx) => {
      // 1. Verify buyer exists
      const [buyer] = await tx
        .select()
        .from(buyers)
        .where(sql`${buyers.id} = ${input.buyerId}`)
        .limit(1);

      if (!buyer) {
        throw new Error(`Buyer with ID ${input.buyerId} not found`);
      }

      // 2. Insert payment record
      const [newPayment] = await tx
        .insert(payments)
        .values({
          buyerId: input.buyerId,
          amount: input.amount.toFixed(2),
          paymentDate: input.paymentDate,
          paymentMethod: input.paymentMethod || 'cash',
          reference: input.reference || null,
          note: input.note || null,
        })
        .returning();

      // 3. Return payment details and updated buyer status
      const updatedBuyer = await buyersService.getBuyerById(input.buyerId);

      return {
        payment: newPayment,
        buyer: updatedBuyer,
      };
    });
  }
}

export const paymentsService = new PaymentsService();
