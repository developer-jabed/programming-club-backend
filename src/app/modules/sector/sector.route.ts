import type { FastifyInstance } from "fastify";
import { UserRole } from "@prisma/client";
import { SectorController } from "./sector.controller.js";
import { SectorValidation } from "./sector.validation.js";

import auth from "../../middlewares/auth.middleware.js";
import validateRequest from "../../middlewares/validateRequest.js";
export default async function sectorRoutes(fastify: FastifyInstance) {
  // Create Sector (Admin only)
  fastify.post(
    "/",
    {
      preHandler: [
        auth(UserRole.ADMIN),
        validateRequest(SectorValidation.createSectorSchema),
      ],
    },
    SectorController.createSector
  );

  // Get All Sectors
  fastify.get("/", SectorController.getAllSectors);

  // Get Single Sector
  fastify.get("/:id", SectorController.getSingleSector);

  // Update Sector
  fastify.patch(
    "/:id",
    {
      preHandler: [
        auth(UserRole.ADMIN),
        validateRequest(SectorValidation.updateSectorSchema),
      ],
    },
    SectorController.updateSector
  );

  // Delete Sector
  fastify.delete(
    "/:id",
    { preHandler: [auth(UserRole.ADMIN)] },
    SectorController.deleteSector
  );

  // Join Sector
  fastify.post(
    "/:id/join",
    { preHandler: [auth(UserRole.ADMIN, UserRole.MODERATOR, UserRole.MEMBER)] },
    SectorController.joinSector
  );

  // Leave Sector
  fastify.delete(
    "/:id/leave",
    { preHandler: [auth(UserRole.ADMIN, UserRole.MODERATOR, UserRole.MEMBER)] },
    SectorController.leaveSector
  );

  // Get Sector Members
  fastify.get(
    "/:id/members",
    { preHandler: [auth(UserRole.ADMIN, UserRole.MODERATOR, UserRole.MEMBER)] },
    SectorController.getSectorMembers
  );
}