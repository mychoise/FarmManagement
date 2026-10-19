CREATE TYPE "public"."expense_category_enum" AS ENUM('feed', 'medicine', 'labor', 'electricity', 'other');--> statement-breakpoint
CREATE TYPE "public"."session_enum" AS ENUM('morning', 'evening');--> statement-breakpoint
CREATE TABLE "buyers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"phone" varchar(50),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"entry_date" date NOT NULL,
	"other_income" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"savings" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_entries_entry_date_unique" UNIQUE("entry_date")
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"entry_date" date NOT NULL,
	"category" "expense_category_enum" NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "milk_sales" (
	"id" serial PRIMARY KEY NOT NULL,
	"entry_date" date NOT NULL,
	"session" "session_enum" NOT NULL,
	"buyer_id" integer,
	"liters" numeric(10, 2) NOT NULL,
	"rate_per_liter" numeric(12, 2) NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"paid_amount" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"buyer_id" integer NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"payment_date" date NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "milk_sales" ADD CONSTRAINT "milk_sales_buyer_id_buyers_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."buyers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_buyer_id_buyers_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."buyers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "daily_entries_date_idx" ON "daily_entries" USING btree ("entry_date");--> statement-breakpoint
CREATE INDEX "expenses_date_idx" ON "expenses" USING btree ("entry_date");--> statement-breakpoint
CREATE INDEX "milk_sales_date_idx" ON "milk_sales" USING btree ("entry_date");--> statement-breakpoint
CREATE INDEX "milk_sales_buyer_idx" ON "milk_sales" USING btree ("buyer_id");--> statement-breakpoint
CREATE INDEX "payments_buyer_idx" ON "payments" USING btree ("buyer_id");--> statement-breakpoint
CREATE INDEX "payments_date_idx" ON "payments" USING btree ("payment_date");