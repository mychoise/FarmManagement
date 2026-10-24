import { sql } from 'drizzle-orm';
import { db, buyers, payments, milkSales } from '../db/index.js';

export interface CreateBuyerInput {
  name: string;
  phone?: string | null;
  buyerType?: 'monthly' | 'one_time';
  defaultLiters?: number | null;
  defaultRate?: number | null;
  defaultSession?: 'morning' | 'evening' | 'both';
  autoAssign?: boolean;
  startDate?: string | null;
}

export interface UpdateBuyerInput {
  name?: string;
  phone?: string | null;
  buyerType?: 'monthly' | 'one_time';
  defaultLiters?: number | null;
  defaultRate?: number | null;
  defaultSession?: 'morning' | 'evening' | 'both';
  autoAssign?: boolean;
  startDate?: string | null;
}

export class BuyersService {
  /**
   * Automatically advances daily milk dispatches for all active monthly buyers
   * from their delivery start date up to today.
   */
  async autoAssignMonthlyDispatches(targetDate?: string) {
    return await db.transaction(async (tx) => {
      const todayStr = targetDate || new Date().toISOString().split('T')[0];

      // 1. Ensure daily_entries exists for all dates with active monthly dispatches
      await tx.execute(sql`
        INSERT INTO daily_entries (entry_date, other_income, savings)
        SELECT DISTINCT d::date, 0.00::numeric(12,2), 0.00::numeric(12,2)
        FROM buyers b,
        LATERAL generate_series(
          GREATEST(COALESCE(b.start_date, b.created_at::date), ${todayStr}::date - INTERVAL '60 days'),
          ${todayStr}::date,
          '1 day'::interval
        ) d
        WHERE COALESCE(b.buyer_type, 'monthly') = 'monthly'
          AND COALESCE(b.auto_assign, true) = true
          AND COALESCE(b.default_liters, 0) > 0
          AND COALESCE(b.start_date, b.created_at::date) <= ${todayStr}::date
        ON CONFLICT (entry_date) DO NOTHING
      `);

      // 2. Bulk insert missing morning dispatches
      const morningRes = await tx.execute(sql`
        INSERT INTO milk_sales (entry_date, session, buyer_id, liters, rate_per_liter, total_amount, paid_amount)
        SELECT 
          d::date,
          'morning'::session_enum,
          b.id,
          (CASE WHEN b.default_session = 'both' THEN b.default_liters / 2 ELSE b.default_liters END)::numeric(10,2),
          COALESCE(b.default_rate, 85.00)::numeric(12,2),
          ((CASE WHEN b.default_session = 'both' THEN b.default_liters / 2 ELSE b.default_liters END) * COALESCE(b.default_rate, 85.00))::numeric(12,2),
          0.00::numeric(12,2)
        FROM buyers b,
        LATERAL generate_series(
          GREATEST(COALESCE(b.start_date, b.created_at::date), ${todayStr}::date - INTERVAL '60 days'),
          ${todayStr}::date,
          '1 day'::interval
        ) d
        WHERE COALESCE(b.buyer_type, 'monthly') = 'monthly'
          AND COALESCE(b.auto_assign, true) = true
          AND COALESCE(b.default_liters, 0) > 0
          AND COALESCE(b.start_date, b.created_at::date) <= ${todayStr}::date
          AND (COALESCE(b.default_session, 'morning') IN ('morning', 'both'))
          AND NOT EXISTS (
            SELECT 1 FROM milk_sales ms
            WHERE ms.buyer_id = b.id AND ms.entry_date = d::date AND ms.session = 'morning'
          )
      `);

      // 3. Bulk insert missing evening dispatches
      const eveningRes = await tx.execute(sql`
        INSERT INTO milk_sales (entry_date, session, buyer_id, liters, rate_per_liter, total_amount, paid_amount)
        SELECT 
          d::date,
          'evening'::session_enum,
          b.id,
          (CASE WHEN b.default_session = 'both' THEN b.default_liters / 2 ELSE b.default_liters END)::numeric(10,2),
          COALESCE(b.default_rate, 85.00)::numeric(12,2),
          ((CASE WHEN b.default_session = 'both' THEN b.default_liters / 2 ELSE b.default_liters END) * COALESCE(b.default_rate, 85.00))::numeric(12,2),
          0.00::numeric(12,2)
        FROM buyers b,
        LATERAL generate_series(
          GREATEST(COALESCE(b.start_date, b.created_at::date), ${todayStr}::date - INTERVAL '60 days'),
          ${todayStr}::date,
          '1 day'::interval
        ) d
        WHERE COALESCE(b.buyer_type, 'monthly') = 'monthly'
          AND COALESCE(b.auto_assign, true) = true
          AND COALESCE(b.default_liters, 0) > 0
          AND COALESCE(b.start_date, b.created_at::date) <= ${todayStr}::date
          AND (COALESCE(b.default_session, 'morning') IN ('evening', 'both'))
          AND NOT EXISTS (
            SELECT 1 FROM milk_sales ms
            WHERE ms.buyer_id = b.id AND ms.entry_date = d::date AND ms.session = 'evening'
          )
      `);

      const assignedCount = (morningRes.rowCount || 0) + (eveningRes.rowCount || 0);
      return { assignedCount };
    });
  }

