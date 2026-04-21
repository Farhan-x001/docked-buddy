import { useEffect, useMemo, useRef, useState } from 'react';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Bot,
  Clock3,
  FileText,
  LogOut,
  MessageSquareMore,
  Paperclip,
  Plus,
  Sparkles,
  Shield,
  Send,
  UploadCloud,
  Wrench
} from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  Card,
  ConversationListItem,
  Divider,
  EmptyState,
  IconButton,
  Input,
  MessageBubble,
  SectionTitle,
  SourceCard,
  Textarea
} from '@ragdocs/ui';
import {
  RagGeminiClient,
  type ChatResponse,
  type Conversation,
  type FeatureFlags,
  type Message,
  type UserSession
} from '@ragdocs/sdk';
import { readLocalStorage, removeLocalStorage, writeLocalStorage } from './lib/storage';

type LocalState = {
  session: UserSession | null;
  conversations: Conversation[];
  selectedConversationId: string | null;
};

const STORAGE_KEY = 'ragdocs.localState.v1';
const DEFAULT_FEATURES: FeatureFlags = {
  uploadEnabled: true,
  adminOnlyUpload: false,
  browserHistoryEnabled: true,
  mongodbEnabled: false,
  allowGuestChat: true,
  modelName: 'gemini-1.5-flash',
  chunkSize: 900,
  chunkOverlap: 180,
  maxUploadMb: 20
};

const suggestions = [
  'Summarize the key ideas in this document.',
  'Explain the most important concepts in simple language.',
  'Generate practice questions from this document.',
  'Compare the ideas across the uploaded files.'
];

const GUEST_SESSION: UserSession = {
  id: 'guest',
  name: 'Guest Reader',
  email: 'guest@local',
  role: 'guest'
};

const emptyConversation = (): Conversation => ({
  id: crypto.randomUUID(),
  title: 'New conversation',
  updatedAt: new Date().toISOString(),
  messages: [],
  documentNames: []
});

