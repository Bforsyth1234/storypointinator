import * as vscode from "vscode";
import { ChatProvider } from "./providers/ChatProvider";

let chatProvider: ChatProvider;

export function activate(context: vscode.ExtensionContext) {
  chatProvider = new ChatProvider(context.extensionUri);

  const disposable = vscode.window.registerWebviewViewProvider(
    "storypointinator.chatView",
    chatProvider
  );

  context.subscriptions.push(disposable);
}

export function deactivate() {
  chatProvider?.dispose();
}
