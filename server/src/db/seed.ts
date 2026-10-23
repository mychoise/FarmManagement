import { sql } from 'drizzle-orm';
import { db, pool, buyers, dailyEntries, milkSales, expenses, payments } from './index.js';

async function seed() {
  console.log('🌱 Starting Green Pasture realistic database seeding for 14 days...');

  // 1. Clear existing data
  console.log('Clearing existing records in AbhishekFarm...');
  await db.execute(sql`TRUNCATE TABLE payments, expenses, milk_sales, daily_entries, buyers RESTART IDENTITY CASCADE`);

  // 2. Insert Buyers
  console.log('Inserting buyers...');
  const insertedBuyers = await db
    .insert(buyers)
    .values([
      {
        name: 'Milan Dairy Cooperative',
        phone: '+977 9841234567',
        buyerType: 'monthly',
        defaultLiters: '25.00',
        defaultRate: '85.00',
        defaultSession: 'morning',
        autoAssign: true,
        startDate: '2026-10-06',
      },
      {
        name: 'Annapurna Sweets',
        phone: '+977 9851098765',
        buyerType: 'monthly',
        defaultLiters: '15.00',
        defaultRate: '85.00',
        defaultSession: 'morning',
        autoAssign: true,
        startDate: '2026-10-06',
      },
      {
        name: 'Hotel Himal View',
        phone: '+977 9803456789',
        buyerType: 'monthly',
        defaultLiters: '10.00',
        defaultRate: '85.00',
        defaultSession: 'evening',
        autoAssign: true,
        startDate: '2026-10-06',
      },
      {
        name: 'Sita Sharma',
        phone: '+977 9812345678',
        buyerType: 'monthly',
        defaultLiters: '3.00',
        defaultRate: '85.00',
        defaultSession: 'morning',
        autoAssign: true,
        startDate: '2026-10-06',
      },
      {
        name: 'Ramesh Bhandari',
        phone: '+977 9865432109',
        buyerType: 'monthly',
        defaultLiters: '2.00',
        defaultRate: '85.00',
        defaultSession: 'evening',
        autoAssign: true,
        startDate: '2026-10-06',
      },
    ])
    .returning();

  const [milanCoop, annapurna, hotelHimal, sita, ramesh] = insertedBuyers;

  // 3. Generate 14 days of data: 2026-10-06 to 2026-10-19
  console.log('Generating 14 days of realistic entries, milk sales, and expenses...');

  const daysData = [
    { date: '2026-10-06', mLiters: 41.0, eLiters: 30.0, rate: 85, buyerId: milanCoop.id, other: 0, savings: 3500, exp: [{ cat: 'electricity', amt: 900, note: 'Chiller maintenance check' }, { cat: 'feed', amt: 2200, note: 'Green grass & straw' }] },
    { date: '2026-10-07', mLiters: 43.0, eLiters: 31.0, rate: 85, buyerId: milanCoop.id, other: 300, savings: 4000, exp: [{ cat: 'feed', amt: 2100, note: 'Daily silage fodder' }] },
    { date: '2026-10-08', mLiters: 42.5, eLiters: 32.0, rate: 85, buyerId: annapurna.id, other: 0, savings: 3800, exp: [{ cat: 'medicine', amt: 1200, note: 'Calcium supplement & vitamin bolus' }, { cat: 'feed', amt: 1800, note: 'Bran mix' }] },
    { date: '2026-10-09', mLiters: 44.0, eLiters: 31.5, rate: 85, buyerId: hotelHimal.id, other: 450, savings: 4200, exp: [{ cat: 'feed', amt: 2000, note: 'Silage feed' }] },
    { date: '2026-10-10', mLiters: 43.5, eLiters: 32.5, rate: 85, buyerId: milanCoop.id, other: 0, savings: 4000, exp: [{ cat: 'labor', amt: 1500, note: 'Barn deep clean & milking help' }, { cat: 'feed', amt: 1900, note: 'Dry straw' }] },
    { date: '2026-10-11', mLiters: 45.0, eLiters: 33.0, rate: 85, buyerId: sita.id, other: 600, savings: 4500, exp: [{ cat: 'feed', amt: 2300, note: 'Alfalfa hay load' }] },
    { date: '2026-10-12', mLiters: 44.0, eLiters: 32.0, rate: 85, buyerId: ramesh.id, other: 0, savings: 3500, exp: [{ cat: 'electricity', amt: 1200, note: 'Monthly pump power bill' }, { cat: 'feed', amt: 2000, note: 'Mixed fodder' }] },
    { date: '2026-10-13', mLiters: 45.0, eLiters: 33.0, rate: 85, buyerId: milanCoop.id, other: 500, savings: 4000, exp: [{ cat: 'feed', amt: 2800, note: 'High protein feed mix' }, { cat: 'labor', amt: 2000, note: 'Milking contractor' }] },
    { date: '2026-10-14', mLiters: 43.0, eLiters: 31.0, rate: 85, buyerId: annapurna.id, other: 0, savings: 3800, exp: [{ cat: 'medicine', amt: 1500, note: 'Mastitis teat dip & vet ointment' }, { cat: 'feed', amt: 1000, note: 'Silage' }] },
    { date: '2026-10-15', mLiters: 46.0, eLiters: 33.0, rate: 85, buyerId: hotelHimal.id, other: 400, savings: 4200, exp: [{ cat: 'feed', amt: 3000, note: 'Alfalfa + mineral bag' }] },
    { date: '2026-10-16', mLiters: 44.0, eLiters: 32.0, rate: 85, buyerId: milanCoop.id, other: 0, savings: 3900, exp: [{ cat: 'feed', amt: 2400, note: 'Grain feed' }, { cat: 'other', amt: 400, note: 'Milking bucket replacement' }] },
    { date: '2026-10-17', mLiters: 48.0, eLiters: 35.0, rate: 85, buyerId: milanCoop.id, other: 700, savings: 5000, exp: [{ cat: 'feed', amt: 2600, note: 'Morning green grass bundle' }] },
    { date: '2026-10-18', mLiters: 48.0, eLiters: 32.0, rate: 85, buyerId: annapurna.id, other: 0, savings: 4500, exp: [{ cat: 'labor', amt: 3000, note: 'Weekly farm helper wage' }, { cat: 'feed', amt: 1650, note: 'Straw' }] },
    { date: '2026-10-19', mLiters: 45.0, eLiters: 33.0, rate: 85, buyerId: milanCoop.id, other: 500, savings: 4500, exp: [{ cat: 'feed', amt: 2150, note: 'Alfalfa silage + 1 bag mineral mixture' }] },
  ];

  for (const d of daysData) {
    // Insert daily entry
    await db.insert(dailyEntries).values({
      entryDate: d.date,
      otherIncome: d.other.toFixed(2),
      savings: d.savings.toFixed(2),
      notes: d.other > 0 ? 'Ghee & compost distribution' : null,
    });

    // Insert Morning & Evening milk sales
    const mTotal = (d.mLiters * d.rate).toFixed(2);
    const eTotal = (d.eLiters * d.rate).toFixed(2);

    // Some sales have immediate partial cash, rest credit to buyer
    const mPaid = (d.buyerId === sita.id || d.buyerId === ramesh.id ? d.mLiters * d.rate : 0).toFixed(2);
    const ePaid = (d.buyerId === sita.id || d.buyerId === ramesh.id ? d.eLiters * d.rate : 0).toFixed(2);

    await db.insert(milkSales).values([
      {
        entryDate: d.date,
        session: 'morning',
        buyerId: d.buyerId,
        liters: d.mLiters.toFixed(2),
        ratePerLiter: d.rate.toFixed(2),
        totalAmount: mTotal,
        paidAmount: mPaid,
      },
      {
        entryDate: d.date,
        session: 'evening',
        buyerId: d.buyerId,
        liters: d.eLiters.toFixed(2),
        ratePerLiter: d.rate.toFixed(2),
        totalAmount: eTotal,
        paidAmount: ePaid,
      },
    ]);

    // Insert Expenses
    for (const ex of d.exp) {
      await db.insert(expenses).values({
        entryDate: d.date,
        category: ex.cat as any,
        amount: ex.amt.toFixed(2),
        note: ex.note,
      });
    }
  }

  // 4. Insert Payments from credit buyers
  console.log('Inserting buyer settlement payments...');
  await db.insert(payments).values([
    {
      buyerId: milanCoop.id,
      amount: '15000.00',
      paymentDate: '2026-10-12',
      note: 'Cheque payment for week 1',
    },
    {
      buyerId: milanCoop.id,
      amount: '10000.00',
      paymentDate: '2026-10-17',
      note: 'Direct bank transfer installment',
    },
    {
      buyerId: annapurna.id,
      amount: '12000.00',
      paymentDate: '2026-10-15',
      note: 'Cash payment against sweet batch milk',
    },
    {
      buyerId: hotelHimal.id,
      amount: '5000.00',
      paymentDate: '2026-10-14',
      note: 'Hotel restaurant partial payment',
    },
  ]);

  console.log('✅ Realistic sample seed completed successfully for 14 days!');
  await pool.end();
}

seed().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
