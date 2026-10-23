import { sql, eq } from 'drizzle-orm';
import { db, dailyEntries, milkSales, expenses } from '../db/index.js';
import { buyersService } from './buyersService.js';

export interface MilkSaleInput {
  liters: number;
  ratePerLiter: number;
  buyerId?: number | null;
  paidAmount?: number;
}

export interface ExpenseInput {
  category: 'feed' | 'medicine' | 'labor' | 'electricity' | 'other';
  amount: number;
  note?: string | null;
}

export interface SaveDailyEntryInput {
  entryDate: string;
  otherIncome?: number;
  savings?: number;
  notes?: string | null;
  morningSales: MilkSaleInput;
  eveningSales: MilkSaleInput;
  expenses?: ExpenseInput[];
}

export class EntriesService {
  async saveDailyEntry(input: SaveDailyEntryInput) {
    return await db.transaction(async (tx) => {
      // 1. Upsert daily_entries
      const otherIncomeVal = (input.otherIncome || 0).toFixed(2);
      const savingsVal = (input.savings || 0).toFixed(2);

      const [entry] = await tx
        .insert(dailyEntries)
        .values({
          entryDate: input.entryDate,
          otherIncome: otherIncomeVal,
          savings: savingsVal,
          notes: input.notes || null,
        })
        .onConflictDoUpdate({
          target: dailyEntries.entryDate,
          set: {
            otherIncome: otherIncomeVal,
            savings: savingsVal,
            notes: input.notes || null,
          },
        })
        .returning();

      // 2. Refresh only general / walk-in sales (buyerId IS NULL) so auto-assigned buyer sales are preserved!
      await tx.execute(sql`
        DELETE FROM milk_sales 
        WHERE entry_date = ${input.entryDate}::date AND buyer_id IS NULL
      `);

      const generalSalesToInsert: any[] = [];

      const mLiters = Number(input.morningSales?.liters || 0);
      const mRate = Number(input.morningSales?.ratePerLiter || 85);
      if (mLiters > 0) {
        generalSalesToInsert.push({
          entryDate: input.entryDate,
          session: 'morning',
          buyerId: null,
          liters: mLiters.toFixed(2),
          ratePerLiter: mRate.toFixed(2),
          totalAmount: (mLiters * mRate).toFixed(2),
          paidAmount: (input.morningSales.paidAmount || 0).toFixed(2),
        });
      }

      const eLiters = Number(input.eveningSales?.liters || 0);
      const eRate = Number(input.eveningSales?.ratePerLiter || 85);
      if (eLiters > 0) {
        generalSalesToInsert.push({
          entryDate: input.entryDate,
          session: 'evening',
          buyerId: null,
          liters: eLiters.toFixed(2),
          ratePerLiter: eRate.toFixed(2),
          totalAmount: (eLiters * eRate).toFixed(2),
          paidAmount: (input.eveningSales.paidAmount || 0).toFixed(2),
        });
      }

      let insertedMilkSales: any[] = [];
      if (generalSalesToInsert.length > 0) {
        insertedMilkSales = await tx
          .insert(milkSales)
          .values(generalSalesToInsert)
          .returning();
      }

      // 3. Refresh expenses for this entryDate
      await tx.delete(expenses).where(eq(expenses.entryDate, input.entryDate));

      let insertedExpenses: any[] = [];
      if (input.expenses && input.expenses.length > 0) {
        insertedExpenses = await tx
          .insert(expenses)
          .values(
            input.expenses.map((e) => ({
              entryDate: input.entryDate,
              category: e.category,
              amount: e.amount.toFixed(2),
              note: e.note || null,
            }))
          )
          .returning();
      }

      return {
        dailyEntry: entry,
        generalMilkSales: insertedMilkSales,
        expenses: insertedExpenses,
      };
    });
  }

