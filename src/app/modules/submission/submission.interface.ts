import { SubmissionStatus } from "@prisma/client";

export type ICreateTaskSubmission = {
  content?: string;
  link?: string;
  fileUrls?: string[];
};

export type IReviewSubmission = {
  status: "ACCEPTED" | "CHANGES_REQUESTED" | "REJECTED";
  score?: number;
  feedback?: string;
};

export type ICreateProjectSubmission = {
  title?: string;
  description: string;
  link: string;
  extraLinks?: string[];
};