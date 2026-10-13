-- DropForeignKey
ALTER TABLE "project_members" DROP CONSTRAINT "contribution_requester";

-- AlterTable
ALTER TABLE "project_members" ADD COLUMN     "invitedById" TEXT;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
