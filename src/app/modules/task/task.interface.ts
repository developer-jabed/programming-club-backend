import { TaskStatus, TaskPriority, TaskTargetType } from "@prisma/client";

export type ITaskFilter = {
  searchTerm?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  projectId?: string;
  createdById?: string;
};

export type ICreateTask = {
  title: string;
  description?: string;
  priority?: TaskPriority;
  dueDate?: string;
  maxScore?: number;
  projectId?: string;
  targetType: TaskTargetType;
  // For SPECIFIC_MEMBERS
  memberIds?: string[];
  // For SECTOR_MEMBERS
  sectorId?: string;
 
  groups?: string[];
};

export type IUpdateTask = Partial<ICreateTask> & {
  status?: TaskStatus;
};