  async getAllBuyers() {
    // Automatically advance monthly dispatches before fetching
    try {
      await this.autoAssignMonthlyDispatches();
    } catch (err) {
      console.error('Auto-assign monthly dispatches error:', err);
    }

    const result = await db.execute(sql`
      SELECT 
        b.id,
        b.name,
        b.phone,
        COALESCE(b.buyer_type, 'monthly') as "buyerType",
        COALESCE(b.default_liters, 0)::numeric(10,2) as "defaultLiters",
        COALESCE(b.default_rate, 85.00)::numeric(12,2) as "defaultRate",
        COALESCE(b.default_session, 'morning') as "defaultSession",
        COALESCE(b.auto_assign, true) as "autoAssign",
        COALESCE(b.start_date, b.created_at::date) as "startDate",
        b.created_at as "createdAt",
        COALESCE(sales.total_billed, 0)::numeric(12,2) as "totalBilled",
        COALESCE(sales.total_liters, 0)::numeric(10,2) as "totalLiters",
        COALESCE(pmts.total_payments, 0)::numeric(12,2) as "totalPayments",
        GREATEST(0, (COALESCE(sales.unpaid_sales, 0) - COALESCE(pmts.total_payments, 0)))::numeric(12,2) as "balance",
        last_pmt.payment_date as "lastPaymentDate",
        last_pmt.amount::numeric(12,2) as "lastPaymentAmount"
      FROM buyers b
      LEFT JOIN (
        SELECT 
          buyer_id,
          SUM(total_amount) as total_billed,
          SUM(liters) as total_liters,
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
      LEFT JOIN LATERAL (
        SELECT payment_date, amount
        FROM payments
        WHERE buyer_id = b.id
        ORDER BY payment_date DESC, id DESC
        LIMIT 1
      ) last_pmt ON true
      ORDER BY "balance" DESC, b.name ASC
    `);

    return result.rows.map((row: any) => ({
      id: Number(row.id),
      name: String(row.name),
      phone: row.phone ? String(row.phone) : null,
      buyerType: (row.buyerType || 'monthly') as 'monthly' | 'one_time',
      defaultLiters: parseFloat(row.defaultLiters || '0'),
      defaultRate: parseFloat(row.defaultRate || '85'),
      defaultSession: (row.defaultSession || 'morning') as 'morning' | 'evening' | 'both',
      autoAssign: Boolean(row.autoAssign),
      startDate: row.startDate ? String(row.startDate).split('T')[0] : null,
      createdAt: row.createdAt,
      totalBilled: parseFloat(row.totalBilled || '0'),
      totalLiters: parseFloat(row.totalLiters || '0'),
      totalPayments: parseFloat(row.totalPayments || '0'),
      balance: parseFloat(row.balance || '0'),
      lastPaymentDate: row.lastPaymentDate ? String(row.lastPaymentDate) : null,
      lastPaymentAmount: row.lastPaymentAmount ? parseFloat(row.lastPaymentAmount) : 0,
      status: parseFloat(row.balance || '0') > 0 ? ('pending' as const) : ('paid' as const),
    }));
  }

