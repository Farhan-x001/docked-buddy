declare module 'tsup' {
  export type Options = Record<string, unknown>;
  export function defineConfig(config: Options): Options;
}

declare module 'vite' {
  export type UserConfig = Record<string, unknown>;
  export function defineConfig(config: UserConfig): UserConfig;
}

declare module '@vitejs/plugin-react' {
  export default function react(): unknown;
}

declare module '@react-oauth/google' {
  import * as React from 'react';

  export type CredentialResponse = {
    credential?: string;
    select_by?: string;
  };

  export function GoogleOAuthProvider(props: { clientId: string; children: React.ReactNode }): JSX.Element;
  export function GoogleLogin(props: {
    onSuccess?: (credentialResponse: CredentialResponse) => void;
    onError?: () => void;
    useOneTap?: boolean;
  }): JSX.Element;
}

declare module 'react-markdown' {
  import * as React from 'react';
  const ReactMarkdown: React.ComponentType<{ children?: React.ReactNode; remarkPlugins?: unknown[] }>;
  export default ReactMarkdown;
}

declare module 'remark-gfm' {
  const plugin: unknown;
  export default plugin;
}

declare module 'lucide-react' {
  import * as React from 'react';
  export const Bot: React.ComponentType<{ size?: number }>;
  export const Clock3: React.ComponentType<{ size?: number }>;
  export const FileText: React.ComponentType<{ size?: number }>;
  export const LogOut: React.ComponentType<{ size?: number }>;
  export const MessageSquareMore: React.ComponentType<{ size?: number }>;
  export const Paperclip: React.ComponentType<{ size?: number }>;
  export const Plus: React.ComponentType<{ size?: number }>;
  export const Sparkles: React.ComponentType<{ size?: number }>;
  export const Shield: React.ComponentType<{ size?: number }>;
  export const Send: React.ComponentType<{ size?: number }>;
  export const UploadCloud: React.ComponentType<{ size?: number }>;
  export const Wrench: React.ComponentType<{ size?: number }>;
}

declare module '@ragdocs/ui' {
  import * as React from 'react';

  export function Avatar(props: { name: string; className?: string }): JSX.Element;
  export function Badge(props: React.HTMLAttributes<HTMLSpanElement> & { tone?: 'neutral' | 'accent' | 'success' | 'warning' }): JSX.Element;
  export function Button(props: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'sm' | 'md' | 'lg' }): JSX.Element;
  export function Card(props: React.HTMLAttributes<HTMLDivElement>): JSX.Element;
  export function ConversationListItem(props: { active?: boolean; title: string; subtitle?: string; onClick?: () => void }): JSX.Element;
  export function Divider(props: React.HTMLAttributes<HTMLDivElement>): JSX.Element;
  export function EmptyState(props: { title: string; description: string; action?: React.ReactNode }): JSX.Element;
  export function IconButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>): JSX.Element;
  export function Input(props: React.InputHTMLAttributes<HTMLInputElement>): JSX.Element;
  export function MessageBubble(props: { role: 'user' | 'assistant'; children: React.ReactNode; meta?: React.ReactNode; className?: string }): JSX.Element;
  export function SectionTitle(props: { eyebrow?: string; title: string; description?: string }): JSX.Element;
  export function SourceCard(props: { title: string; excerpt: string; meta?: string }): JSX.Element;
  export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>): JSX.Element;
}

declare module '@ragdocs/sdk' {
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

  export class RagGeminiClient {
    constructor(options: { baseUrl: string; headers?: HeadersInit });
    getFeatures(): Promise<FeatureFlags>;
    authenticateGoogle(credential: string): Promise<UserSession>;
    authenticateDemo(email: string, name: string): Promise<UserSession>;
    uploadDocument(file: File, session: UserSession, conversationId?: string): Promise<UploadResponse>;
    sendMessage(conversationId: string | undefined, message: string, session: UserSession): Promise<ChatResponse>;
    listConversations(session: UserSession): Promise<Conversation[]>;
    getConversation(id: string, session: UserSession): Promise<Conversation>;
  }
}

declare module 'react-dom/client' {
  import * as React from 'react';
  export function createRoot(container: Element | DocumentFragment): {
    render(children: React.ReactNode): void;
  };
}
