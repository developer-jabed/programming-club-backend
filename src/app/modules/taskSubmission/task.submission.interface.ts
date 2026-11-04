import type { SubmissionStatus } from "@prisma/client";

export interface ISubmitTask {
  content?: string;
  link?: string;
  fileUrls?: string[];
}

export interface IUpdateSubmission {
  content?: string | null;
  link?: string | null;
  fileUrls?: string[];
}

export interface IReviewSubmission {
  status: SubmissionStatus;
  score?: number;
  feedback?: string;
}

export interface ISubmissionFilter {
  searchTerm?: string;
  status?: SubmissionStatus;
  userId?: string;
  taskId?: string;
}