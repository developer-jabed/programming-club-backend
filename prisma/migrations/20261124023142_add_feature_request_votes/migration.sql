-- CreateTable
CREATE TABLE "feature_request_votes" (
    "id" TEXT NOT NULL,
    "featureRequestId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feature_request_votes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "feature_request_votes_featureRequestId_idx" ON "feature_request_votes"("featureRequestId");

-- CreateIndex
CREATE INDEX "feature_request_votes_userId_idx" ON "feature_request_votes"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "feature_request_votes_featureRequestId_userId_key" ON "feature_request_votes"("featureRequestId", "userId");

-- AddForeignKey
ALTER TABLE "feature_request_votes" ADD CONSTRAINT "feature_request_votes_featureRequestId_fkey" FOREIGN KEY ("featureRequestId") REFERENCES "feature_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feature_request_votes" ADD CONSTRAINT "feature_request_votes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
