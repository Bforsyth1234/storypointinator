import { useState, useEffect, useCallback } from "react";
import { useVSCodeMessage, postMessage } from "./utilities/vscode";
import ChatView from "./components/ChatView";
import TicketView from "./components/TicketView";

interface Message {
  role: "user" | "assistant";
  text: string;
}

interface FinalTicket {
  title: string;
  criteria: string[];
  scores: Record<string, number>;
  storyPoints: number;
  aiPrompt: string;
}

interface QuestionAnswer {
  question: string;
  answer: string;
}

interface SessionMeta {
  id: string;
  name: string;
}

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isDefined, setIsDefined] = useState(false);
  const [finalTicket, setFinalTicket] = useState<FinalTicket | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [activeSessionId, setActiveSessionId] = useState("");
  const [pendingQuestions, setPendingQuestions] = useState<string[]>([]);
  const [answeredQuestions, setAnsweredQuestions] = useState<QuestionAnswer[]>([]);

  const handleMessage = useCallback((event: MessageEvent) => {
    const msg = event.data;
    if (msg.type === "stateUpdate") {
      setMessages(msg.messages ?? []);
      setIsDefined(msg.is_defined ?? false);
      setFinalTicket(msg.final_ticket ?? null);
      setIsThinking(msg.isThinking ?? false);
      setStreamingText(msg.streamingText ?? "");
      setSessions(msg.sessions ?? []);
      setActiveSessionId(msg.activeSessionId ?? "");
      setPendingQuestions(msg.pendingQuestions ?? []);
      setAnsweredQuestions(msg.answeredQuestions ?? []);
    }
  }, []);

  useEffect(() => {
    const cleanup = useVSCodeMessage(handleMessage);
    // Ask the backend for the current state once mounted
    postMessage({ type: "ready" });
    return cleanup;
  }, [handleMessage]);

  const handleNewSession = () => postMessage({ type: "newSession" });
  const handleSwitchSession = (id: string) => postMessage({ type: "switchSession", id });
  const handleDeleteSession = (id: string) => postMessage({ type: "deleteSession", id });

  const sessionBar = (
    <div className="flex items-center gap-1 px-2 py-1.5 border-b border-[#333] overflow-x-auto shrink-0">
      {sessions.map(s => (
        <div
          key={s.id}
          className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] cursor-pointer shrink-0 max-w-[120px] group ${
            s.id === activeSessionId
              ? "bg-[#264f78] text-white"
              : "bg-[#2d2d2d] text-[#aaa] hover:bg-[#3a3a3a]"
          }`}
          onClick={() => handleSwitchSession(s.id)}
          title={s.name}
        >
          <span className="truncate">{s.name}</span>
          <button
            onClick={e => { e.stopPropagation(); handleDeleteSession(s.id); }}
            className="opacity-0 group-hover:opacity-100 ml-0.5 text-[#888] hover:text-[#ff6b6b] leading-none shrink-0"
            title="Delete"
          >✕</button>
        </div>
      ))}
      <button
        onClick={handleNewSession}
        className="shrink-0 px-2 py-0.5 rounded text-[11px] bg-transparent border border-[#444] text-[#888] hover:text-white hover:border-[#007acc] cursor-pointer"
        title="New Conversation"
      >＋</button>
    </div>
  );

  // Estimate is finalized — show ticket only
  if (isDefined && finalTicket) {
    return (
      <div className="flex flex-col h-screen">
        {sessionBar}
        <TicketView ticket={finalTicket} messages={messages} />
      </div>
    );
  }

  // Continuing conversation after an estimate — show ticket + chat
  if (!isDefined && finalTicket) {
    return (
      <div className="flex flex-col h-screen">
        {sessionBar}
        <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">
          <TicketView ticket={finalTicket} messages={[]} hideContinueButton />
          <div className="border-t border-[#333]">
            <ChatView
              messages={messages}
              isThinking={isThinking}
              streamingText={streamingText}
              pendingQuestions={pendingQuestions}
              answeredQuestions={answeredQuestions}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      {sessionBar}
      <ChatView
        messages={messages}
        isThinking={isThinking}
        streamingText={streamingText}
        pendingQuestions={pendingQuestions}
        answeredQuestions={answeredQuestions}
      />
    </div>
  );
}

export default App;
