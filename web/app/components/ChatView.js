'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const MODELS_CHEAP = ['chatgpt_cheap', 'claude_cheap', 'grok_cheap', 'gemini_cheap'];
const MODELS_BEST = ['chatgpt_best', 'claude_best', 'grok_best', 'gemini_best'];

const MODEL_LABELS = {
  chatgpt_cheap: 'ChatGPT', chatgpt_best: 'ChatGPT',
  claude_cheap: 'Claude', claude_best: 'Claude',
  grok_cheap: 'Grok', grok_best: 'Grok',
  gemini_cheap: 'Gemini', gemini_best: 'Gemini',
};

function AssistantMessage({ m, preferredMode }) {
  const isStreaming = m._streaming;
  const responsesInfo = isStreaming ? m._streamResponses : m.model_responses;
  const summaryText = isStreaming ? m._streamSummary : m.summary;

  let modelData = {};
  if (responsesInfo) {
    if (Array.isArray(responsesInfo)) {
      responsesInfo.forEach((r) => { modelData[r.model_name] = r; });
    } else {
      modelData = responsesInfo;
    }
  }

  const modelsList = preferredMode === 'best' ? MODELS_BEST : MODELS_CHEAP;
  const hasSummary = !!summaryText;

  const [activeTab, setActiveTab] = useState(modelsList[0]);

  useEffect(() => {
    if (summaryText) setActiveTab('summary');
  }, [summaryText]);

  const tabs = [...modelsList];
  if (hasSummary || isStreaming) tabs.push('summary');

  const activeResponse = activeTab === 'summary'
    ? { content: summaryText, ok: true }
    : modelData[activeTab];

  return (
    <div style={s.assistantRow}>
      <div className="user-bubble" style={s.assistantCard}>
        <div className="tabs-header-container" style={s.tabsHeader}>
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="tab-btn"
              style={activeTab === tab ? s.tabActive : s.tab}
            >
              {tab === 'summary' ? 'Summary' : MODEL_LABELS[tab]}
            </button>
          ))}
        </div>

        <div style={s.tabContent}>
          {activeTab === 'summary' ? (
            summaryText ? (
              <div style={s.modelText} className="markdown-body">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{summaryText}</ReactMarkdown>
              </div>
            ) : isStreaming ? (
              <div style={s.typing}>Waiting for summary…</div>
            ) : null
          ) : activeResponse ? (
            activeResponse.error ? (
              <div style={s.modelErr}>{activeResponse.error?.message || String(activeResponse.error)}</div>
            ) : activeResponse.content ? (
              <div style={s.modelText} className="markdown-body">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{activeResponse.content}</ReactMarkdown>
              </div>
            ) : isStreaming ? (
              <div style={s.typing}>Loading response…</div>
            ) : (
              <div style={s.modelText}>—</div>
            )
          ) : isStreaming ? (
            <div style={s.typing}>Loading response…</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function ChatView() {
  const [threadIdFromUrl, setThreadIdFromUrl] = useState(null);
  const [threadId, setThreadId] = useState(null);
  const [thread, setThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [user, setUser] = useState(null);
  const [preferredMode, setPreferredMode] = useState('cheap');
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const ignoreNextLoad = useRef(false);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('thread');
    setThreadIdFromUrl(id);
    setThreadId(id);
  }, []);

  useEffect(() => {
    if (threadIdFromUrl !== undefined && threadIdFromUrl !== null) {
      setThreadId(threadIdFromUrl);
    }
  }, [threadIdFromUrl]);

  useEffect(() => {
    const handler = (e) => {
      const id = e.detail ?? null;
      setThreadIdFromUrl(id);
      setThreadId(id);
    };
    window.addEventListener('thread-nav', handler);
    return () => window.removeEventListener('thread-nav', handler);
  }, []);

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        if (d.user) {
          setUser(d.user);
          setPreferredMode(d.user.preferred_mode || 'cheap');
        }
      });
  }, []);

  const loadThread = useCallback(async (id) => {
    if (!id) {
      setThread(null);
      setMessages([]);
      return;
    }
    setLoadingThread(true);
    try {
      const res = await fetch(`/api/threads/${id}`, { credentials: 'include' });
      if (!res.ok) {
        setThread(null);
        setMessages([]);
        return;
      }
      const data = await res.json();
      setThread(data);
      setMessages(data.messages || []);
    } catch {
      setThread(null);
      setMessages([]);
    } finally {
      setLoadingThread(false);
    }
  }, []);

  useEffect(() => {
    if (ignoreNextLoad.current) {
      ignoreNextLoad.current = false;
      return;
    }
    loadThread(threadId);
  }, [threadId, loadThread]);

  useEffect(() => {
    // Only scroll to bottom if we are at the bottom, or just sent a message
    // To prevent aggressive auto-scrolling during streaming
  }, []);

  async function handleModeToggle() {
    const next = preferredMode === 'cheap' ? 'best' : 'cheap';
    setPreferredMode(next);
    try {
      await fetch('/api/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ preferred_mode: next }),
      });
    } catch (_) { }
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    setSending(true);
    let currentThreadId = threadId;
    if (!currentThreadId) {
      try {
        const createRes = await fetch('/api/threads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ title: 'New chat' }),
        });
        if (!createRes.ok) throw new Error('Create failed');
        const newThread = await createRes.json();
        currentThreadId = newThread.id;
        ignoreNextLoad.current = true;
        setThreadId(currentThreadId);
        setThreadIdFromUrl(currentThreadId);
        setThread(newThread);
        setMessages([]);
        window.dispatchEvent(new Event('refresh-threads'));
        window.dispatchEvent(new CustomEvent('thread-nav', { detail: currentThreadId }));
        window.history.replaceState(null, '', `/app?thread=${currentThreadId}`);
      } catch (err) {
        setSending(false);
        return;
      }
    }

    const tempId = `temp-${Date.now()}`;
    const models = preferredMode === 'best' ? MODELS_BEST : MODELS_CHEAP;
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        role: 'user',
        content: text,
        created_at: new Date().toISOString(),
        model_responses: null,
        summary: null,
        _streaming: true,
        _streamResponses: Object.fromEntries(models.map((m) => [m, { content: '', ok: false, error: null }])),
      },
    ]);

    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);

    try {
      const res = await fetch('/api/messages/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          thread_id: currentThreadId,
          content: text,
          mode: preferredMode,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId ? { ...m, _streaming: false, _error: data.error || 'Failed to send' } : m
          )
        );
        setSending(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let messageId = null;
      let finalResponses = {};
      let summary = null;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            if (data.type === 'start') {
              messageId = data.message_id;
            } else if (data.type === 'model_chunk') {
              setMessages((prev) =>
                prev.map((m) => {
                  if (m.id !== tempId || !m._streaming) return m;
                  const currentContent = m._streamResponses?.[data.model]?.content || '';
                  return {
                    ...m,
                    _streamResponses: {
                      ...m._streamResponses,
                      [data.model]: { content: currentContent + data.chunk, ok: true, error: null }
                    },
                  };
                })
              );
            } else if (data.type === 'model_done' || data.type === 'model') {
              finalResponses[data.model] = {
                model_name: data.model,
                content: data.content,
                ok: data.ok,
                error: data.error,
              };
              setMessages((prev) =>
                prev.map((m) => {
                  if (m.id !== tempId || !m._streaming) return m;
                  return {
                    ...m,
                    _streamResponses: { ...m._streamResponses, [data.model]: { content: data.content, ok: data.ok, error: data.error } },
                  };
                })
              );
            } else if (data.type === 'summary') {
              summary = data.content;
              setMessages((prev) =>
                prev.map((m) => {
                  if (m.id !== tempId || !m._streaming) return m;
                  return { ...m, _streamSummary: data.content };
                })
              );
            } else if (data.type === 'done') {
              setMessages((prev) =>
                prev.map((m) => {
                  if (m.id !== tempId) return m;
                  return {
                    ...m,
                    id: messageId || m.id,
                    _streaming: false,
                    model_responses: Object.values(finalResponses),
                    summary: summary,
                    _streamResponses: undefined,
                    _streamSummary: undefined,
                  };
                })
              );
            } else if (data.type === 'error') {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === tempId ? { ...m, _streaming: false, _error: data.error } : m
                )
              );
            }
          } catch (_) { }
        }
      }
      window.dispatchEvent(new Event('refresh-threads'));
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, _streaming: false, _error: 'Connection error' } : m))
      );
    } finally {
      setSending(false);
    }
  }

  if (loadingThread && threadId) {
    return (
      <div style={s.center}>
        <span>Loading…</span>
      </div>
    );
  }

  return (
    <div style={s.container}>
      <div style={s.toolbar}>
        <span style={s.toolbarTitle}>{thread?.title || 'New chat'}</span>
      </div>
      <div style={s.scroll}>
        <div className="chat-wrapper" style={s.chat}>
          {messages.length === 0 && !sending && (
            <div style={s.empty}>
              <p>Type a message or select a chat from the sidebar.</p>
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} style={s.msgWrap}>
              <div style={s.userRow}>
                <div className="user-bubble" style={s.userBubble}>
                  <div style={s.userContent}>{m.content}</div>
                </div>
              </div>
              {m._error && <div style={s.errRow}>{m._error}</div>}

              {(m._streaming || m.model_responses) && (
                <AssistantMessage m={m} preferredMode={preferredMode} />
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>
      <div className="composer-container" style={s.composerArea}>
        <div style={s.composerControls}>
          <button type="button" onClick={handleModeToggle} style={s.modeBtn}>
            {preferredMode === 'cheap' ? '⚡️ Cheap Mode' : '✨ Best Mode'}
          </button>
        </div>
        <div style={s.composer}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Type a message…"
            rows={1}
            className="composer-input"
            style={s.textarea}
            disabled={sending}
          />
          <button
            type="button"
            onClick={sendMessage}
            disabled={sending || !input.trim()}
            style={s.sendBtn}
            title="Send"
          >
            {sending ? '⋯' : '➤'}
          </button>
        </div>
      </div>
    </div>
  );
}

const s = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    background: 'var(--chat-bg)',
  },
  center: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--thread-text)',
  },
  toolbar: {
    padding: '12px 16px',
    borderBottom: '1px solid var(--border-color)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  toolbarTitle: {
    fontWeight: 600,
    fontSize: '15px',
    color: 'var(--text-color)',
  },
  scroll: {
    flex: 1,
    overflow: 'auto',
    display: 'flex',
    justifyContent: 'center',
  },
  chat: {
    width: '100%',
    maxWidth: '48rem',
    margin: '0 auto',
    padding: '24px 16px 24px',
  },
  empty: {
    padding: '48px 0',
    textAlign: 'center',
    color: 'var(--thread-text)',
    fontSize: '15px',
  },
  msgWrap: {
    marginBottom: '32px',
  },
  userRow: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
  userBubble: {
    maxWidth: '85%',
    background: 'var(--user-bubble)',
    borderRadius: '18px',
    padding: '12px 18px',
    borderBottomRightRadius: '4px',
  },
  userContent: {
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    fontSize: '15px',
    lineHeight: 1.5,
    color: 'var(--text-color)',
  },
  errRow: {
    marginTop: '8px',
    padding: '10px 14px',
    background: 'var(--err-bg)',
    borderRadius: '10px',
    color: 'var(--err-text)',
    fontSize: '14px',
  },
  assistantRow: {
    display: 'flex',
    justifyContent: 'flex-start',
    marginTop: '12px',
  },
  assistantCard: {
    width: '100%',
    background: 'transparent',
  },
  tabsHeader: {
    display: 'flex',
    gap: '4px',
    marginBottom: '8px',
  },
  tab: {
    background: 'var(--tab-bg)',
    border: 'none',
    color: 'var(--tab-text)',
    padding: '6px 12px',
    borderRadius: '16px',
    fontSize: '13px',
    cursor: 'pointer',
    fontWeight: 500,
    transition: 'all 0.2s',
  },
  tabActive: {
    background: 'var(--tab-active-bg)',
    border: 'none',
    color: 'var(--tab-active-text)',
    padding: '6px 12px',
    borderRadius: '16px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
  },
  tabContent: {
    padding: '8px 4px',
  },
  modelText: {
    fontSize: '15px',
    lineHeight: 1.6,
    color: 'var(--text-color)',
    wordBreak: 'break-word',
  },
  modelErr: {
    fontSize: '14px',
    color: 'var(--err-text)',
  },
  typing: {
    fontSize: '14px',
    color: 'var(--thread-text)',
    fontStyle: 'italic',
  },
  composerArea: {
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    flexShrink: 0,
    maxWidth: '48rem',
    margin: '0 auto',
    width: '100%',
  },
  composerControls: {
    width: '100%',
    display: 'flex',
    justifyContent: 'flex-end',
    marginBottom: '8px',
  },
  modeBtn: {
    padding: '6px 12px',
    background: 'var(--tab-bg)',
    border: 'none',
    borderRadius: '8px',
    color: 'var(--text-color)',
    fontSize: '12px',
    cursor: 'pointer',
    fontWeight: 500,
  },
  composer: {
    display: 'flex',
    gap: '12px',
    alignItems: 'flex-end',
    background: 'var(--composer-bg)',
    width: '100%',
    padding: '8px',
    borderRadius: '24px',
    border: '1px solid var(--border-color)',
  },
  textarea: {
    flex: 1,
    padding: '8px 16px',
    background: 'transparent',
    border: 'none',
    color: 'var(--text-color)',
    resize: 'none',
    fontSize: '16px', /* 16px strictly to prevent iOS auto-zoom */
    lineHeight: 1.5,
    minHeight: '24px',
    maxHeight: '200px',
    outline: 'none',
  },
  sendBtn: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#3b82f6',
    border: 'none',
    color: '#fff',
    fontWeight: 600,
    fontSize: '18px',
    cursor: 'pointer',
    flexShrink: 0,
    padding: 0,
  },
};
