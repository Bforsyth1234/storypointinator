import { StateGraph } from "@langchain/langgraph";
import { GraphAnnotation, createInitialState } from "./state";
import type { GraphState } from "./state";
import { createAskNode, estimateNode } from "./nodes";
import { readFileTool, searchWorkspaceTool } from "./tools";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import type { StructuredToolInterface } from "@langchain/core/tools";

function routeAfterAsk(state: typeof GraphAnnotation.State): string {
  const lastMessage = state.messages[state.messages.length - 1];

  if (lastMessage && "tool_calls" in lastMessage && Array.isArray(lastMessage.tool_calls) && lastMessage.tool_calls.length > 0) {
    return "tools";
  }

  return state.is_defined ? "estimate" : "__end__";
}

export function buildGraph(mcpTools: StructuredToolInterface[] = []) {
  const allTools = [readFileTool, searchWorkspaceTool, ...mcpTools];
  const toolsNode = new ToolNode(allTools as any);
  const askNode = createAskNode(allTools);

  const graphBuilder = new StateGraph(GraphAnnotation)
    .addNode("ask", askNode)
    .addNode("tools", toolsNode)
    .addNode("estimate", estimateNode)
    .addEdge("__start__", "ask")
    .addConditionalEdges("ask", routeAfterAsk, {
      tools: "tools",
      estimate: "estimate",
      __end__: "__end__",
    })
    .addEdge("tools", "ask")
    .addEdge("estimate", "__end__");

  return graphBuilder.compile();
}

export { createInitialState };
export type { GraphState };
