import { sql } from 'drizzle-orm';
import { db } from '../db/index.js';

export class DashboardService {
  async getTodayDashboard(targetDate?: string) {
    const today = targetDate || new Date().toISOString().slice(0, 10);

    // 1. Query today's milk sales in SQL
    const salesResult = await db.execute(sql`
      SELECT 
        session,
        COALESCE(SUM(liters), 0)::numeric(10,2) as liters,
        COALESCE(SUM(total_amount), 0)::numeric(12,2) as amount
      FROM milk_sales
      WHERE entry_date = ${today}
      GROUP BY session
    `);

    let morningLiters = 0;
    let morningAmount = 0;
    let eveningLiters = 0;
    let eveningAmount = 0;

    salesResult.rows.forEach((r: any) => {
      if (r.session === 'morning') {
        morningLiters = parseFloat(r.liters || '0');
        morningAmount = parseFloat(r.amount || '0');
      } else if (r.session === 'evening') {
        eveningLiters = parseFloat(r.liters || '0');
        eveningAmount = parseFloat(r.amount || '0');
      }
    });

    const totalMilkAmount = morningAmount + eveningAmount;
    const totalLiters = morningLiters + eveningLiters;

    // 2. Query today's daily entry (other_income, savings) in SQL
    const entryResult = await db.execute(sql`
      SELECT 
        COALESCE(other_income, 0)::numeric(12,2) as "otherIncome",
        COALESCE(savings, 0)::numeric(12,2) as savings,
        notes
      FROM daily_entries
      WHERE entry_date = ${today}
      LIMIT 1
    `);

    const entryRow = entryResult.rows[0] as any;
    const otherIncome = entryRow ? parseFloat(entryRow.otherIncome || '0') : 0;
    const savings = entryRow ? parseFloat(entryRow.savings || '0') : 0;

    // 3. Query today's expenditure in SQL
    const expenseResult = await db.execute(sql`
      SELECT 
        COALESCE(SUM(amount), 0)::numeric(12,2) as "totalExpense"
      FROM expenses
      WHERE entry_date = ${today}
    `);

    const expenseRow = expenseResult.rows[0] as any;
    const totalExpenditure = expenseRow ? parseFloat(expenseRow.totalExpense || '0') : 0;

    const totalIncome = totalMilkAmount + otherIncome;
    const netProfit = totalIncome - totalExpenditure;

    // 4. Query total amount to receive across all buyers in SQL
    const receivablesResult = await db.execute(sql`
      SELECT 
        COALESCE(SUM(balance), 0)::numeric(12,2) as "totalReceivable",
        COUNT(CASE WHEN balance > 0 THEN 1 END)::int as "overdueCount"
      FROM (
        SELECT 
          b.id,
          GREATEST(0, (COALESCE(sales.unpaid_sales, 0) - COALESCE(pmts.total_payments, 0))) as balance
        FROM buyers b
        LEFT JOIN (
          SELECT 
            buyer_id,
            SUM(total_amount - paid_amount) as unpaid_sales
          FROM milk_sales
          WHERE buyer_id IS NOT NULL
          GROUP BY buyer_id
        ) sales ON b.id = sales.buyer_id
        LEFT JOIN (
          SELECT 
            buyer_id,
            SUM(amount) as total_payments
          FROM payments
          GROUP BY buyer_id
        ) pmts ON b.id = pmts.buyer_id
      ) balances
    `);

    const recRow = receivablesResult.rows[0] as any;
    const totalAmountToReceive = recRow ? parseFloat(recRow.totalReceivable || '0') : 0;
    const overdueBuyersCount = recRow ? Number(recRow.overdueCount || 0) : 0;

    return {
      date: today,
      income: totalIncome,
      expenditure: totalExpenditure,
      savings,
      totalLiters,
      netProfit,
      marginPercent: totalIncome > 0 ? Math.round((netProfit / totalIncome) * 100) : 0,
      breakdown: {
        milkIncome: totalMilkAmount,
        otherIncome,
      },
      morningSales: {
        liters: morningLiters,
        amount: morningAmount,
      },
      eveningSales: {
        liters: eveningLiters,
        amount: eveningAmount,
      },
      receivables: {
        totalAmount: totalAmountToReceive,
        overdueCount: overdueBuyersCount,
      },
    };
  }
}

export const dashboardService = new DashboardService();
