import { SectorMemberRole } from "@prisma/client";

export type ICreateSector = {
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  color?: string;
  order?: number;
};

export type IUpdateSector = Partial<ICreateSector> & {
  isActive?: boolean;
};

export type ISectorFilter = {
  searchTerm?: string;
  isActive?: boolean;
};