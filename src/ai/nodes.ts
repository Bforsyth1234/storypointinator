import type { GraphState } from "./state";
import type { FinalTicket } from "./state";
import { ChatAnthropic } from "@langchain/anthropic";
import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { StructuredToolInterface } from "@langchain/core/tools";
import * as vscode from "vscode";
import { z } from "zod";

const ticketSchema = z.object({
  title: z.string().describe("A concise title for the feature request"),
  criteria: z.array(z.string()).describe("BDD acceptance criteria for the feature (e.g., Given..., When..., Then...)"),
  scores: z.record(z.string(), z.number()).describe("Complexity scores (1-10) for different dimensions like frontend, backend, testing, etc."),
  storyPoints: z.number().describe("The final story point estimation (e.g., Fibonacci sequence like 1, 2, 3, 5, 8, 13)"),
  aiPrompt: z.string().describe("A detailed, self-contained prompt for an AI coding assistant to implement this feature. Include the task description, specific files to modify, acceptance criteria, technical approach, edge cases, and any relevant context from the codebase. Write it as if you are instructing a developer who has access to the codebase but no prior context about this ticket."),
});

const askSchema = z.object({
  questions: z.array(z.string()).describe("Clarifying questions to ask the user. Return an empty array if you have enough info."),
  readyToEstimate: z.boolean().describe("True if you have enough information to produce an estimate, false if you need more clarification."),
});

function getLlm() {
  const config = vscode.workspace.getConfiguration("storypointinator");
  const apiKey = config.get<string>("anthropicApiKey");
  const model = config.get<string>("model") || "claude-sonnet-4-6";

  if (!apiKey) {
    vscode.window.showErrorMessage(
      "Storypointinator: Anthropic API Key is missing. Please set it in the VS Code settings (storypointinator.anthropicApiKey)."
    );
  }

  return new ChatAnthropic({
    model,
    temperature: 0,
    apiKey: apiKey || "missing-key",
  });
}

export function createAskNode(allTools: StructuredToolInterface[]) {
  return async function askNode(state: GraphState, config?: any) {
  const systemPrompt = `You are an AI Technical Product Manager. You have the user's currently open files in your prompt. Assume these are the primary files involved in the ticket. You also have a map of the entire directory. If you need to inspect a file from the directory to accurately estimate tech debt or architectural scope, you MUST use the read_file or search_workspace tools before proceeding. If the code looks messy, increase your point estimate.

Active Files Context:
${state.active_files_context}

Project Map:
${state.project_map}

Your job is to clarify the feature request and determine if you have enough information to estimate it.
Return a list of clarifying questions you need answered. The user will answer them one at a time.
If you already have enough information to estimate, return an empty questions array and set readyToEstimate to true.`;

  // Build context from previous Q&A rounds
  let chatMessages = [...state.messages];

  // If we have answered questions from previous rounds, add them as context
  if (state.answered_questions.length > 0) {
    const qaText = state.answered_questions
      .map(qa => `Q: ${qa.question}\nA: ${qa.answer}`)
      .join("\n\n");
    chatMessages = [
      ...chatMessages,
      new HumanMessage(`Here are my answers to your previous questions:\n\n${qaText}`),
    ];
  }

  // Anthropic requires the conversation to start with a human message
  if (chatMessages.length > 0 && chatMessages[0] instanceof AIMessage) {
    chatMessages = [new HumanMessage("I need to estimate a feature."), ...chatMessages];
  }

  // Anthropic forbids the conversation ending with an AI message (no prefill)
  const lastMsg = chatMessages[chatMessages.length - 1];
  if (lastMsg instanceof AIMessage) {
    chatMessages = [...chatMessages, new HumanMessage("Please continue.")];
  }

  // First, let the LLM use tools if needed
  const toolLlm = getLlm().bindTools(allTools);
  const messagesForTools = [
    new SystemMessage(systemPrompt),
    ...chatMessages,
  ];
  const toolResponse = await toolLlm.invoke(messagesForTools, config);

  // If the LLM wants to call tools, let it
  if (toolResponse.tool_calls && toolResponse.tool_calls.length > 0) {
    return {
      messages: [toolResponse],
      is_defined: false,
    };
  }

  // Now get structured questions
  const structuredLlm = getLlm().withStructuredOutput(askSchema, {
    name: "clarify_questions",
  });

  const messagesForLLM = [
    new SystemMessage(systemPrompt),
    ...chatMessages,
  ];

  const result = await structuredLlm.invoke(messagesForLLM, config);

  return {
    messages: [new AIMessage(
      result.readyToEstimate
        ? "I'm ready to estimate based on the information provided."
        : `I have ${result.questions.length} question${result.questions.length === 1 ? "" : "s"} to clarify before estimating.`
    )],
    is_defined: result.readyToEstimate,
    pending_questions: result.questions,
    answered_questions: [],
  };
  };
}

export async function estimateNode(state: GraphState, config?: any) {
  const systemPrompt = `You are an AI Technical Product Manager. Based on the conversation history, analyze the user's feature request and generate a structured estimation ticket. Include a concise title, BDD acceptance criteria, complexity scores across different dimensions (e.g., frontend, backend, testing), and a final story point estimation (Fibonacci: 1, 2, 3, 5, 8, 13).

Active Files Context:
${state.active_files_context}

Project Map:
${state.project_map}`;

  let chatMessages = state.messages;

  // Anthropic requires the conversation to start with a human message
  if (chatMessages.length > 0 && chatMessages[0] instanceof AIMessage) {
    chatMessages = [new HumanMessage("I need to estimate a feature."), ...chatMessages];
  }

  // Anthropic forbids the conversation ending with an AI message (no prefill)
  const lastMsg = chatMessages[chatMessages.length - 1];
  if (lastMsg instanceof AIMessage) {
    chatMessages = [...chatMessages, new HumanMessage("Now generate the structured ticket estimate based on our conversation.")];
  }

  const messagesForLLM = [
    new SystemMessage(systemPrompt),
    ...chatMessages,
  ];

  const structuredLlm = getLlm().withStructuredOutput(ticketSchema, {
    name: "generate_ticket",
  });

  const result = await structuredLlm.invoke(messagesForLLM, config);

  const finalTicket: FinalTicket = {
    title: result.title,
    criteria: result.criteria,
    scores: result.scores,
    storyPoints: result.storyPoints,
    aiPrompt: result.aiPrompt,
  };

  return {
    messages: [
      new AIMessage("I've gathered enough information. Here's your estimate!"),
    ],
    is_defined: true,
    final_ticket: finalTicket,
  };
}