  async getDailyEntryByDate(dateStr: string) {
    // 1. Advance automatic buyer dispatches up to this date
    try {
      await buyersService.autoAssignMonthlyDispatches(dateStr);
    } catch (err) {
      console.error('Error auto-assigning in getDailyEntryByDate:', err);
    }

    // 2. Query daily_entries
    const [entry] = await db
      .select()
      .from(dailyEntries)
      .where(eq(dailyEntries.entryDate, dateStr))
      .limit(1);

    // 3. Query all milk sales with buyer details
    const salesResult = await db.execute(sql`
      SELECT 
        ms.id,
        ms.entry_date as "entryDate",
        ms.session,
        ms.buyer_id as "buyerId",
        b.name as "buyerName",
        COALESCE(ms.liters, 0)::numeric(10,2) as liters,
        COALESCE(ms.rate_per_liter, 0)::numeric(12,2) as "ratePerLiter",
        COALESCE(ms.total_amount, 0)::numeric(12,2) as "totalAmount",
        COALESCE(ms.paid_amount, 0)::numeric(12,2) as "paidAmount"
      FROM milk_sales ms
      LEFT JOIN buyers b ON ms.buyer_id = b.id
      WHERE ms.entry_date = ${dateStr}::date
      ORDER BY ms.session ASC, b.name ASC
    `);

    const allSales = salesResult.rows.map((r: any) => ({
      id: Number(r.id),
      entryDate: String(r.entryDate),
      session: r.session as 'morning' | 'evening',
      buyerId: r.buyerId ? Number(r.buyerId) : null,
      buyerName: r.buyerName ? String(r.buyerName) : null,
      liters: parseFloat(r.liters || '0'),
      ratePerLiter: parseFloat(r.ratePerLiter || '0'),
      totalAmount: parseFloat(r.totalAmount || '0'),
      paidAmount: parseFloat(r.paidAmount || '0'),
    }));

    // Auto-assigned buyer dispatches
    const autoBuyerSales = allSales.filter((s) => s.buyerId !== null);
    const morningBuyers = autoBuyerSales.filter((s) => s.session === 'morning');
    const eveningBuyers = autoBuyerSales.filter((s) => s.session === 'evening');

    const autoMorningLiters = morningBuyers.reduce((sum, s) => sum + s.liters, 0);
    const autoMorningAmount = morningBuyers.reduce((sum, s) => sum + s.totalAmount, 0);

    const autoEveningLiters = eveningBuyers.reduce((sum, s) => sum + s.liters, 0);
    const autoEveningAmount = eveningBuyers.reduce((sum, s) => sum + s.totalAmount, 0);

    const uniqueBuyerIds = new Set(autoBuyerSales.map((s) => s.buyerId));

    // General / walk-in sales (buyerId IS NULL)
    const generalSales = allSales.filter((s) => s.buyerId === null);
    const generalMorning = generalSales.find((s) => s.session === 'morning') || {
      liters: 0,
      ratePerLiter: 85,
      totalAmount: 0,
    };
    const generalEvening = generalSales.find((s) => s.session === 'evening') || {
      liters: 0,
      ratePerLiter: 85,
      totalAmount: 0,
    };

    // 4. Query expenses
    const exp = await db
      .select()
      .from(expenses)
      .where(eq(expenses.entryDate, dateStr));

    // Combined calculations
    const totalMorningLiters = autoMorningLiters + generalMorning.liters;
    const totalMorningAmount = autoMorningAmount + generalMorning.totalAmount;

    const totalEveningLiters = autoEveningLiters + generalEvening.liters;
    const totalEveningAmount = autoEveningAmount + generalEvening.totalAmount;

    const totalLiters = totalMorningLiters + totalEveningLiters;
    const totalMilkAmount = totalMorningAmount + totalEveningAmount;

    const otherIncome = entry ? parseFloat(entry.otherIncome || '0') : 0;
    const totalExpenses = exp.reduce(
      (sum, e) => sum + parseFloat(e.amount || '0'),
      0
    );
    const totalIncome = totalMilkAmount + otherIncome;
    const savings = entry ? parseFloat(entry.savings || '0') : 0;
    const netProfit = totalIncome - totalExpenses;

    return {
      exists: Boolean(entry || allSales.length > 0 || exp.length > 0),
      entryDate: dateStr,
      dailyEntry: entry || null,
      autoBuyerSummary: {
        buyersCount: uniqueBuyerIds.size,
        totalLiters: autoMorningLiters + autoEveningLiters,
        totalAmount: autoMorningAmount + autoEveningAmount,
        morningLiters: autoMorningLiters,
        morningAmount: autoMorningAmount,
        eveningLiters: autoEveningLiters,
        eveningAmount: autoEveningAmount,
        morningBuyers: morningBuyers.map((b) => ({
          buyerId: b.buyerId,
          buyerName: b.buyerName,
          liters: b.liters,
          rate: b.ratePerLiter,
          amount: b.totalAmount,
        })),
        eveningBuyers: eveningBuyers.map((b) => ({
          buyerId: b.buyerId,
          buyerName: b.buyerName,
          liters: b.liters,
          rate: b.ratePerLiter,
          amount: b.totalAmount,
        })),
      },
      generalSales: {
        morning: {
          liters: generalMorning.liters,
          ratePerLiter: generalMorning.ratePerLiter,
          totalAmount: generalMorning.totalAmount,
        },
        evening: {
          liters: generalEvening.liters,
          ratePerLiter: generalEvening.ratePerLiter,
          totalAmount: generalEvening.totalAmount,
        },
      },
      morningSales: {
        liters: totalMorningLiters,
        amount: totalMorningAmount,
        autoLiters: autoMorningLiters,
        additionalLiters: generalMorning.liters,
      },
      eveningSales: {
        liters: totalEveningLiters,
        amount: totalEveningAmount,
        autoLiters: autoEveningLiters,
        additionalLiters: generalEvening.liters,
      },
      expenses: exp,
      summary: {
        autoBuyerLiters: autoMorningLiters + autoEveningLiters,
        autoBuyerAmount: autoMorningAmount + autoEveningAmount,
        additionalLiters: generalMorning.liters + generalEvening.liters,
        additionalAmount: generalMorning.totalAmount + generalEvening.totalAmount,
        totalLiters,
        totalMilkAmount,
        otherIncome,
        totalIncome,
        totalExpenses,
        savings,
        netProfit,
      },
    };
  }
}

export const entriesService = new EntriesService();

