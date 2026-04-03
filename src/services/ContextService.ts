import * as vscode from 'vscode';

export class ContextService {
  /**
   * Gets all currently opened files by the developer, filters out non-file schemes,
   * and returns a formatted XML-like string containing the file paths and contents.
   * Limits total output to roughly 3000 lines.
   */
  public static getActiveFiles(): string {
    const MAX_TOTAL_LINES = 3000;
    let totalLines = 0;
    const activeDocs = vscode.workspace.textDocuments.filter(doc => doc.uri.scheme === 'file');
    
    let result = '';

    for (const doc of activeDocs) {
      const relativePath = vscode.workspace.asRelativePath(doc.uri);
      const text = doc.getText();
      const lineCount = text.split('\n').length;

      if (totalLines + lineCount > MAX_TOTAL_LINES) {
        result += `\n<file path="${relativePath}">\n...[Content truncated due to length limits]...\n</file>\n`;
        // We still add it to the map but don't output full text to save tokens
        continue;
      }

      result += `\n<file path="${relativePath}">\n${text}\n</file>\n`;
      totalLines += lineCount;
    }

    return result.trim() ? `<active_files>\n${result}\n</active_files>` : '<active_files>No files currently open.</active_files>';
  }

  /**
   * Retrieves all files in the workspace (ignoring common directories like node_modules, dist, etc.)
   * and formats them into a Markdown-friendly directory tree string.
   */
  public static async getProjectMap(): Promise<string> {
    const excludePattern = '{**/node_modules/**,**/dist/**,**/.git/**,**/out/**,**/.next/**,**/webview-ui/dist/**}';
    const files = await vscode.workspace.findFiles('**/*.*', excludePattern);
    
    if (files.length === 0) {
      return "No files found in project.";
    }

    const paths = files.map(file => vscode.workspace.asRelativePath(file)).sort();
    
    // Build a simple tree representation
    return "Project Structure:\n" + paths.map(p => `- ${p}`).join('\n');
  }
}
