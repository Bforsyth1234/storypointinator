import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { postMessage } from "../utilities/vscode";

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

interface TicketViewProps {
  ticket: FinalTicket;
  messages?: Message[];
  hideContinueButton?: boolean;
}

function TicketView({ ticket, messages = [], hideContinueButton = false }: TicketViewProps) {
  const [copied, setCopied] = useState(false);
  const [promptCopied, setPromptCopied] = useState(false);

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(ticket.aiPrompt);
    setPromptCopied(true);
    setTimeout(() => setPromptCopied(false), 2000);
  };

  const handleReset = () => {
    postMessage({ type: "newSession" });
  };

  const handleContinue = () => {
    postMessage({ type: "continueConversation" });
  };

  // Filter out the final "Here's your estimate!" assistant message — it's redundant next to the ticket
  const historyMessages = messages.filter(
    m => !(m.role === "assistant" && m.text.toLowerCase().includes("here's your estimate"))
  );

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">

      {/* Conversation history */}
      {historyMessages.length > 0 && (
        <div className="px-4 pt-3 pb-2 flex flex-col gap-2 border-b border-[#333]">
          <div className="text-[10px] uppercase text-[#555] font-semibold mb-1">Conversation</div>
          {historyMessages.map((msg, i) => (
            <div
              key={i}
              className={`max-w-[85%] px-3 py-2 rounded-lg text-[13px] leading-[1.4] ${
                msg.role === "assistant"
                  ? "self-start bg-[#2d2d2d] border border-[#404040]"
                  : "self-end bg-[#264f78] text-white"
              }`}
            >
              <div className={`text-[10px] font-semibold mb-1 uppercase ${msg.role === "assistant" ? "text-[#888]" : "text-[#99c4e8]"}`}>
                {msg.role === "assistant" ? "Assistant" : "You"}
              </div>
              {msg.role === "assistant" ? (
                <div className="markdown-body"><ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown></div>
              ) : (
                <span className="whitespace-pre-wrap">{msg.text}</span>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="p-4">

      {/* Title Card */}
      <div className="bg-[#2d2d2d] border border-[#404040] rounded-lg p-4 mb-3">
        <div className="text-[11px] text-[#888] uppercase font-semibold mb-2">
          Title
        </div>
        <h2 className="text-[15px] text-white font-semibold">{ticket.title}</h2>
      </div>

      {/* Criteria Card */}
      <div className="bg-[#2d2d2d] border border-[#404040] rounded-lg p-4 mb-3">
        <div className="flex justify-between items-center mb-2">
          <div className="text-[11px] text-[#888] uppercase font-semibold">
            BDD Acceptance Criteria
          </div>
          <button
            onClick={() => {
              const text = ticket.criteria.join("\n");
              navigator.clipboard.writeText(text);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="text-[11px] text-[#888] hover:text-white bg-transparent border border-[#555] hover:border-[#007acc] rounded px-2 py-0.5 cursor-pointer transition-colors"
          >
            {copied ? "✓ Copied" : "Copy"}
          </button>
        </div>
        <ul className="list-none p-0">
          {ticket.criteria.map((criterion, i) => (
            <li
              key={i}
              className="py-1.5 border-b border-[#3a3a3a] last:border-b-0 text-[13px] leading-[1.4]"
            >
              <span className="text-[#4ec9b0] font-bold mr-1">&#10003;</span>
              {criterion}
            </li>
          ))}
        </ul>
      </div>

      {/* Scores Card */}
      <div className="bg-[#2d2d2d] border border-[#404040] rounded-lg p-4 mb-3">
        <div className="text-[11px] text-[#888] uppercase font-semibold mb-2">
          Complexity Scores
        </div>
        <table className="w-full border-collapse mt-1">
          <thead>
            <tr>
              <th className="py-1.5 px-2 text-[12px] text-left text-[#888] font-semibold uppercase border-b border-[#3a3a3a]">
                Dimension
              </th>
              <th className="py-1.5 px-2 text-[12px] text-left text-[#888] font-semibold uppercase border-b border-[#3a3a3a]">
                Score
              </th>
              <th className="py-1.5 px-2 text-[12px] text-left text-[#888] font-semibold uppercase border-b border-[#3a3a3a]"></th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(ticket.scores).map(([dimension, score]) => (
              <tr key={dimension}>
                <td className="py-1.5 px-2 text-[12px] border-b border-[#333] capitalize">
                  {dimension}
                </td>
                <td className="py-1.5 px-2 text-[12px] border-b border-[#333]">
                  {score} / 10
                </td>
                <td className="py-1.5 px-2 border-b border-[#333]">
                  <div className="h-1.5 rounded-full bg-[#333] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#007acc]"
                      style={{ width: `${(score / 10) * 100}%` }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Total Points */}
      <div className="bg-[#1a3a52] rounded-md px-4 py-3 flex justify-between items-center mt-3">
        <span className="text-[13px] font-semibold">
          Estimated Story Points
        </span>
        <span className="text-[22px] font-bold text-[#4ec9b0]">
          {ticket.storyPoints}
        </span>
      </div>

      {/* Action Buttons */}
      {!hideContinueButton && (
        <div className="flex flex-col gap-2 mt-4">
          <button
            onClick={handleCopyPrompt}
            className="block w-full bg-[#007acc] text-white border-none rounded-md py-2 text-[12px] cursor-pointer text-center hover:bg-[#005f99] transition-colors font-medium"
          >
            {promptCopied ? "✓ Copied to Clipboard" : "📋 Copy AI Prompt"}
          </button>
          <button
            onClick={handleContinue}
            className="block w-full bg-transparent border border-[#007acc] text-[#007acc] rounded-md py-2 text-[12px] cursor-pointer text-center hover:bg-[#007acc] hover:text-white transition-colors"
          >
            &#128172; Continue Conversation
          </button>
          <button
            onClick={handleReset}
            className="block w-full bg-transparent border border-[#555] text-[#aaa] rounded-md py-2 text-[12px] cursor-pointer text-center hover:border-[#555] hover:text-[#ccc]"
          >
            &#8635; Start New Estimate
          </button>
        </div>
      )}
    </div>
    </div>
  );
}

export default TicketView;
