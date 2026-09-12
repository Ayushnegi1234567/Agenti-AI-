import { useEffect, useRef, useState } from "react";
import "./styles.css";

const getApiBaseUrl = () => {
  const configuredUrl = import.meta.env.VITE_API_BASE_URL;

  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, "");
  }

  if (typeof window === "undefined") {
    return "";
  }

  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    return "http://localhost:3001";
  }

  return window.location.origin;
};

const BACKEND_URL = getApiBaseUrl();
const WELCOME_MESSAGE = { role: "assistant", content: "Hello! I am ready to help. Ask me anything." };

function renderMessage(content) {
  return content.split("\n").map((line, index) => {
    const parts = line.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).filter(Boolean);
    return (
      <span key={`${line}-${index}`} className={line.startsWith("- ") ? "markdown-list-item" : ""}>
        {parts.map((part, partIndex) => {
          if (part.startsWith("**") && part.endsWith("**")) {
            return <strong key={partIndex}>{part.slice(2, -2)}</strong>;
          }
          if (part.startsWith("`") && part.endsWith("`")) {
            return <code key={partIndex}>{part.slice(1, -1)}</code>;
          }
          return part.startsWith("- ") ? part.slice(2) : part;
        })}
        {index < content.split("\n").length - 1 && <br />}
      </span>
    );
  });
}

function App() {
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [conversations, setConversations] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("agenticia-conversations") ?? "[]");
    } catch {
      return [];
    }
  });
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    localStorage.setItem("agenticia-conversations", JSON.stringify(conversations));
  }, [conversations]);

  function startNewChat() {
    if (isLoading) return;
    setMessages([WELCOME_MESSAGE]);
    setActiveConversationId(null);
    setIsSidebarOpen(false);
  }

  function openConversation(conversation) {
    if (isLoading) return;
    setMessages(conversation.messages);
    setActiveConversationId(conversation.id);
    setIsSidebarOpen(false);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const trimmedInput = input.trim();

    if (!trimmedInput || isLoading) return;

    const userMessage = { role: "user", content: trimmedInput };
    const nextHistory = [...messages, userMessage];
    const conversationId = activeConversationId ?? crypto.randomUUID();
    const existingConversation = conversations.find((conversation) => conversation.id === conversationId);
    const updatedConversation = {
      id: conversationId,
      title: existingConversation?.title ?? trimmedInput.slice(0, 34),
      messages: nextHistory,
      updatedAt: Date.now(),
    };
    setActiveConversationId(conversationId);
    setConversations((current) => [
      updatedConversation,
      ...current.filter((conversation) => conversation.id !== conversationId),
    ]);
    setMessages(nextHistory);
    setInput("");
    setIsLoading(true);

    const assistantMessage = { role: "assistant", content: "" };
    setMessages([...nextHistory, assistantMessage]);

    try {
      const response = await fetch(`${BACKEND_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmedInput,
          history: nextHistory,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch response");
      }

      const finalPayload = await response.json();
      setMessages((currentMessages) => [
        ...currentMessages.slice(0, -1),
        {
          role: "assistant",
          content: finalPayload?.text ?? "The assistant returned no response.",
        },
      ]);
      setConversations((current) => current.map((conversation) => (
        conversation.id === conversationId
          ? { ...conversation, messages: [...nextHistory, { role: "assistant", content: finalPayload?.text ?? "The assistant returned no response." }], updatedAt: Date.now() }
          : conversation
      )));
    } catch (error) {
      setMessages((currentMessages) => [
        ...currentMessages.slice(0, -1),
        {
          role: "assistant",
          content: error instanceof Error ? error.message : "Something went wrong.",
        },
      ]);
      setConversations((current) => current.map((conversation) => (
        conversation.id === conversationId
          ? { ...conversation, messages: [...nextHistory, { role: "assistant", content: error instanceof Error ? error.message : "Something went wrong." }], updatedAt: Date.now() }
          : conversation
      )));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="app-shell">
      {isSidebarOpen && <button className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)} aria-label="Close chat history" />}
      <aside className={`sidebar ${isSidebarOpen ? "open" : ""}`}>
        <div className="sidebar-brand"><span>✦</span> Agenticia</div>
        <button className="new-chat" onClick={startNewChat} disabled={isLoading}>＋ New chat</button>
        <div className="history-heading">Recent chats</div>
        <div className="history-list">
          {conversations.length === 0 && <div className="empty-history">Your conversations will appear here.</div>}
          {conversations.map((conversation) => (
            <button
              className={`history-item ${conversation.id === activeConversationId ? "active" : ""}`}
              key={conversation.id}
              onClick={() => openConversation(conversation)}
            >
              <span>◌</span>
              <span>{conversation.title}</span>
            </button>
          ))}
        </div>
        <div className="sidebar-footer">Powered by Groq</div>
      </aside>
      <div className="chat-window">
        <header className="chat-header">
          <button
            className="menu-button"
            onClick={() => setIsSidebarOpen((open) => !open)}
            aria-label="Toggle chat history"
          >
            ☰
          </button>
          <h1>Agenticia</h1>
        </header>

        <div className="message-list">
          {messages.map((message, index) => (
            <div key={`${message.role}-${index}`} className={`message-row ${message.role}`}>
              {message.role === "assistant" && <div className="avatar">A</div>}
              <div className="message-content">
                <div className="message-label">{message.role === "assistant" ? "Agenticia" : "You"}</div>
                <div className="message-bubble">
                  {message.content
                    ? renderMessage(message.content)
                    : isLoading && index === messages.length - 1
                      ? <span className="typing"><i /><i /><i /></span>
                      : ""}
                </div>
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>

        <form className="composer" onSubmit={handleSubmit}>
          <input
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Type your message..."
            disabled={isLoading}
          />
          <button type="submit" disabled={isLoading || !input.trim()} aria-label="Send message">
            {isLoading ? "..." : "↑"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default App;
