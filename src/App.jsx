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

function App() {
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hello! I am ready to help. Ask me anything." },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  async function handleSubmit(event) {
    event.preventDefault();
    const trimmedInput = input.trim();

    if (!trimmedInput || isLoading) return;

    const userMessage = { role: "user", content: trimmedInput };
    const nextHistory = [...messages, userMessage];
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

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          if (!part.startsWith("data:")) continue;

          const data = part.replace("data:", "").trim();
          if (!data) continue;

          const payload = JSON.parse(data);

          if (payload.type === "chunk") {
            setMessages((currentMessages) => {
              const updated = [...currentMessages];
              const lastIndex = updated.length - 1;
              updated[lastIndex] = {
                ...updated[lastIndex],
                content: (updated[lastIndex]?.content ?? "") + payload.text,
              };
              return updated;
            });
          }

          if (payload.type === "done") {
            setMessages((currentMessages) => {
              const updated = [...currentMessages];
              const lastIndex = updated.length - 1;
              updated[lastIndex] = {
                ...updated[lastIndex],
                content: payload.text,
              };
              return updated;
            });
          }

          if (payload.type === "error") {
            setMessages((currentMessages) => {
              const updated = [...currentMessages];
              const lastIndex = updated.length - 1;
              updated[lastIndex] = {
                ...updated[lastIndex],
                content: payload.text,
              };
              return updated;
            });
          }
        }
      }
    } catch (error) {
      setMessages((currentMessages) => {
        const updated = [...currentMessages];
        const lastIndex = updated.length - 1;
        updated[lastIndex] = {
          ...updated[lastIndex],
          content: error instanceof Error ? error.message : "Something went wrong.",
        };
        return updated;
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="app-shell">
      <div className="chat-window">
        <header className="chat-header">
          <h1>Agenticia</h1>
        </header>

        <div className="message-list">
          {messages.map((message, index) => (
            <div key={`${message.role}-${index}`} className={`message-row ${message.role}`}>
              <div className="message-bubble">
                {message.content || (isLoading && index === messages.length - 1 ? "..." : "")}
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
          <button type="submit" disabled={isLoading || !input.trim()}>
            {isLoading ? "Thinking..." : "Send"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default App;
