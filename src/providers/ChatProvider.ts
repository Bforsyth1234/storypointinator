import * as vscode from "vscode";
import { buildGraph, createInitialState } from "../ai/graph";
import type { GraphState } from "../ai/graph";
import { ContextService } from "../services/ContextService";
import { McpService } from "../services/McpService";
import { HumanMessage, AIMessage } from "@langchain/core/messages";

interface Session {
  id: string;
  name: string;
  state: GraphState;
}

function makeId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export class ChatProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private _sessions: Session[] = [];
  private _activeSessionId: string = "";
  private _mcpService = new McpService();
  private _graph = buildGraph();

  constructor(private readonly _extensionUri: vscode.Uri) {
    this._createSession();
    this._initMcp();
  }

  private async _initMcp() {
    await this._mcpService.connectAll();
    if (this._mcpService.serverCount > 0) {
      const mcpTools = await this._mcpService.getLangChainTools();
      this._graph = buildGraph(mcpTools);
      console.log(`MCP: ${this._mcpService.serverCount} server(s) connected, ${mcpTools.length} tool(s) available`);
    }
  }

  async dispose() {
    await this._mcpService.disconnectAll();
  }

  private _createSession(): Session {
    const id = makeId();
    const session: Session = { id, name: "New Estimate", state: createInitialState() };
    this._sessions.push(session);
    this._activeSessionId = id;
    return session;
  }

  private get _activeSession(): Session {
    return this._sessions.find(s => s.id === this._activeSessionId) ?? this._sessions[0];
  }

  private _getSession(id: string): Session | undefined {
    return this._sessions.find(s => s.id === id);
  }

  private get _state(): GraphState {
    return this._activeSession.state;
  }

  private set _state(value: GraphState) {
    this._activeSession.state = value;
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message.type) {
        case "ready": {
          this._postStateUpdate();
          break;
        }
        case "userMessage": {
          // Pin the session ID so async work writes back to the correct session
          const targetSessionId = this._activeSessionId;
          const targetSession = this._getSession(targetSessionId);
          if (!targetSession) break;

          if (!targetSession.state.active_files_context) {
            const activeFiles = ContextService.getActiveFiles();
            const projectMap = await ContextService.getProjectMap();
            targetSession.state = {
              ...targetSession.state,
              active_files_context: activeFiles,
              project_map: projectMap,
            };
          }

          targetSession.state = {
            ...targetSession.state,
            messages: [
              ...targetSession.state.messages,
              new HumanMessage(message.text),
            ],
          };

          // Auto-name the session from the first user message
          if (targetSession.name === "New Estimate") {
            const name = message.text.length > 28
              ? message.text.slice(0, 28) + "…"
              : message.text;
            targetSession.name = name;
          }

          // Update UI immediately so the user's message doesn't disappear while loading
          this._postStateUpdate(true, "");

          try {
            let streamingText = "";
            let isToolCall = false;
            const result = await this._graph.invoke(targetSession.state, {
              callbacks: [
                {
                  handleLLMNewToken: (token: string) => {
                    if (!isToolCall) {
                      streamingText += token;
                      if (this._activeSessionId === targetSessionId) {
                        this._postStateUpdate(true, streamingText);
                      }
                    }
                  },
                  handleToolStart: () => {
                    isToolCall = true;
                  },
                  handleToolEnd: () => {
                    isToolCall = false;
                    streamingText = "";
                  },
                  handleLLMStart: () => {
                    // Reset streaming text on each new LLM call
                    // (after tool results come back, a new LLM call starts)
                    streamingText = "";
                    isToolCall = false;
                  }
                }
              ]
            });
            targetSession.state = result;
          } catch (err: any) {
            console.error("Graph invocation error:", err);
            vscode.window.showErrorMessage("Storypointinator Error: " + (err.message || String(err)));
          }

          // Only push final update if this session is still being viewed
          if (this._activeSessionId === targetSessionId) {
            this._postStateUpdate(false, "");
          }
          break;
        }
        case "answerAllQuestions": {
          const allSessionId = this._activeSessionId;
          const allSession = this._getSession(allSessionId);
          if (!allSession) break;

          const pending = allSession.state.pending_questions;
          const answered = [...allSession.state.answered_questions];
          for (const { questionIndex, answer } of message.answers) {
            answered.push({ question: pending[questionIndex], answer });
          }
          allSession.state = {
            ...allSession.state,
            answered_questions: answered,
          };

          // All answered — re-invoke the graph
          this._postStateUpdate(true, "");

          try {
            let streamingText = "";
            let isToolCall = false;
            const result = await this._graph.invoke(allSession.state, {
              callbacks: [
                {
                  handleLLMNewToken: (token: string) => {
                    if (!isToolCall) {
                      streamingText += token;
                      if (this._activeSessionId === allSessionId) {
                        this._postStateUpdate(true, streamingText);
                      }
                    }
                  },
                  handleToolStart: () => { isToolCall = true; },
                  handleToolEnd: () => { isToolCall = false; streamingText = ""; },
                  handleLLMStart: () => { streamingText = ""; isToolCall = false; }
                }
              ]
            });
            allSession.state = result;
          } catch (err: any) {
            console.error("Graph invocation error:", err);
            vscode.window.showErrorMessage("Storypointinator Error: " + (err.message || String(err)));
          }

          if (this._activeSessionId === allSessionId) {
            this._postStateUpdate(false, "");
          }
          break;
        }
        case "answerQuestion": {
          const answerSessionId = this._activeSessionId;
          const answerSession = this._getSession(answerSessionId);
          if (!answerSession) break;

          const { questionIndex, answer } = message;
          const pending = answerSession.state.pending_questions;
          const answered = [...answerSession.state.answered_questions];

          // Store this answer
          answered.push({ question: pending[questionIndex], answer });
          answerSession.state = {
            ...answerSession.state,
            answered_questions: answered,
          };

          // If there are more questions, just update UI to show the next one
          if (answered.length < pending.length) {
            this._postStateUpdate();
            break;
          }

          // All questions answered — re-invoke the graph
          this._postStateUpdate(true, "");

          try {
            let streamingText = "";
            let isToolCall = false;
            const result = await this._graph.invoke(answerSession.state, {
              callbacks: [
                {
                  handleLLMNewToken: (token: string) => {
                    if (!isToolCall) {
                      streamingText += token;
                      if (this._activeSessionId === answerSessionId) {
                        this._postStateUpdate(true, streamingText);
                      }
                    }
                  },
                  handleToolStart: () => { isToolCall = true; },
                  handleToolEnd: () => { isToolCall = false; streamingText = ""; },
                  handleLLMStart: () => { streamingText = ""; isToolCall = false; }
                }
              ]
            });
            answerSession.state = result;
          } catch (err: any) {
            console.error("Graph invocation error:", err);
            vscode.window.showErrorMessage("Storypointinator Error: " + (err.message || String(err)));
          }

          if (this._activeSessionId === answerSessionId) {
            this._postStateUpdate(false, "");
          }
          break;
        }
        case "continueConversation": {
          // Reset the estimate flags so the graph re-enters ask mode,
          // but preserve all messages and the ticket so the user can keep chatting.
          this._state = {
            ...this._state,
            is_defined: false,
            pending_questions: [],
            answered_questions: [],
          };
          this._postStateUpdate();
          break;
        }
        case "newSession": {
          this._createSession();
          this._sendInitialGreeting();
          break;
        }
        case "switchSession": {
          const target = this._sessions.find(s => s.id === message.id);
          if (target) {
            this._activeSessionId = message.id;
            this._postStateUpdate();
          }
          break;
        }
        case "deleteSession": {
          if (this._sessions.length === 1) {
            // Last session — just reset it instead of deleting
            this._state = createInitialState();
            this._activeSession.name = "New Estimate";
            this._sendInitialGreeting();
            break;
          }
          const idx = this._sessions.findIndex(s => s.id === message.id);
          this._sessions.splice(idx, 1);
          if (this._activeSessionId === message.id) {
            this._activeSessionId = this._sessions[Math.max(0, idx - 1)].id;
          }
          this._postStateUpdate();
          break;
        }
      }
    });

    // Send initial greeting
    this._sendInitialGreeting();
  }

  private async _sendInitialGreeting() {
    this._state = {
      ...this._state,
      messages: [
        new AIMessage("Tell me about the feature you'd like to estimate. What should it do?"),
      ],
    };
    this._postStateUpdate();
  }

  private _postStateUpdate(isThinking = false, streamingText = "") {
    if (this._view) {
      const displayMessages: any[] = [];

      for (const m of this._state.messages) {
        const isHuman = m instanceof HumanMessage ||
                        m.constructor.name === "HumanMessage" ||
                        (typeof (m as any)._getType === 'function' && (m as any)._getType() === 'human') ||
                        (typeof (m as any).getType === 'function' && (m as any).getType() === 'human');

        const isAi = m instanceof AIMessage ||
                     m.constructor.name === "AIMessage" ||
                     (typeof (m as any)._getType === 'function' && (m as any)._getType() === 'ai') ||
                     (typeof (m as any).getType === 'function' && (m as any).getType() === 'ai');

        if (!isHuman && !isAi) {
          continue; // Skip SystemMessage, ToolMessage, etc.
        }

        let text = "";
        if (typeof m.content === "string") {
          text = m.content;
        } else if (Array.isArray(m.content)) {
          text = m.content
            .filter((c: any) => c.type === "text")
            .map((c: any) => c.text)
            .join("\n");
        } else {
          text = JSON.stringify(m.content);
        }

        if (text.trim()) {
          displayMessages.push({
            role: isHuman ? "user" : "assistant",
            text
          });
        }
      }

      this._view.webview.postMessage({
        type: "stateUpdate",
        messages: displayMessages,
        is_defined: this._state.is_defined,
        final_ticket: this._state.final_ticket,
        isThinking,
        streamingText,
        sessions: this._sessions.map(s => ({ id: s.id, name: s.name })),
        activeSessionId: this._activeSessionId,
        pendingQuestions: this._state.pending_questions,
        answeredQuestions: this._state.answered_questions,
      });
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const distPath = vscode.Uri.joinPath(
      this._extensionUri,
      "webview-ui",
      "dist",
      "assets"
    );

    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(distPath, "index.js")
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(distPath, "index.css")
    );

    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <link rel="stylesheet" href="${styleUri}">
    <title>Storypointinator</title>
</head>
<body>
    <div id="root"></div>
    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function getNonce(): string {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
