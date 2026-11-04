/*
  Warnings:

  - You are about to drop the column `invitedById` on the `project_members` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "SectorMemberRole" AS ENUM ('LEAD', 'MENTOR', 'MEMBER');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'SECTOR_JOINED';

-- AlterEnum
ALTER TYPE "TaskTargetType" ADD VALUE 'SECTOR_MEMBERS';

-- AlterEnum
ALTER TYPE "TestTargetType" ADD VALUE 'SECTOR_MEMBERS';

-- DropForeignKey
ALTER TABLE "notifications" DROP CONSTRAINT "notification_project";

-- AlterTable
ALTER TABLE "project_members" DROP COLUMN "invitedById";

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "sectorId" TEXT;

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "sectorId" TEXT;

-- AlterTable
ALTER TABLE "tests" ADD COLUMN     "sectorId" TEXT;

-- CreateTable
CREATE TABLE "sectors" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "color" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sectors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sector_members" (
    "id" TEXT NOT NULL,
    "sectorId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "SectorMemberRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sector_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sectors_name_key" ON "sectors"("name");

-- CreateIndex
CREATE UNIQUE INDEX "sectors_slug_key" ON "sectors"("slug");

-- CreateIndex
CREATE INDEX "sector_members_userId_idx" ON "sector_members"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "sector_members_sectorId_userId_key" ON "sector_members"("sectorId", "userId");

-- CreateIndex
CREATE INDEX "projects_sectorId_idx" ON "projects"("sectorId");

-- CreateIndex
CREATE INDEX "tasks_sectorId_idx" ON "tasks"("sectorId");

-- CreateIndex
CREATE INDEX "tests_sectorId_idx" ON "tests"("sectorId");

-- AddForeignKey
ALTER TABLE "sector_members" ADD CONSTRAINT "sector_members_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "sectors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sector_members" ADD CONSTRAINT "sector_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "sectors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "sectors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tests" ADD CONSTRAINT "tests_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "sectors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
