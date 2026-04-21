import type {
  AuthResponse,
  ChatResponse,
  Conversation,
  FeatureFlags,
  UploadResponse,
  UserSession
} from './types';

export type RagGeminiClientOptions = {
  baseUrl: string;
  headers?: HeadersInit;
};

export class RagGeminiClient {
  private baseUrl: string;
  private headers?: HeadersInit;

  constructor(options: RagGeminiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.headers = options.headers;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const requestHeaders = new Headers(this.headers);

    if (!(init?.body instanceof FormData)) {
      requestHeaders.set('Content-Type', 'application/json');
    }

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => {
        requestHeaders.set(key, value);
      });
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: requestHeaders
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || `Request failed with status ${response.status}`);
    }

    return response.json() as Promise<T>;
  }

  async getFeatures(): Promise<FeatureFlags> {
    return this.request<FeatureFlags>('/features');
  }

  async authenticateGoogle(credential: string): Promise<UserSession> {
    const data = await this.request<AuthResponse>('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ credential })
    });

    return data.session;
  }

  async authenticateDemo(email: string, name: string): Promise<UserSession> {
    const data = await this.request<AuthResponse>('/auth/demo', {
      method: 'POST',
      body: JSON.stringify({ email, name })
    });

    return data.session;
  }

  async uploadDocument(file: File, session: UserSession, conversationId?: string): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('session', JSON.stringify(session));
    if (conversationId) {
      formData.append('conversation_id', conversationId);
    }

    const response = await fetch(`${this.baseUrl}/documents`, {
      method: 'POST',
      body: formData,
      headers: {
        ...(this.headers || {})
      }
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || 'Upload failed');
    }

    return response.json() as Promise<UploadResponse>;
  }

  async sendMessage(conversationId: string | undefined, message: string, session: UserSession): Promise<ChatResponse> {
    return this.request<ChatResponse>('/chat', {
      method: 'POST',
      body: JSON.stringify({ conversation_id: conversationId, message, session })
    });
  }

  async listConversations(session: UserSession): Promise<Conversation[]> {
    const query = new URLSearchParams({ session: JSON.stringify(session) });
    return this.request<Conversation[]>(`/conversations?${query.toString()}`);
  }

  async getConversation(id: string, session: UserSession): Promise<Conversation> {
    const query = new URLSearchParams({ session: JSON.stringify(session) });
    return this.request<Conversation>(`/conversations/${id}?${query.toString()}`);
  }
}
