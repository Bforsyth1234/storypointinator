import { graph, createInitialState } from "./src/ai/graph";
import { HumanMessage, AIMessage } from "@langchain/core/messages";

async function run() {
  const state = createInitialState();
  state.messages = [
    new AIMessage("Tell me about the feature you'd like to estimate. What should it do?"),
    new HumanMessage("add a todo list feature")
  ];
  state.active_files_context = "<active_files>\n<file path=\"test.ts\">\nconsole.log('test');\n</file>\n</active_files>";
  state.project_map = "Project Structure:\n- test.ts";

  try {
    const result = await graph.invoke(state);
    console.log("SUCCESS:", result);
  } catch (err: any) {
    console.error("ERROR:", err.message);
  }
}
run();
