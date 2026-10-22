-- CreateEnum
CREATE TYPE "MetricPeriod" AS ENUM ('CURRENT', 'PREVIOUS');

-- CreateEnum
CREATE TYPE "ImpactDirection" AS ENUM ('POSITIVE', 'NEGATIVE');

-- CreateTable
CREATE TABLE "admin_users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'ADMIN',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_dashboards" (
    "id" TEXT NOT NULL,
    "week_start" DATE NOT NULL,
    "previous_week_start" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weekly_dashboards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_metrics" (
    "id" TEXT NOT NULL,
    "dashboard_id" TEXT NOT NULL,
    "period" "MetricPeriod" NOT NULL,
    "business_date" DATE NOT NULL,
    "pos_revenue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "eatclub_revenue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "direct_revenue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_revenue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "labour_costs" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "covers" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dashboard_events" (
    "id" TEXT NOT NULL,
    "dashboard_id" TEXT NOT NULL,
    "event_date" DATE NOT NULL,
    "label" TEXT NOT NULL,
    "direction" "ImpactDirection" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dashboard_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "weekly_dashboards_week_start_key" ON "weekly_dashboards"("week_start");

-- CreateIndex
CREATE INDEX "daily_metrics_dashboard_id_period_idx" ON "daily_metrics"("dashboard_id", "period");

-- CreateIndex
CREATE UNIQUE INDEX "daily_metrics_dashboard_id_period_business_date_key" ON "daily_metrics"("dashboard_id", "period", "business_date");

-- CreateIndex
CREATE INDEX "dashboard_events_dashboard_id_event_date_idx" ON "dashboard_events"("dashboard_id", "event_date");

-- AddForeignKey
ALTER TABLE "daily_metrics" ADD CONSTRAINT "daily_metrics_dashboard_id_fkey" FOREIGN KEY ("dashboard_id") REFERENCES "weekly_dashboards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboard_events" ADD CONSTRAINT "dashboard_events_dashboard_id_fkey" FOREIGN KEY ("dashboard_id") REFERENCES "weekly_dashboards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
