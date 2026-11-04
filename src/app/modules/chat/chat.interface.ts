export type ISendMessage = {
  content: string;
  replyToId?: string;
  attachments?: string[];
};

export type IChatFilter = {
  searchTerm?: string;
};