import { sql } from 'drizzle-orm';
import { db } from '../db/index.js';

export class ReportsService {
  async getWeeklyReport(startDateStr: string) {
    const startResult = await db.execute(sql`
      SELECT 
        ${startDateStr}::date as "startDate",
        (${startDateStr}::date + INTERVAL '6 days')::date as "endDate"
    `);

    const { startDate, endDate } = startResult.rows[0] as any;

    // 1. Overall Aggregates in SQL
    const overallResult = await db.execute(sql`
      SELECT
        COALESCE(sales.total_milk, 0)::numeric(12,2) as "totalMilkAmount",
        COALESCE(sales.total_liters, 0)::numeric(10,2) as "litersSold",
        COALESCE(entries.total_other, 0)::numeric(12,2) as "otherIncome",
        COALESCE(entries.total_savings, 0)::numeric(12,2) as "savings",
        COALESCE(exp.total_expense, 0)::numeric(12,2) as "totalExpenditure"
      FROM (
        SELECT 1 as id
      ) dummy
      LEFT JOIN (
        SELECT 1 as id, SUM(total_amount) as total_milk, SUM(liters) as total_liters
        FROM milk_sales
        WHERE entry_date BETWEEN ${startDate} AND ${endDate}
      ) sales ON true
      LEFT JOIN (
        SELECT 1 as id, SUM(other_income) as total_other, SUM(savings) as total_savings
        FROM daily_entries
        WHERE entry_date BETWEEN ${startDate} AND ${endDate}
      ) entries ON true
      LEFT JOIN (
        SELECT 1 as id, SUM(amount) as total_expense
        FROM expenses
        WHERE entry_date BETWEEN ${startDate} AND ${endDate}
      ) exp ON true
    `);

    const o = overallResult.rows[0] as any;
    const milkIncome = parseFloat(o.totalMilkAmount || '0');
    const otherIncome = parseFloat(o.otherIncome || '0');
    const totalIncome = milkIncome + otherIncome;
    const totalExpenditure = parseFloat(o.totalExpenditure || '0');
    const savings = parseFloat(o.savings || '0');
    const litersSold = parseFloat(o.litersSold || '0');
    const netProfit = totalIncome - totalExpenditure;

    // 2. Daily Breakdown in SQL
    const dailyResult = await db.execute(sql`
      SELECT
        d::date as "date",
        TO_CHAR(d, 'Dy') as "dayName",
        COALESCE(sales.total_amount, 0)::numeric(12,2) as "milkIncome",
        COALESCE(sales.liters, 0)::numeric(10,2) as "liters",
        COALESCE(entries.other_income, 0)::numeric(12,2) as "otherIncome",
        (COALESCE(sales.total_amount, 0) + COALESCE(entries.other_income, 0))::numeric(12,2) as "income",
        COALESCE(exp.total_expense, 0)::numeric(12,2) as "expenditure",
        ((COALESCE(sales.total_amount, 0) + COALESCE(entries.other_income, 0)) - COALESCE(exp.total_expense, 0))::numeric(12,2) as "netProfit"
      FROM generate_series(${startDate}::date, ${endDate}::date, '1 day'::interval) d
      LEFT JOIN (
        SELECT entry_date, SUM(total_amount) as total_amount, SUM(liters) as liters
        FROM milk_sales
        WHERE entry_date BETWEEN ${startDate} AND ${endDate}
        GROUP BY entry_date
      ) sales ON d::date = sales.entry_date
      LEFT JOIN daily_entries entries ON d::date = entries.entry_date
      LEFT JOIN (
        SELECT entry_date, SUM(amount) as total_expense
        FROM expenses
        WHERE entry_date BETWEEN ${startDate} AND ${endDate}
        GROUP BY entry_date
      ) exp ON d::date = exp.entry_date
      ORDER BY d ASC
    `);

    const dailyBreakdown = dailyResult.rows.map((r: any) => ({
      date: String(r.date),
      dayName: String(r.dayName),
      liters: parseFloat(r.liters || '0'),
      income: parseFloat(r.income || '0'),
      expenditure: parseFloat(r.expenditure || '0'),
      netProfit: parseFloat(r.netProfit || '0'),
    }));

    // 3. Shift Breakdown in SQL
    const shiftResult = await db.execute(sql`
      SELECT 
        session,
        COALESCE(SUM(liters), 0)::numeric(10,2) as liters,
        COALESCE(SUM(total_amount), 0)::numeric(12,2) as amount
      FROM milk_sales
      WHERE entry_date BETWEEN ${startDate} AND ${endDate}
      GROUP BY session
    `);

    let morningLiters = 0;
    let eveningLiters = 0;
    shiftResult.rows.forEach((s: any) => {
      if (s.session === 'morning') morningLiters = parseFloat(s.liters || '0');
      if (s.session === 'evening') eveningLiters = parseFloat(s.liters || '0');
    });

    // 4. Expenses by Category in SQL
    const expensesByCategoryResult = await db.execute(sql`
      SELECT
        category,
        COALESCE(SUM(amount), 0)::numeric(12,2) as total,
        COUNT(*)::int as count
      FROM expenses
      WHERE entry_date BETWEEN ${startDate} AND ${endDate}
      GROUP BY category
      ORDER BY total DESC
    `);

    const expensesByCategory = expensesByCategoryResult.rows.map((c: any) => ({
      category: String(c.category),
      total: parseFloat(c.total || '0'),
      count: Number(c.count || 0),
      percentage: totalExpenditure > 0 ? Math.round((parseFloat(c.total || '0') / totalExpenditure) * 100) : 0,
    }));

    // 5. Best Day & Lowest Day in SQL
    const sortedDays = [...dailyBreakdown].sort((a, b) => b.netProfit - a.netProfit);
    const bestDay = sortedDays[0] || null;
    const lowestDay = sortedDays[sortedDays.length - 1] || null;

    return {
      period: 'weekly',
      startDate,
      endDate,
      totalIncome,
      totalExpenditure,
      savings,
      litersSold,
      netProfit,
      marginPercent: totalIncome > 0 ? Math.round((netProfit / totalIncome) * 100) : 0,
      shiftComparison: {
        morningLiters,
        eveningLiters,
        morningPercent: litersSold > 0 ? Math.round((morningLiters / litersSold) * 100) : 0,
        eveningPercent: litersSold > 0 ? Math.round((eveningLiters / litersSold) * 100) : 0,
      },
      dailyBreakdown,
      expensesByCategory,
      bestDay,
      lowestDay,
    };
  }

