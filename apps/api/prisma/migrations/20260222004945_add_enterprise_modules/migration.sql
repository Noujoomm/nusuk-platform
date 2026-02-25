-- CreateEnum
CREATE TYPE "KPIStatus" AS ENUM ('pending', 'on_track', 'at_risk', 'behind', 'achieved', 'missed');

-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('daily', 'weekly', 'monthly', 'annual');

-- CreateEnum
CREATE TYPE "FileStatus" AS ENUM ('uploaded', 'reviewed', 'approved', 'rejected');

-- AlterTable
ALTER TABLE "penalties" ADD COLUMN     "impact_score" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "is_resolved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "linked_kpi_id" TEXT,
ADD COLUMN     "severity" TEXT DEFAULT 'medium';

-- CreateTable
CREATE TABLE "kpi_entries" (
    "id" TEXT NOT NULL,
    "track_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_ar" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "target_value" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "actual_value" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT '%',
    "status" "KPIStatus" NOT NULL DEFAULT 'pending',
    "due_date" TIMESTAMP(3),
    "assigned_to" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kpi_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "track_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "type" "ReportType" NOT NULL DEFAULT 'daily',
    "title" TEXT NOT NULL,
    "achievements" TEXT,
    "kpi_updates" TEXT,
    "challenges" TEXT,
    "support_needed" TEXT,
    "notes" TEXT,
    "ai_summary" TEXT,
    "report_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "uploaded_files" (
    "id" TEXT NOT NULL,
    "track_id" TEXT,
    "uploaded_by_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "mime_type" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "status" "FileStatus" NOT NULL DEFAULT 'uploaded',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "uploaded_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "kpi_entries_track_id_idx" ON "kpi_entries"("track_id");

-- CreateIndex
CREATE INDEX "kpi_entries_status_idx" ON "kpi_entries"("status");

-- CreateIndex
CREATE INDEX "reports_track_id_idx" ON "reports"("track_id");

-- CreateIndex
CREATE INDEX "reports_author_id_idx" ON "reports"("author_id");

-- CreateIndex
CREATE INDEX "reports_type_idx" ON "reports"("type");

-- CreateIndex
CREATE INDEX "reports_report_date_idx" ON "reports"("report_date");

-- CreateIndex
CREATE INDEX "uploaded_files_track_id_idx" ON "uploaded_files"("track_id");

-- CreateIndex
CREATE INDEX "uploaded_files_uploaded_by_id_idx" ON "uploaded_files"("uploaded_by_id");

-- CreateIndex
CREATE INDEX "uploaded_files_category_idx" ON "uploaded_files"("category");

-- AddForeignKey
ALTER TABLE "kpi_entries" ADD CONSTRAINT "kpi_entries_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uploaded_files" ADD CONSTRAINT "uploaded_files_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "tracks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uploaded_files" ADD CONSTRAINT "uploaded_files_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
