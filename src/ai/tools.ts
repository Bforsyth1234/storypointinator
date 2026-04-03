import { tool } from "@langchain/core/tools";
import { z } from "zod";
import * as vscode from "vscode";

export const readFileTool = tool(
  async ({ filePath }) => {
    try {
      if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
        return "Error: No workspace folder opened.";
      }
      const workspaceFolder = vscode.workspace.workspaceFolders[0].uri;
      const fileUri = vscode.Uri.joinPath(workspaceFolder, filePath);
      
      const fileData = await vscode.workspace.fs.readFile(fileUri);
      return new TextDecoder().decode(fileData);
    } catch (e: any) {
      return `Error reading file ${filePath}: ${e.message}`;
    }
  },
  {
    name: "read_file",
    description: "Read the contents of a file in the workspace.",
    schema: z.object({
      filePath: z.string().describe("The relative path to the file to read"),
    }),
  }
);

export const searchWorkspaceTool = tool(
  async ({ query }) => {
    try {
      // First try to use the workspace symbol provider for better precision
      const symbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
        "vscode.executeWorkspaceSymbolProvider",
        query
      );

      if (symbols && symbols.length > 0) {
        const results = symbols.slice(0, 15).map(sym => {
          const relativePath = vscode.workspace.asRelativePath(sym.location.uri);
          return `- ${sym.name} in ${relativePath}`;
        });
        return `Found symbols:\n${results.join("\n")}`;
      }

      // Fallback: simple text search using findFiles (glob matching)
      const files = await vscode.workspace.findFiles(
        `**/*${query}*`,
        '{**/node_modules/**,**/dist/**,**/.git/**,**/out/**}'
      );
      
      if (files && files.length > 0) {
        const results = files.slice(0, 15).map(f => `- ${vscode.workspace.asRelativePath(f)}`);
        return `Found matching files:\n${results.join("\n")}`;
      }

      return `No results found for query: ${query}`;
    } catch (e: any) {
      return `Error searching workspace: ${e.message}`;
    }
  },
  {
    name: "search_workspace",
    description: "Search the workspace for files or symbols matching a query.",
    schema: z.object({
      query: z.string().describe("The search query or symbol name to look for"),
    }),
  }
);
