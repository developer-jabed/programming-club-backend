-- CreateEnum
CREATE TYPE "FeatureRequestStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'PLANNED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'DUPLICATE');

-- CreateEnum
CREATE TYPE "FeatureRequestPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "FeatureUpdateType" AS ENUM ('FEATURE_UPDATE', 'BUG_FIX', 'IMPROVEMENT', 'TECHNICAL_REPORT', 'ANNOUNCEMENT', 'ROADMAP');

-- CreateEnum
CREATE TYPE "FeatureUpdateVisibility" AS ENUM ('PUBLIC', 'MEMBERS_ONLY', 'ADMIN_ONLY');

-- CreateTable
CREATE TABLE "feature_requests" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "FeatureRequestStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "FeatureRequestPriority" NOT NULL DEFAULT 'MEDIUM',
    "votes" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "sectorId" TEXT,
    "projectId" TEXT,
    "adminNote" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feature_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_request_replies" (
    "id" TEXT NOT NULL,
    "featureRequestId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isAdminReply" BOOLEAN NOT NULL DEFAULT false,
    "authorId" TEXT NOT NULL,
    "parentReplyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "feature_request_replies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_updates" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" "FeatureUpdateType" NOT NULL DEFAULT 'FEATURE_UPDATE',
    "visibility" "FeatureUpdateVisibility" NOT NULL DEFAULT 'PUBLIC',
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "version" TEXT,
    "tags" TEXT[],
    "authorId" TEXT NOT NULL,
    "relatedFeatureRequestId" TEXT,
    "sectorId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feature_updates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "feature_requests_status_createdAt_idx" ON "feature_requests"("status", "createdAt");

-- CreateIndex
CREATE INDEX "feature_requests_createdById_idx" ON "feature_requests"("createdById");

-- CreateIndex
CREATE INDEX "feature_requests_sectorId_idx" ON "feature_requests"("sectorId");

-- CreateIndex
CREATE INDEX "feature_requests_projectId_idx" ON "feature_requests"("projectId");

-- CreateIndex
CREATE INDEX "feature_request_replies_featureRequestId_createdAt_idx" ON "feature_request_replies"("featureRequestId", "createdAt");

-- CreateIndex
CREATE INDEX "feature_request_replies_authorId_idx" ON "feature_request_replies"("authorId");

-- CreateIndex
CREATE INDEX "feature_updates_type_publishedAt_idx" ON "feature_updates"("type", "publishedAt");

-- CreateIndex
CREATE INDEX "feature_updates_visibility_isPinned_idx" ON "feature_updates"("visibility", "isPinned");

-- CreateIndex
CREATE INDEX "feature_updates_authorId_idx" ON "feature_updates"("authorId");

-- AddForeignKey
ALTER TABLE "feature_requests" ADD CONSTRAINT "feature_requests_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feature_requests" ADD CONSTRAINT "feature_requests_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "sectors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feature_requests" ADD CONSTRAINT "feature_requests_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feature_requests" ADD CONSTRAINT "feature_requests_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feature_request_replies" ADD CONSTRAINT "feature_request_replies_featureRequestId_fkey" FOREIGN KEY ("featureRequestId") REFERENCES "feature_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feature_request_replies" ADD CONSTRAINT "feature_request_replies_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feature_request_replies" ADD CONSTRAINT "feature_request_replies_parentReplyId_fkey" FOREIGN KEY ("parentReplyId") REFERENCES "feature_request_replies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feature_updates" ADD CONSTRAINT "feature_updates_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feature_updates" ADD CONSTRAINT "feature_updates_relatedFeatureRequestId_fkey" FOREIGN KEY ("relatedFeatureRequestId") REFERENCES "feature_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feature_updates" ADD CONSTRAINT "feature_updates_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "sectors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
