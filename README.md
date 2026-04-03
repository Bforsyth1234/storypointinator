# Storypointinator

AI-powered story point estimation in your VS Code sidebar. Describe a feature, answer a few clarifying questions, and get a detailed ticket with BDD acceptance criteria, complexity scores, and a story point estimate — all without leaving your editor.

## Features

- **Conversational estimation** — Describe a feature in plain English. The AI asks clarifying questions one at a time (or all at once) to understand scope before estimating.
- **Codebase-aware** — Automatically reads your open files and project structure. The AI can inspect additional files and search your workspace to assess technical complexity.
- **Structured tickets** — Generates a full ticket with title, BDD acceptance criteria, per-dimension complexity scores, and a Fibonacci story point estimate.
- **AI coding prompt** — One-click copy of a detailed implementation prompt you can feed directly to an AI coding assistant.
- **MCP server support** — Connect external tools (Jira, GitHub, Slack, etc.) via the [Model Context Protocol](https://modelcontextprotocol.io) for richer context during estimation.
- **Multiple sessions** — Run several estimation sessions side by side and switch between them.
- **Configurable model** — Choose between Claude Sonnet 4.6, Opus 4.6, Haiku 4.5, and older 4.5 models.

## Getting Started

### Prerequisites

- VS Code 1.85+
- An [Anthropic API key](https://console.anthropic.com/)

### Installation

1. Clone and build:
   ```bash
   git clone <repo-url>
   cd storypointinator
   npm install
   cd webview-ui && npm install && cd ..
   npm run build
   ```
2. Press `F5` in VS Code to launch the Extension Development Host.
3. Open the **Storypointinator** panel from the activity bar (target icon).

### Configuration

Open **Settings** → search `storypointinator`:

| Setting | Description | Default |
|---|---|---|
| `storypointinator.anthropicApiKey` | Your Anthropic API key | `""` |
| `storypointinator.model` | Which Claude model to use | `claude-sonnet-4-6` |
| `storypointinator.mcpServers` | MCP servers for additional context | `{}` |

## Usage

1. Open files related to the feature you want to estimate.
2. Open the Storypointinator sidebar panel.
3. Describe the feature (e.g., "Add file upload to the chat section").
4. Answer the clarifying questions — one at a time, or click **"Show all questions"** to answer them all at once.
5. Review the generated ticket with acceptance criteria, complexity breakdown, and story points.
6. Click **Copy AI Prompt** to get an implementation prompt, **Continue Conversation** to refine, or **Start New Estimate** to begin fresh.

## MCP Servers

Connect external tools to give the AI more context during estimation. Configure in `settings.json`:

```json
{
  "storypointinator.mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "ghp_..."
      }
    },
    "jira": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-server-jira"],
      "env": {
        "JIRA_API_TOKEN": "...",
        "JIRA_BASE_URL": "https://your-org.atlassian.net"
      }
    }
  }
}
```

MCP servers are connected on activation. Their tools are automatically discovered and made available to the AI during the clarification phase.

## Architecture

```
src/
├── extension.ts              # VS Code extension entry point
├── ai/
│   ├── graph.ts              # LangGraph state machine (ask → tools → estimate)
│   ├── nodes.ts              # Graph nodes: askNode (clarification) + estimateNode (ticket generation)
│   ├── state.ts              # Graph state definition and types
│   └── tools.ts              # Built-in tools: read_file, search_workspace
├── providers/
│   └── ChatProvider.ts       # Webview provider, session management, message handling
└── services/
    ├── ContextService.ts     # Reads open editor files and project directory map
    └── McpService.ts         # MCP client: connects servers, discovers tools

webview-ui/                   # React + Tailwind frontend
├── src/
│   ├── App.tsx               # Root component, state management, session bar
│   └── components/
│       ├── ChatView.tsx      # Chat UI with Q&A flow
│       └── TicketView.tsx    # Ticket display with copy actions
```

## Available Models

| Model | Description |
|---|---|
| `claude-sonnet-4-6` | Best balance of speed and quality (default) |
| `claude-opus-4-6` | Most capable, slower and more expensive |
| `claude-haiku-4-5-20251001` | Fastest and cheapest, less detailed |
| `claude-opus-4-5-20251101` | Previous gen, very capable |
| `claude-sonnet-4-5-20250929` | Previous gen, good balance |

## License

ISC
