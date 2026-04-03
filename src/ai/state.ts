import { BaseMessage } from "@langchain/core/messages";
import { Annotation } from "@langchain/langgraph";

export interface FinalTicket {
  title: string;
  criteria: string[];
  scores: Record<string, number>;
  storyPoints: number;
  aiPrompt: string;
}

export interface QuestionAnswer {
  question: string;
  answer: string;
}

export const GraphAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (current, update) =>
      Array.isArray(update) ? [...current, ...update] : [...current, update],
    default: () => [],
  }),
  is_defined: Annotation<boolean>({
    reducer: (_current, update) => update,
    default: () => false,
  }),
  final_ticket: Annotation<FinalTicket | null>({
    reducer: (_current, update) => update,
    default: () => null,
  }),
  active_files_context: Annotation<string>({
    reducer: (_current, update) => update,
    default: () => "",
  }),
  project_map: Annotation<string>({
    reducer: (_current, update) => update,
    default: () => "",
  }),
  pending_questions: Annotation<string[]>({
    reducer: (_current, update) => update,
    default: () => [],
  }),
  answered_questions: Annotation<QuestionAnswer[]>({
    reducer: (_current, update) => update,
    default: () => [],
  }),
});

export type GraphState = typeof GraphAnnotation.State;

export function createInitialState(
  activeFilesContext: string = "",
  projectMap: string = ""
): GraphState {
  return {
    messages: [],
    is_defined: false,
    final_ticket: null,
    active_files_context: activeFilesContext,
    project_map: projectMap,
    pending_questions: [],
    answered_questions: [],
  };
}