function formatTime(value: string) {
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function makeLocalReply(question: string, conversation: Conversation): Message {
  const documentText = conversation.documentNames.length
    ? `I can see ${conversation.documentNames.length} uploaded document${conversation.documentNames.length > 1 ? 's' : ''}: ${conversation.documentNames.join(', ')}.`
    : 'No documents are attached to this conversation yet.';

  return {
    id: crypto.randomUUID(),
    role: 'assistant',
    content: [
      'The backend is not connected yet, so this is a local fallback response.',
      documentText,
      '',
      'Once the FastAPI service is running with Gemini configured, this answer will come from retrieval over your uploaded files.'
    ].join('\n'),
    createdAt: new Date().toISOString(),
    sources: conversation.documentNames.slice(0, 3).map((title: string, index: number) => ({
      title,
      excerpt: `Document ${index + 1} from the current conversation.`,
      score: 1 - index * 0.08
    }))
  };
}

function usePersistentAppState() {
  const [state, setState] = useState<LocalState>(() =>
    readLocalStorage<LocalState>(STORAGE_KEY, {
      session: null,
      conversations: [emptyConversation()],
      selectedConversationId: null
    })
  );

  useEffect(() => {
    writeLocalStorage(STORAGE_KEY, state);
  }, [state]);

  return [state, setState] as const;
}

function AppContent() {
  const defaultApiBaseUrl = import.meta.env.PROD ? 'https://docked-buddy.onrender.com' : 'http://localhost:8000';
  const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() || defaultApiBaseUrl;
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
  const client = useMemo(
    () => (apiBaseUrl ? new RagGeminiClient({ baseUrl: apiBaseUrl }) : null),
    [apiBaseUrl]
  );

  const [appState, setAppState] = usePersistentAppState();
  const [features, setFeatures] = useState<FeatureFlags>(DEFAULT_FEATURES);
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'ready' | 'offline' | 'error'>('idle');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const session = appState.session ?? (features.allowGuestChat ? GUEST_SESSION : null);
  const conversations = appState.conversations;
  const selectedConversation =
    conversations.find((conversation) => conversation.id === appState.selectedConversationId) ?? conversations[0];
  const canUpload = features.uploadEnabled && (!features.adminOnlyUpload || session?.role === 'admin');
  const canChat = Boolean(session) || features.allowGuestChat;

  useEffect(() => {
    if (!client) {
      setStatus('offline');
      return;
    }

    client
      .getFeatures()
      .then((nextFeatures: FeatureFlags) => {
        setFeatures(nextFeatures);
        setStatus('ready');
      })
      .catch(() => {
        setStatus('error');
        setFeatures(DEFAULT_FEATURES);
      });
  }, [client]);

  useEffect(() => {
    if (!client || !session) {
      return;
    }

    client
      .listConversations(session)
      .then((remote: Conversation[]) => {
        if (remote.length) {
          setAppState((current) => ({
            ...current,
            conversations: remote,
            selectedConversationId: remote[0]?.id ?? current.selectedConversationId
          }));
        }
      })
      .catch(() => undefined);
  }, [client, session, setAppState]);

  useEffect(() => {
    if (!appState.selectedConversationId && conversations[0]) {
      setAppState((current) => ({
        ...current,
        selectedConversationId: conversations[0].id
      }));
    }
  }, [appState.selectedConversationId, conversations, setAppState]);

  const startNewConversation = () => {
    const next = emptyConversation();
    setAppState((current) => ({
      ...current,
      conversations: [next, ...current.conversations],
      selectedConversationId: next.id
    }));
  };

  const signInAsDemo = () => {
    if (!client) {
      return;
    }

    const name = 'Demo User';
    const email = 'demo@example.com';
    client.authenticateDemo(email, name).then((user: UserSession) => {
      setAppState((current) => ({ ...current, session: user }));
    });
  };

  const handleGoogleLogin = async (response: CredentialResponse) => {
    if (!client || !response.credential) {
      return;
    }

    const user = await client.authenticateGoogle(response.credential);
    setAppState((current) => ({ ...current, session: user }));
  };

  const logout = () => {
    setAppState((current) => ({ ...current, session: null }));
    removeLocalStorage(STORAGE_KEY);
  };

  const updateConversation = (conversationId: string, updater: (conversation: Conversation) => Conversation) => {
    setAppState((current) => ({
      ...current,
      conversations: current.conversations.map((conversation) =>
        conversation.id === conversationId ? updater(conversation) : conversation
      )
    }));
  };

  const ensureConversation = () => {
    if (selectedConversation) {
      return selectedConversation;
    }

    const next = emptyConversation();
    setAppState((current) => ({
      ...current,
      conversations: [next, ...current.conversations],
      selectedConversationId: next.id
    }));

    return next;
  };

  const handleSend = async () => {
    if (!canChat || !messageText.trim()) {
      return;
    }

    const conversation = ensureConversation();
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: messageText.trim(),
      createdAt: new Date().toISOString()
    };

    updateConversation(conversation.id, (current) => ({
      ...current,
      title: current.title === 'New conversation' ? messageText.slice(0, 48) : current.title,
      messages: [...current.messages, userMessage],
      updatedAt: new Date().toISOString()
    }));
    setMessageText('');
    setIsSending(true);

    try {
      if (!client || !session) {
        const reply = makeLocalReply(userMessage.content, conversation);
        updateConversation(conversation.id, (current) => ({
          ...current,
          messages: [...current.messages, reply],
          updatedAt: new Date().toISOString()
        }));
        return;
      }

      const result = await client.sendMessage(conversation.id, userMessage.content, session);
      hydrateConversationFromResponse(conversation.id, result);
    } catch {
      const reply = makeLocalReply(userMessage.content, conversation);
      updateConversation(conversation.id, (current) => ({
        ...current,
        messages: [...current.messages, reply],
        updatedAt: new Date().toISOString()
      }));
    } finally {
      setIsSending(false);
    }
  };

  const hydrateConversationFromResponse = (conversationId: string, result: ChatResponse) => {
    updateConversation(conversationId, () => result.conversation);
    setAppState((current) => ({
      ...current,
      selectedConversationId: result.conversationId,
      conversations: [result.conversation, ...current.conversations.filter((item) => item.id !== result.conversationId)]
    }));
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !canUpload) {
      return;
    }

    if (!session) {
      return;
    }

    setIsUploading(true);
    const conversation = ensureConversation();

    try {
      if (!client) {
        throw new Error('Backend not configured');
      }

      const response = await client.uploadDocument(file, session, conversation.id);
      updateConversation(conversation.id, (current) => ({
        ...current,
        documentNames: Array.from(new Set([...current.documentNames, response.title])),
        updatedAt: new Date().toISOString()
      }));
    } catch {
      updateConversation(conversation.id, (current) => ({
        ...current,
        documentNames: Array.from(new Set([...current.documentNames, file.name])),
        updatedAt: new Date().toISOString()
      }));
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  };

  const currentSources = useMemo(
    () => selectedConversation?.messages.flatMap((message: Message) => message.sources ?? []).slice(0, 4) ?? [],
    [selectedConversation]
  );

  const attachedDocuments = selectedConversation?.documentNames ?? [];

  const lastAssistant = selectedConversation?.messages.filter((message: Message) => message.role === 'assistant').at(-1);

  if (!session && !features.allowGuestChat) {
    return (
      <div className="auth-gate">
        <Card className="auth-card">
          <div className="auth-hero">
            <Badge tone="accent">Docs Chat • NotebookLM-style</Badge>
            <h1>Chat with your documents in a clean, premium interface.</h1>
            <p>
              Upload PDFs, Word documents, and text files, then ask questions in a chat window built for learning,
              summarization, and concept discovery. Roles, uploads, and persistence are configurable through YAML.
            </p>
            <div className="auth-actions">
              {googleClientId ? <span className="helper-text">Sign in with Google on the right.</span> : null}
              {!googleClientId ? <Button onClick={signInAsDemo}>Enter demo mode</Button> : null}
            </div>
          </div>
          <div className="auth-side">
            <SectionTitle
              eyebrow="Access control"
              title="Sign in to continue"
              description="Google auth is enabled when the client ID is configured. Demo auth is available for local development."
            />
            {googleClientId ? (
              <GoogleLogin onSuccess={handleGoogleLogin} onError={() => undefined} useOneTap />
            ) : (
              <Card style={{ padding: '1rem' }}>
                <p className="helper-text">
                  Add <code>VITE_GOOGLE_CLIENT_ID</code> to enable Google login. Until then, use demo mode to continue.
                </p>
                <Button onClick={signInAsDemo}>Use demo account</Button>
              </Card>
            )}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className="shell-panel sidebar">
        <Card style={{ padding: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'center' }}>
            <div className="brand-mark">
              <Bot size={18} />
            </div>
            <div>
              <strong>RAG Gemini Docs</strong>
              <div className="helper-text">Notebook-style learning workspace</div>
            </div>
          </div>
          <Divider style={{ margin: '1rem 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <Avatar name={session?.name ?? 'Guest Reader'} />
              <div>
                <strong>{session?.name ?? 'Guest Reader'}</strong>
                <div className="helper-text">{session?.email ?? 'guest@local'}</div>
              </div>
            </div>
            <IconButton onClick={logout} aria-label="Logout">
              <LogOut size={16} />
            </IconButton>
          </div>
        </Card>

        <section className="sidebar__section">
          <div className="sidebar__heading">
            <h2>Conversations</h2>
            <Button size="sm" variant="secondary" onClick={startNewConversation}>
              <Plus size={14} /> New
            </Button>
          </div>
          <div className="sidebar__list">
            {conversations.map((conversation) => (
              <ConversationListItem
                key={conversation.id}
                active={conversation.id === selectedConversation?.id}
                title={conversation.title}
                subtitle={`${conversation.messages.length} messages • ${formatTime(conversation.updatedAt)}`}
                onClick={() => setAppState((current) => ({ ...current, selectedConversationId: conversation.id }))}
              />
            ))}
          </div>
        </section>

        <section className="sidebar__section">
          <SectionTitle
            eyebrow="Status"
            title="Workspace overview"
            description="Browser history is stored locally first and can sync to MongoDB later."
          />
          <div className="kpi-grid" style={{ marginTop: '0.9rem' }}>
            <div className="kpi">
              <strong>{conversations.length}</strong>
              <span>threads</span>
            </div>
            <div className="kpi">
              <strong>{features.modelName}</strong>
              <span>model</span>
            </div>
            <div className="kpi">
              <strong>{features.mongodbEnabled ? 'On' : 'Off'}</strong>
              <span>MongoDB</span>
            </div>
            <div className="kpi">
              <strong>{status}</strong>
              <span>API</span>
            </div>
          </div>
        </section>
      </aside>

      <main className="shell-panel main-panel">
        <div className="topbar">
          <div className="topbar__brand">
            <div className="brand-mark">
              <Sparkles size={18} />
            </div>
            <div className="brand-copy">
              <h1>AI chat for documents</h1>
              <p>White, calm, Vercel-inspired interface with NotebookLM-style workflows.</p>
            </div>
          </div>
          <div className="topbar__actions">
            <Badge tone={session?.role === 'admin' ? 'success' : 'neutral'}>{session?.role ?? 'guest'}</Badge>
            <Badge tone={features.uploadEnabled ? 'success' : 'warning'}>
              {features.uploadEnabled ? 'Uploads enabled' : 'Uploads disabled'}
            </Badge>
            <Badge tone={canUpload ? 'accent' : 'warning'}>
              {canUpload ? 'You can upload' : 'Admin upload only'}
            </Badge>
            {features.mongodbEnabled ? <Badge tone="accent">MongoDB sync ready</Badge> : null}
          </div>
        </div>

        <section className="chat-stage">
          <Card className="hero-card">
            <div className="hero-card__copy">
              <Badge tone="accent">Conversation {selectedConversation?.id.slice(0, 8) ?? 'new'}</Badge>
              <h2>{selectedConversation?.title ?? 'Start a new conversation'}</h2>
              <p>
                Ask for summaries, explanations, flashcards, comparisons, and concept maps. The backend will ground
                answers in your uploaded files when configured.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <Button variant="secondary">
                <Clock3 size={14} /> Recent
              </Button>
              <Button variant="secondary">
                <Wrench size={14} /> Settings
              </Button>
            </div>
          </Card>

          <div className="chat-scroll">
            {selectedConversation?.messages.length ? (
              <div className="chat-stack">
                {selectedConversation.messages.map((message: Message) => (
                  <div
                    key={message.id}
                    className={`message-shell ${message.role === 'user' ? 'message-shell--user' : ''}`}
                  >
                    <MessageBubble
                      className="message-bubble"
                      role={message.role}
                      meta={formatTime(message.createdAt)}
                    >
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
                    </MessageBubble>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No messages yet"
                description="Upload a document and ask your first question. You can keep everything locally in the browser or sync it to MongoDB later."
                action={
                  <div className="prompt-pills">
                    {suggestions.map((suggestion: string) => (
                      <button key={suggestion} type="button" className="prompt-pill" onClick={() => setMessageText(suggestion)}>
                        {suggestion}
                      </button>
                    ))}
                  </div>
                }
              />
            )}
          </div>

          <div className="composer">
            <div className="composer-card">
              <div className="composer__toolbar">
                <SectionTitle
                  eyebrow="Ask"
                  title="Talk to your uploaded docs"
                  description="Every response can be saved locally first, then synced to the backend when ready."
                />
                <div className="composer__controls">
                  <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.txt,.md" onChange={handleUpload} hidden />
                  <Button variant="secondary" size="sm" disabled={!canUpload || isUploading} onClick={() => fileInputRef.current?.click()}>
                    <UploadCloud size={14} /> {isUploading ? 'Uploading…' : 'Upload'}
                  </Button>
                  <Button variant="secondary" size="sm" onClick={startNewConversation}>
                    <Paperclip size={14} /> New chat
                  </Button>
                </div>
              </div>

              <div className="composer__field">
                <Textarea
                  value={messageText}
                  onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => setMessageText(event.target.value)}
                  placeholder="Ask a question about your document..."
                  rows={4}
                />
                <div className="prompt-pills">
                  {suggestions.map((suggestion: string) => (
                    <button key={suggestion} type="button" className="prompt-pill" onClick={() => setMessageText(suggestion)}>
                      {suggestion}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                  <div className="helper-text">
                    {canUpload
                      ? 'PDF, DOCX, and TXT uploads are supported.'
                      : 'Uploads are restricted by the current feature flag or role.'}
                  </div>
                  <Button onClick={handleSend} disabled={!canChat || isSending || !messageText.trim()}>
                    {isSending ? 'Thinking…' : 'Send'} <Send size={14} />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <aside className="shell-panel inspector">
        <section className="inspector__section">
          <div className="inspector__heading">
            <h2>Document sources</h2>
            <Badge tone={currentSources.length ? 'accent' : 'neutral'}>{currentSources.length}</Badge>
          </div>
          <div className="source-list">
            {currentSources.length ? (
              currentSources.map((source: { title: string; excerpt: string; score?: number }, index: number) => (
                <SourceCard
                  key={`${source.title}-${index}`}
                  title={source.title}
                  excerpt={source.excerpt}
                  meta={source.score ? `Score ${source.score.toFixed(2)}` : undefined}
                />
              ))
            ) : attachedDocuments.length ? (
              attachedDocuments.map((title: string, index: number) => (
                <SourceCard
                  key={`${title}-${index}`}
                  title={title}
                  excerpt="Uploaded to the current conversation and ready for retrieval."
                  meta="Uploaded file"
                />
              ))
            ) : (
              <EmptyState
                title="No sources yet"
                description="Your uploaded files and retrieved snippets will appear here once the backend is connected."
              />
            )}
          </div>
        </section>

        <section className="inspector__section">
          <SectionTitle
            eyebrow="Context"
            title="Current conversation"
            description="The last assistant answer and attached docs are summarized here."
          />
          <div className="tag-list" style={{ marginTop: '0.9rem' }}>
            <Badge tone={session?.role === 'admin' ? 'success' : 'neutral'}>Role: {session?.role ?? 'guest'}</Badge>
            <Badge tone="neutral">Browser storage on</Badge>
            <Badge tone={features.allowGuestChat ? 'success' : 'warning'}>
              {features.allowGuestChat ? 'Guest chat allowed' : 'Guest chat blocked'}
            </Badge>
            <Badge tone={lastAssistant ? 'accent' : 'neutral'}>{lastAssistant ? 'Assistant has replied' : 'Awaiting response'}</Badge>
          </div>
          <Card style={{ marginTop: '1rem', padding: '1rem' }}>
            <div className="helper-text">Last assistant reply</div>
            <p style={{ marginBottom: 0, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
              {lastAssistant?.content ?? 'Ask a question to see grounded answers and suggested next steps.'}
            </p>
          </Card>
        </section>
      </aside>
    </div>
  );
}

export default function App() {
  return <AppContent />;
}
