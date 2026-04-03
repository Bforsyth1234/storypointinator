interface VsCodeApi {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

let api: VsCodeApi | undefined;

function getVsCodeApi(): VsCodeApi {
  if (!api) {
    try {
      api = acquireVsCodeApi();
    } catch {
      // Fallback for dev mode outside VS Code
      api = {
        postMessage: (msg) => console.log("[vscode mock] postMessage:", msg),
        getState: () => undefined,
        setState: () => {},
      };
    }
  }
  return api;
}

export function postMessage(message: unknown): void {
  getVsCodeApi().postMessage(message);
}

export function useVSCodeMessage(
  handler: (event: MessageEvent) => void
): () => void {
  const listener = (event: MessageEvent) => {
    handler(event);
  };
  window.addEventListener("message", listener);
  return () => window.removeEventListener("message", listener);
}
