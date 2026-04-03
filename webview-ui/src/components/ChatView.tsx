import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { postMessage } from "../utilities/vscode";

interface Message {
  role: "user" | "assistant";
  text: string;
}

interface QuestionAnswer {
  question: string;
  answer: string;
}

interface ChatViewProps {
  messages: Message[];
  isThinking?: boolean;
  streamingText?: string;
  pendingQuestions?: string[];
  answeredQuestions?: QuestionAnswer[];
}

function ChatView({ messages, isThinking, streamingText, pendingQuestions = [], answeredQuestions = [] }: ChatViewProps) {
  const [input, setInput] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [allAnswers, setAllAnswers] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const currentQuestionIndex = answeredQuestions.length;
  const hasQuestions = pendingQuestions.length > 0;
  const unansweredQuestions = pendingQuestions.slice(currentQuestionIndex);
  const allAnswered = hasQuestions && currentQuestionIndex >= pendingQuestions.length;
  const currentQuestion = hasQuestions && !allAnswered ? pendingQuestions[currentQuestionIndex] : null;

  // Reset allAnswers when new questions come in
  useEffect(() => {
    setAllAnswers(new Array(unansweredQuestions.length).fill(""));
  }, [pendingQuestions.length, currentQuestionIndex]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText, isThinking, currentQuestionIndex]);

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;

    if (currentQuestion) {
      postMessage({ type: "answerQuestion", questionIndex: currentQuestionIndex, answer: text });
    } else {
      postMessage({ type: "userMessage", text });
    }
    setInput("");
  };

  const handleSubmitAll = () => {
    const answers = unansweredQuestions.map((_q, i) => ({
      questionIndex: currentQuestionIndex + i,
      answer: allAnswers[i]?.trim() || "",
    }));
    if (answers.some(a => !a.answer)) return;
    postMessage({ type: "answerAllQuestions", answers });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`max-w-[85%] px-3 py-2 rounded-lg text-[13px] leading-[1.4] ${
              msg.role === "assistant"
                ? "self-start bg-[#2d2d2d] border border-[#404040]"
                : "self-end bg-[#264f78] text-white"
            }`}
          >
            <div
              className={`text-[10px] font-semibold mb-1 uppercase ${
                msg.role === "assistant" ? "text-[#888]" : "text-[#99c4e8]"
              }`}
            >
              {msg.role === "assistant" ? "Assistant" : "You"}
            </div>
            {msg.role === "assistant" ? (
              <div className="markdown-body">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
              </div>
            ) : (
              msg.text
            )}
          </div>
        ))}

        {/* Show answered questions */}
        {answeredQuestions.map((qa, i) => (
          <div key={`qa-${i}`} className="flex flex-col gap-2">
            <div className="self-start max-w-[85%] px-3 py-2 rounded-lg text-[13px] leading-[1.4] bg-[#2d2d2d] border border-[#404040]">
              <div className="text-[10px] font-semibold mb-1 uppercase text-[#888]">
                Question {i + 1} of {pendingQuestions.length}
              </div>
              {qa.question}
            </div>
            <div className="self-end max-w-[85%] px-3 py-2 rounded-lg text-[13px] leading-[1.4] bg-[#264f78] text-white">
              <div className="text-[10px] font-semibold mb-1 uppercase text-[#99c4e8]">You</div>
              {qa.answer}
            </div>
          </div>
        ))}

        {/* Show unanswered questions */}
        {!isThinking && hasQuestions && !allAnswered && (
          <>
            {/* Toggle between one-at-a-time and show-all */}
            {unansweredQuestions.length > 1 && (
              <button
                onClick={() => setShowAll(prev => !prev)}
                className="self-start text-[11px] text-[#007acc] hover:text-white cursor-pointer bg-transparent border-none px-1 py-0.5"
              >
                {showAll ? "Show one at a time" : `Show all ${unansweredQuestions.length} questions`}
              </button>
            )}

            {showAll ? (
              /* Show all unanswered questions with inline inputs */
              <div className="self-start w-full flex flex-col gap-2">
                {unansweredQuestions.map((q, i) => (
                  <div key={`uq-${i}`} className="px-3 py-2 rounded-lg text-[13px] leading-[1.4] bg-[#2d2d2d] border border-[#404040]">
                    <div className="text-[10px] font-semibold mb-1 uppercase text-[#007acc]">
                      Question {currentQuestionIndex + i + 1} of {pendingQuestions.length}
                    </div>
                    <div className="mb-2">{q}</div>
                    <input
                      type="text"
                      value={allAnswers[i] || ""}
                      onChange={(e) => {
                        const updated = [...allAnswers];
                        updated[i] = e.target.value;
                        setAllAnswers(updated);
                      }}
                      placeholder="Type your answer..."
                      className="w-full bg-[#1e1e1e] border border-[#404040] rounded px-2 py-1.5 text-[#cccccc] text-[12px] outline-none focus:border-[#007acc]"
                    />
                  </div>
                ))}
                <button
                  onClick={handleSubmitAll}
                  disabled={allAnswers.some(a => !a?.trim())}
                  className="self-start bg-[#007acc] text-white border-none rounded-md px-4 py-2 text-[13px] font-medium cursor-pointer hover:bg-[#005f99] disabled:opacity-50"
                >
                  Submit All Answers
                </button>
              </div>
            ) : (
              /* Show one question at a time */
              currentQuestion && (
                <div className="self-start max-w-[85%] px-3 py-2 rounded-lg text-[13px] leading-[1.4] bg-[#2d2d2d] border border-[#404040]">
                  <div className="text-[10px] font-semibold mb-1 uppercase text-[#007acc]">
                    Question {currentQuestionIndex + 1} of {pendingQuestions.length}
                  </div>
                  {currentQuestion}
                </div>
              )
            )}
          </>
        )}

        {isThinking && (
          <div className="self-start max-w-[85%] px-3 py-2 rounded-lg text-[13px] leading-[1.4] bg-[#2d2d2d] border border-[#404040]">
            <div className="text-[10px] font-semibold mb-1 uppercase text-[#888]">
              Assistant
            </div>
            {streamingText ? (
              <div className="markdown-body">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingText}</ReactMarkdown>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 h-5 text-[#888]">
                <div className="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-delay:0ms]"></div>
                <div className="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-delay:150ms]"></div>
                <div className="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-delay:300ms]"></div>
              </div>
            )}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Hide bottom input when in show-all mode (inputs are inline) */}
      {!(showAll && hasQuestions && !allAnswered) && (
        <div className="px-4 py-3 border-t border-[#333] flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={currentQuestion ? "Type your answer..." : "Describe your feature..."}
            className="flex-1 bg-[#2d2d2d] border border-[#404040] rounded-md px-3 py-2 text-[#cccccc] text-[13px] outline-none focus:border-[#007acc]"
            disabled={isThinking || (hasQuestions && allAnswered)}
          />
          <button
            onClick={handleSend}
            disabled={isThinking || (hasQuestions && allAnswered)}
            className="bg-[#007acc] text-white border-none rounded-md px-4 py-2 text-[13px] font-medium cursor-pointer hover:bg-[#005f99] disabled:opacity-50"
          >
            Send
          </button>
        </div>
      )}
    </div>
  );
}



export default ChatView;
