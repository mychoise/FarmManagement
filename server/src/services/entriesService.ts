import { sql, eq } from 'drizzle-orm';
import { db, dailyEntries, milkSales, expenses } from '../db/index.js';

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

      // 2. Refresh milk sales for this entryDate (delete existing then re-insert)
      await tx.delete(milkSales).where(eq(milkSales.entryDate, input.entryDate));

      const morningTotal = (input.morningSales.liters * input.morningSales.ratePerLiter).toFixed(2);
      const eveningTotal = (input.eveningSales.liters * input.eveningSales.ratePerLiter).toFixed(2);

      const insertedMilkSales = await tx
        .insert(milkSales)
        .values([
          {
            entryDate: input.entryDate,
            session: 'morning',
            buyerId: input.morningSales.buyerId || null,
            liters: input.morningSales.liters.toFixed(2),
            ratePerLiter: input.morningSales.ratePerLiter.toFixed(2),
            totalAmount: morningTotal,
            paidAmount: (input.morningSales.paidAmount || 0).toFixed(2),
          },
          {
            entryDate: input.entryDate,
            session: 'evening',
            buyerId: input.eveningSales.buyerId || null,
            liters: input.eveningSales.liters.toFixed(2),
            ratePerLiter: input.eveningSales.ratePerLiter.toFixed(2),
            totalAmount: eveningTotal,
            paidAmount: (input.eveningSales.paidAmount || 0).toFixed(2),
          },
        ])
        .returning();

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

      // Return full saved structure
      return {
        dailyEntry: entry,
        milkSales: insertedMilkSales,
        expenses: insertedExpenses,
      };
    });
  }

  async getDailyEntryByDate(dateStr: string) {
    const [entry] = await db
      .select()
      .from(dailyEntries)
      .where(eq(dailyEntries.entryDate, dateStr))
      .limit(1);

    const sales = await db
      .select()
      .from(milkSales)
      .where(eq(milkSales.entryDate, dateStr));

    const exp = await db
      .select()
      .from(expenses)
      .where(eq(expenses.entryDate, dateStr));

    const morningSale = sales.find((s) => s.session === 'morning') || null;
    const eveningSale = sales.find((s) => s.session === 'evening') || null;

    const totalMilkAmount = sales.reduce(
      (sum, s) => sum + parseFloat(s.totalAmount || '0'),
      0
    );
    const totalLiters = sales.reduce(
      (sum, s) => sum + parseFloat(s.liters || '0'),
      0
    );
    const otherIncome = entry ? parseFloat(entry.otherIncome || '0') : 0;
    const totalExpenses = exp.reduce(
      (sum, e) => sum + parseFloat(e.amount || '0'),
      0
    );
    const totalIncome = totalMilkAmount + otherIncome;
    const savings = entry ? parseFloat(entry.savings || '0') : 0;
    const netProfit = totalIncome - totalExpenses;

    return {
      exists: Boolean(entry || sales.length > 0 || exp.length > 0),
      entryDate: dateStr,
      dailyEntry: entry || null,
      morningSales: morningSale,
      eveningSales: eveningSale,
      expenses: exp,
      summary: {
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
