import {
  pgTable,
  serial,
  varchar,
  text,
  numeric,
  date,
  timestamp,
  pgEnum,
  integer,
  boolean,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const sessionEnum = pgEnum('session_enum', ['morning', 'evening']);
export const expenseCategoryEnum = pgEnum('expense_category_enum', [
  'feed',
  'medicine',
  'labor',
  'electricity',
  'other',
]);

// 1. Buyers Table
export const buyers = pgTable('buyers', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 50 }),
  buyerType: varchar('buyer_type', { length: 20 }).default('monthly').notNull(),
  defaultLiters: numeric('default_liters', { precision: 10, scale: 2 }).default('0.00'),
  defaultRate: numeric('default_rate', { precision: 12, scale: 2 }).default('85.00').notNull(),
  defaultSession: varchar('default_session', { length: 20 }).default('morning').notNull(),
  autoAssign: boolean('auto_assign').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 2. Daily Entries Table
export const dailyEntries = pgTable(
  'daily_entries',
  {
    id: serial('id').primaryKey(),
    entryDate: date('entry_date').notNull().unique(),
    otherIncome: numeric('other_income', { precision: 12, scale: 2 }).default('0.00').notNull(),
    savings: numeric('savings', { precision: 12, scale: 2 }).default('0.00').notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('daily_entries_date_idx').on(table.entryDate),
  ]
);

// 3. Milk Sales Table
export const milkSales = pgTable(
  'milk_sales',
  {
    id: serial('id').primaryKey(),
    entryDate: date('entry_date').notNull(),
    session: sessionEnum('session').notNull(),
    buyerId: integer('buyer_id').references(() => buyers.id, { onDelete: 'set null' }),
    liters: numeric('liters', { precision: 10, scale: 2 }).notNull(),
    ratePerLiter: numeric('rate_per_liter', { precision: 12, scale: 2 }).notNull(),
    totalAmount: numeric('total_amount', { precision: 12, scale: 2 }).notNull(),
    paidAmount: numeric('paid_amount', { precision: 12, scale: 2 }).default('0.00').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('milk_sales_date_idx').on(table.entryDate),
    index('milk_sales_buyer_idx').on(table.buyerId),
  ]
);

// 4. Expenses Table
export const expenses = pgTable(
  'expenses',
  {
    id: serial('id').primaryKey(),
    entryDate: date('entry_date').notNull(),
    category: expenseCategoryEnum('category').notNull(),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('expenses_date_idx').on(table.entryDate),
  ]
);

// 5. Payments Table
export const payments = pgTable(
  'payments',
  {
    id: serial('id').primaryKey(),
    buyerId: integer('buyer_id').references(() => buyers.id, { onDelete: 'cascade' }).notNull(),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    paymentDate: date('payment_date').notNull(),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('payments_buyer_idx').on(table.buyerId),
    index('payments_date_idx').on(table.paymentDate),
  ]
);

// Relations
export const buyersRelations = relations(buyers, ({ many }) => ({
  milkSales: many(milkSales),
  payments: many(payments),
}));

export const milkSalesRelations = relations(milkSales, ({ one }) => ({
  buyer: one(buyers, {
    fields: [milkSales.buyerId],
    references: [buyers.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  buyer: one(buyers, {
    fields: [payments.buyerId],
    references: [buyers.id],
  }),
}));
