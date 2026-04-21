export type Role = 'admin' | 'member' | 'viewer' | 'guest';

export type FeatureFlags = {
  uploadEnabled: boolean;
  adminOnlyUpload: boolean;
  browserHistoryEnabled: boolean;
  mongodbEnabled: boolean;
  allowGuestChat: boolean;
  modelName: string;
  chunkSize: number;
  chunkOverlap: number;
  maxUploadMb: number;
};

export type UserSession = {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatarUrl?: string;
};

export type DocumentSource = {
  title: string;
  excerpt: string;
  page?: number;
  score?: number;
};

export type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  sources?: DocumentSource[];
};

export type Conversation = {
  id: string;
  title: string;
  updatedAt: string;
  messages: Message[];
  documentNames: string[];
};

export type UploadResponse = {
  documentId: string;
  title: string;
  status: 'indexed' | 'queued' | 'error';
  conversationId?: string;
};

export type ChatResponse = {
  conversationId: string;
  reply: Message;
  conversation: Conversation;
};

export type AuthResponse = {
  session: UserSession;
};
