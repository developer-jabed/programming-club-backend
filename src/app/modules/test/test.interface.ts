import { TestStatus, TestTargetType, QuestionType, AttemptStatus } from "@prisma/client";

export type ICreateTest = {
  title: string;
  description?: string;
  durationMinutes?: number;
  passingMarks?: number;
  startAt?: string;
  endAt?: string;
  shuffleQuestions?: boolean;
  showResultImmediately?: boolean;
  projectId?: string;
  targetType: TestTargetType;
  memberIds?: string[];
  groups?: string[];
  questions: {
    questionText: string;
    type?: QuestionType;
    marks?: number;
    explanation?: string;
    options: {
      optionText: string;
      isCorrect: boolean;
    }[];
  }[];
};

export type IUpdateTest = Partial<Omit<ICreateTest, "questions" | "targetType" | "memberIds" | "groups">> & {
  status?: TestStatus;
};

export type ITestFilter = {
  searchTerm?: string;
  status?: TestStatus;
  projectId?: string;
  createdById?: string;
};

export type ISubmitAttempt = {
  answers: {
    questionId: string;
    selectedOptionIds: string[];
  }[];
};