  async getBuyerById(id: number) {
    const result = await db.execute(sql`
      SELECT 
        b.id,
        b.name,
        b.phone,
        COALESCE(b.buyer_type, 'monthly') as "buyerType",
        COALESCE(b.default_liters, 0)::numeric(10,2) as "defaultLiters",
        COALESCE(b.default_rate, 85.00)::numeric(12,2) as "defaultRate",
        COALESCE(b.default_session, 'morning') as "defaultSession",
        COALESCE(b.auto_assign, true) as "autoAssign",
        COALESCE(b.start_date, b.created_at::date) as "startDate",
        b.created_at as "createdAt",
        COALESCE(sales.total_billed, 0)::numeric(12,2) as "totalBilled",
        COALESCE(sales.total_liters, 0)::numeric(10,2) as "totalLiters",
        COALESCE(pmts.total_payments, 0)::numeric(12,2) as "totalPayments",
        GREATEST(0, (COALESCE(sales.unpaid_sales, 0) - COALESCE(pmts.total_payments, 0)))::numeric(12,2) as "balance"
      FROM buyers b
      LEFT JOIN (
        SELECT 
          buyer_id,
          SUM(total_amount) as total_billed,
          SUM(liters) as total_liters,
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
      WHERE b.id = ${id}
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      return null;
    }

    const buyer = result.rows[0] as any;

    // Get recent transactions
    const recentSales = await db
      .select()
      .from(milkSales)
      .where(sql`${milkSales.buyerId} = ${id}`)
      .orderBy(sql`${milkSales.entryDate} DESC`)
      .limit(10);

    const recentPayments = await db
      .select()
      .from(payments)
      .where(sql`${payments.buyerId} = ${id}`)
      .orderBy(sql`${payments.paymentDate} DESC`)
      .limit(10);

    return {
      id: Number(buyer.id),
      name: String(buyer.name),
      phone: buyer.phone ? String(buyer.phone) : null,
      buyerType: (buyer.buyerType || 'monthly') as 'monthly' | 'one_time',
      defaultLiters: parseFloat(buyer.defaultLiters || '0'),
      defaultRate: parseFloat(buyer.defaultRate || '85'),
      defaultSession: (buyer.defaultSession || 'morning') as 'morning' | 'evening' | 'both',
      autoAssign: Boolean(buyer.autoAssign),
      startDate: buyer.startDate ? String(buyer.startDate).split('T')[0] : null,
      createdAt: buyer.createdAt,
      totalBilled: parseFloat(buyer.totalBilled || '0'),
      totalLiters: parseFloat(buyer.totalLiters || '0'),
      totalPayments: parseFloat(buyer.totalPayments || '0'),
      balance: parseFloat(buyer.balance || '0'),
      status: parseFloat(buyer.balance || '0') > 0 ? ('pending' as const) : ('paid' as const),
      recentSales,
      recentPayments,
    };
  }

  async createBuyer(data: CreateBuyerInput) {
    const buyerType = data.buyerType || 'monthly';
    const defaultLiters = data.defaultLiters !== undefined && data.defaultLiters !== null ? String(data.defaultLiters) : '0.00';
    const defaultRate = data.defaultRate !== undefined && data.defaultRate !== null ? String(data.defaultRate) : '85.00';
    const defaultSession = data.defaultSession || 'morning';
    const autoAssign = data.autoAssign !== undefined ? data.autoAssign : true;
    const startDate = data.startDate || new Date().toISOString().split('T')[0];

    const [newBuyer] = await db
      .insert(buyers)
      .values({
        name: data.name,
        phone: data.phone || null,
        buyerType,
        defaultLiters,
        defaultRate,
        defaultSession,
        autoAssign,
        startDate,
      })
      .returning();

    // If new buyer is a monthly subscription buyer with default liters, immediately auto-assign
    if (buyerType === 'monthly' && parseFloat(defaultLiters) > 0 && autoAssign) {
      try {
        await this.autoAssignMonthlyDispatches();
      } catch (err) {
        console.error('Auto-assign after create error:', err);
      }
    }

    return {
      ...newBuyer,
      buyerType: (newBuyer.buyerType || 'monthly') as 'monthly' | 'one_time',
      defaultLiters: parseFloat(newBuyer.defaultLiters || '0'),
      defaultRate: parseFloat(newBuyer.defaultRate || '85'),
      defaultSession: (newBuyer.defaultSession || 'morning') as 'morning' | 'evening' | 'both',
      autoAssign: Boolean(newBuyer.autoAssign),
      startDate: newBuyer.startDate ? String(newBuyer.startDate).split('T')[0] : startDate,
    };
  }

  async updateBuyer(id: number, data: UpdateBuyerInput) {
    const updateValues: any = {};
    if (data.name !== undefined) updateValues.name = data.name;
    if (data.phone !== undefined) updateValues.phone = data.phone;
    if (data.buyerType !== undefined) updateValues.buyerType = data.buyerType;
    if (data.defaultLiters !== undefined) {
      updateValues.defaultLiters = data.defaultLiters !== null ? String(data.defaultLiters) : '0.00';
    }
    if (data.defaultRate !== undefined) {
      updateValues.defaultRate = data.defaultRate !== null ? String(data.defaultRate) : '85.00';
    }
    if (data.defaultSession !== undefined) updateValues.defaultSession = data.defaultSession;
    if (data.autoAssign !== undefined) updateValues.autoAssign = data.autoAssign;
    if (data.startDate !== undefined) updateValues.startDate = data.startDate;

    const [updated] = await db
      .update(buyers)
      .set(updateValues)
      .where(sql`${buyers.id} = ${id}`)
      .returning();

    if (updated.buyerType === 'monthly' && parseFloat(updated.defaultLiters || '0') > 0 && updated.autoAssign) {
      try {
        await this.autoAssignMonthlyDispatches();
      } catch (err) {
        console.error('Auto-assign after update error:', err);
      }
    }

    return {
      ...updated,
      buyerType: (updated.buyerType || 'monthly') as 'monthly' | 'one_time',
      defaultLiters: parseFloat(updated.defaultLiters || '0'),
      defaultRate: parseFloat(updated.defaultRate || '85'),
      defaultSession: (updated.defaultSession || 'morning') as 'morning' | 'evening' | 'both',
      autoAssign: Boolean(updated.autoAssign),
      startDate: updated.startDate ? String(updated.startDate).split('T')[0] : null,
    };
  }

  async getBuyerCalendar(id: number) {
    // Ensure monthly dispatches are up to date
    try {
      await this.autoAssignMonthlyDispatches();
    } catch (err) {
      console.error('Auto-assign error before calendar load:', err);
    }

    const buyer = await this.getBuyerById(id);
    if (!buyer) return null;

    // 1. Fetch all milk sales for this buyer ordered chronologically
    const allSales = await db
      .select()
      .from(milkSales)
      .where(sql`${milkSales.buyerId} = ${id}`)
      .orderBy(sql`${milkSales.entryDate} ASC, ${milkSales.session} ASC`);

    // 2. Fetch all payments for this buyer ordered chronologically
    const allPayments = await db
      .select()
      .from(payments)
      .where(sql`${payments.buyerId} = ${id}`)
      .orderBy(sql`${payments.paymentDate} ASC`);

    // 3. Find most recent previous dispatch before or on today
    let previousDispatch = null;
    if (allSales.length > 0) {
      const last = allSales[allSales.length - 1];
      previousDispatch = {
        date: String(last.entryDate),
        session: String(last.session),
        liters: parseFloat(String(last.liters)),
        ratePerLiter: parseFloat(String(last.ratePerLiter)),
        totalAmount: parseFloat(String(last.totalAmount)),
      };
    }

    // 4. Group sales and payments by date
    const dateMap = new Map<string, any>();

    for (const sale of allSales) {
      const dStr = String(sale.entryDate);
      if (!dateMap.has(dStr)) {
        dateMap.set(dStr, {
          date: dStr,
          morning: null,
          evening: null,
          totalLiters: 0,
          totalAmount: 0,
          payments: [],
        });
      }
      const entry = dateMap.get(dStr);
      const l = parseFloat(String(sale.liters));
      const r = parseFloat(String(sale.ratePerLiter));
      const tot = parseFloat(String(sale.totalAmount));
      const p = parseFloat(String(sale.paidAmount || '0'));

      const sessionObj = {
        id: sale.id,
        liters: l,
        ratePerLiter: r,
        totalAmount: tot,
        paidAmount: p,
      };

      if (sale.session === 'morning') {
        entry.morning = sessionObj;
      } else {
        entry.evening = sessionObj;
      }
      entry.totalLiters += l;
      entry.totalAmount += tot;
    }

    for (const pmt of allPayments) {
      const pStr = String(pmt.paymentDate);
      if (!dateMap.has(pStr)) {
        dateMap.set(pStr, {
          date: pStr,
          morning: null,
          evening: null,
          totalLiters: 0,
          totalAmount: 0,
          payments: [],
        });
      }
      const entry = dateMap.get(pStr);
      entry.payments.push({
        id: pmt.id,
        amount: parseFloat(String(pmt.amount)),
        paymentMethod: (pmt as any).paymentMethod || 'cash',
        reference: (pmt as any).reference || null,
        note: pmt.note,
      });
    }

    // Sort dates chronologically
    const sortedDates = Array.from(dateMap.keys()).sort();

    // Compute running cumulative metrics till that date
    let cumulativeLiters = 0;
    let cumulativeBilled = 0;
    let cumulativePaid = 0;

    const days = sortedDates.map((dStr) => {
      const item = dateMap.get(dStr);
      cumulativeLiters += item.totalLiters;
      cumulativeBilled += item.totalAmount;
      const dayPaid = item.payments.reduce((s: number, p: any) => s + p.amount, 0);
      cumulativePaid += dayPaid;

      return {
        ...item,
        cumulativeLiters: Math.round(cumulativeLiters * 100) / 100,
        cumulativeBilled: Math.round(cumulativeBilled * 100) / 100,
        cumulativePaid: Math.round(cumulativePaid * 100) / 100,
        balanceTillDate: Math.round(Math.max(0, cumulativeBilled - cumulativePaid) * 100) / 100,
      };
    });

    return {
      buyer,
      previousDispatch,
      days,
    };
  }

  async recordMilkDispatch(
    buyerId: number,
    data: {
      entryDate: string;
      session: 'morning' | 'evening' | 'both';
      liters: number;
      ratePerLiter: number;
      paidAmount?: number;
      saveAsDefault?: boolean;
    }
  ) {
    return await db.transaction(async (tx) => {
      // If user checked saveAsDefault, update the buyer's standing quota
      if (data.saveAsDefault && data.liters > 0) {
        await tx
          .update(buyers)
          .set({ defaultLiters: String(data.liters) })
          .where(sql`${buyers.id} = ${buyerId}`);
      }

      // 1. Ensure daily_entries row exists for entryDate
      await tx.execute(sql`
        INSERT INTO daily_entries (entry_date, other_income, savings)
        VALUES (${data.entryDate}, 0.00::numeric(12,2), 0.00::numeric(12,2))
        ON CONFLICT (entry_date) DO NOTHING
      `);

      const sessionsToApply: ('morning' | 'evening')[] =
        data.session === 'both' ? ['morning', 'evening'] : [data.session];

      const litersPerSession =
        data.session === 'both' ? data.liters / 2 : data.liters;

      for (const sess of sessionsToApply) {
        const existing = await tx
          .select()
          .from(milkSales)
          .where(
            sql`${milkSales.buyerId} = ${buyerId} AND ${milkSales.entryDate} = ${data.entryDate} AND ${milkSales.session} = ${sess}`
          )
          .limit(1);

        if (litersPerSession <= 0) {
          if (existing.length > 0) {
            await tx
              .delete(milkSales)
              .where(sql`${milkSales.id} = ${existing[0].id}`);
          }
        } else {
          const totalAmt = (litersPerSession * data.ratePerLiter).toFixed(2);
          const paidAmt = ((data.paidAmount || 0) / sessionsToApply.length).toFixed(2);

          if (existing.length > 0) {
            await tx
              .update(milkSales)
              .set({
                liters: litersPerSession.toFixed(2),
                ratePerLiter: data.ratePerLiter.toFixed(2),
                totalAmount: totalAmt,
                paidAmount: paidAmt,
              })
              .where(sql`${milkSales.id} = ${existing[0].id}`);
          } else {
            await tx.insert(milkSales).values({
              entryDate: data.entryDate,
              session: sess,
              buyerId,
              liters: litersPerSession.toFixed(2),
              ratePerLiter: data.ratePerLiter.toFixed(2),
              totalAmount: totalAmt,
              paidAmount: paidAmt,
            });
          }
        }
      }

      return { success: true };
    });
  }
}

export const buyersService = new BuyersService();