  async getMonthlyReport(monthStr: string) {
    const rangeResult = await db.execute(sql`
      SELECT 
        TO_DATE(${monthStr} || '-01', 'YYYY-MM-DD')::date as "startDate",
        (DATE_TRUNC('month', TO_DATE(${monthStr} || '-01', 'YYYY-MM-DD')) + INTERVAL '1 month - 1 day')::date as "endDate"
    `);

    const { startDate, endDate } = rangeResult.rows[0] as any;

    // 1. Overall Totals in SQL
    const overallResult = await db.execute(sql`
      SELECT
        COALESCE(sales.total_milk, 0)::numeric(12,2) as "totalMilkAmount",
        COALESCE(sales.total_liters, 0)::numeric(10,2) as "litersSold",
        COALESCE(entries.total_other, 0)::numeric(12,2) as "otherIncome",
        COALESCE(entries.total_savings, 0)::numeric(12,2) as "savings",
        COALESCE(exp.total_expense, 0)::numeric(12,2) as "totalExpenditure"
      FROM (SELECT 1) dummy
      LEFT JOIN (
        SELECT SUM(total_amount) as total_milk, SUM(liters) as total_liters
        FROM milk_sales
        WHERE entry_date BETWEEN ${startDate} AND ${endDate}
      ) sales ON true
      LEFT JOIN (
        SELECT SUM(other_income) as total_other, SUM(savings) as total_savings
        FROM daily_entries
        WHERE entry_date BETWEEN ${startDate} AND ${endDate}
      ) entries ON true
      LEFT JOIN (
        SELECT SUM(amount) as total_expense
        FROM expenses
        WHERE entry_date BETWEEN ${startDate} AND ${endDate}
      ) exp ON true
    `);

    const o = overallResult.rows[0] as any;
    const milkIncome = parseFloat(o.totalMilkAmount || '0');
    const otherIncome = parseFloat(o.otherIncome || '0');
    const totalIncome = milkIncome + otherIncome;
    const totalExpenditure = parseFloat(o.totalExpenditure || '0');
    const savings = parseFloat(o.savings || '0');
    const litersSold = parseFloat(o.litersSold || '0');
    const netProfit = totalIncome - totalExpenditure;

    // 2. Weekly Breakdown within the Month in SQL
    const weeklyResult = await db.execute(sql`
      SELECT
        'W' || (DENSE_RANK() OVER (ORDER BY DATE_TRUNC('week', d::date)))::text as "weekLabel",
        MIN(d::date) as "weekStart",
        MAX(d::date) as "weekEnd",
        (COALESCE(SUM(sales.amount), 0) + COALESCE(SUM(entries.other_inc), 0))::numeric(12,2) as "income",
        COALESCE(SUM(exp.amount), 0)::numeric(12,2) as "expenditure",
        ((COALESCE(SUM(sales.amount), 0) + COALESCE(SUM(entries.other_inc), 0)) - COALESCE(SUM(exp.amount), 0))::numeric(12,2) as "netProfit"
      FROM generate_series(${startDate}::date, ${endDate}::date, '1 day'::interval) d
      LEFT JOIN (
        SELECT entry_date, SUM(total_amount) as amount
        FROM milk_sales
        WHERE entry_date BETWEEN ${startDate} AND ${endDate}
        GROUP BY entry_date
      ) sales ON d::date = sales.entry_date
      LEFT JOIN (
        SELECT entry_date, SUM(other_income) as other_inc
        FROM daily_entries
        WHERE entry_date BETWEEN ${startDate} AND ${endDate}
        GROUP BY entry_date
      ) entries ON d::date = entries.entry_date
      LEFT JOIN (
        SELECT entry_date, SUM(amount) as amount
        FROM expenses
        WHERE entry_date BETWEEN ${startDate} AND ${endDate}
        GROUP BY entry_date
      ) exp ON d::date = exp.entry_date
      GROUP BY DATE_TRUNC('week', d::date)
      ORDER BY DATE_TRUNC('week', d::date)
    `);

    const weeklyBreakdown = weeklyResult.rows.map((w: any) => ({
      weekLabel: String(w.weekLabel),
      weekStart: String(w.weekStart),
      weekEnd: String(w.weekEnd),
      income: parseFloat(w.income || '0'),
      expenditure: parseFloat(w.expenditure || '0'),
      netProfit: parseFloat(w.netProfit || '0'),
    }));

    // 3. Expenses by Category in SQL
    const expensesByCategoryResult = await db.execute(sql`
      SELECT
        category,
        COALESCE(SUM(amount), 0)::numeric(12,2) as total,
        COUNT(*)::int as count
      FROM expenses
      WHERE entry_date BETWEEN ${startDate} AND ${endDate}
      GROUP BY category
      ORDER BY total DESC
    `);

    const expensesByCategory = expensesByCategoryResult.rows.map((c: any) => ({
      category: String(c.category),
      total: parseFloat(c.total || '0'),
      count: Number(c.count || 0),
      percentage: totalExpenditure > 0 ? Math.round((parseFloat(c.total || '0') / totalExpenditure) * 100) : 0,
    }));

    // 4. Best Day & Lowest Day in SQL
    const daysResult = await db.execute(sql`
      SELECT
        d::date as "date",
        COALESCE(sales.liters, 0)::numeric(10,2) as liters,
        ((COALESCE(sales.amount, 0) + COALESCE(entries.other_inc, 0)) - COALESCE(exp.amount, 0))::numeric(12,2) as "netProfit"
      FROM generate_series(${startDate}::date, ${endDate}::date, '1 day'::interval) d
      LEFT JOIN (
        SELECT entry_date, SUM(total_amount) as amount, SUM(liters) as liters
        FROM milk_sales
        WHERE entry_date BETWEEN ${startDate} AND ${endDate}
        GROUP BY entry_date
      ) sales ON d::date = sales.entry_date
      LEFT JOIN (
        SELECT entry_date, SUM(other_income) as other_inc
        FROM daily_entries
        WHERE entry_date BETWEEN ${startDate} AND ${endDate}
        GROUP BY entry_date
      ) entries ON d::date = entries.entry_date
      LEFT JOIN (
        SELECT entry_date, SUM(amount) as amount
        FROM expenses
        WHERE entry_date BETWEEN ${startDate} AND ${endDate}
        GROUP BY entry_date
      ) exp ON d::date = exp.entry_date
      WHERE sales.amount IS NOT NULL OR exp.amount IS NOT NULL
      ORDER BY "netProfit" DESC
    `);

    const bestDayRow = daysResult.rows[0] as any;
    const lowestDayRow = daysResult.rows[daysResult.rows.length - 1] as any;

    const bestDay = bestDayRow
      ? {
          date: String(bestDayRow.date),
          liters: parseFloat(bestDayRow.liters || '0'),
          netProfit: parseFloat(bestDayRow.netProfit || '0'),
        }
      : null;

    const lowestDay = lowestDayRow
      ? {
          date: String(lowestDayRow.date),
          liters: parseFloat(lowestDayRow.liters || '0'),
          netProfit: parseFloat(lowestDayRow.netProfit || '0'),
        }
      : null;

    return {
      period: 'monthly',
      month: monthStr,
      startDate,
      endDate,
      totalIncome,
      totalExpenditure,
      savings,
      litersSold,
      netProfit,
      marginPercent: totalIncome > 0 ? Math.round((netProfit / totalIncome) * 100) : 0,
      weeklyBreakdown,
      expensesByCategory,
      bestDay,
      lowestDay,
    };
  }
}

export const reportsService = new ReportsService();
