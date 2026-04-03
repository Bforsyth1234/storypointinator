import * as vscode from "vscode";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

interface McpServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

interface ConnectedServer {
  name: string;
  client: Client;
  transport: StdioClientTransport;
}

export class McpService {
  private _servers: ConnectedServer[] = [];

  async connectAll(): Promise<void> {
    await this.disconnectAll();

    const config = vscode.workspace.getConfiguration("storypointinator");
    const servers = config.get<Record<string, McpServerConfig>>("mcpServers") || {};

    for (const [name, serverConfig] of Object.entries(servers)) {
      try {
        await this._connectServer(name, serverConfig);
        console.log(`MCP: Connected to "${name}"`);
      } catch (err: any) {
        console.error(`MCP: Failed to connect to "${name}":`, err.message);
        vscode.window.showWarningMessage(
          `Storypointinator: Failed to connect to MCP server "${name}": ${err.message}`
        );
      }
    }
  }

  private async _connectServer(name: string, config: McpServerConfig): Promise<void> {
    const transport = new StdioClientTransport({
      command: config.command,
      args: config.args || [],
      env: config.env ? { ...config.env } : undefined,
    });

    const client = new Client(
      { name: "storypointinator", version: "0.0.1" },
    );

    await client.connect(transport);
    this._servers.push({ name, client, transport });
  }

  async disconnectAll(): Promise<void> {
    for (const server of this._servers) {
      try {
        await server.client.close();
      } catch {
        // ignore close errors
      }
    }
    this._servers = [];
  }

  async getLangChainTools(): Promise<any[]> {
    const tools: any[] = [];

    for (const server of this._servers) {
      try {
        const result = await server.client.listTools();

        for (const mcpTool of result.tools) {
          const serverName = server.name;
          const mcpClient = server.client;

          // Convert JSON Schema properties to zod schema
          const zodSchema = this._jsonSchemaToZod(mcpTool.inputSchema);

          const langchainTool = tool(
            async (input) => {
              try {
                const callResult = await mcpClient.callTool({
                  name: mcpTool.name,
                  arguments: input as Record<string, unknown>,
                });
                // Extract text content from the result
                const textParts = (callResult.content as any[])
                  .filter((c: any) => c.type === "text")
                  .map((c: any) => c.text);
                return textParts.join("\n") || JSON.stringify(callResult.content);
              } catch (err: any) {
                return `Error calling MCP tool ${mcpTool.name}: ${err.message}`;
              }
            },
            {
              name: `${serverName}__${mcpTool.name}`,
              description: mcpTool.description || `Tool "${mcpTool.name}" from MCP server "${serverName}"`,
              schema: zodSchema,
            }
          );

          tools.push(langchainTool);
        }
      } catch (err: any) {
        console.error(`MCP: Failed to list tools from "${server.name}":`, err.message);
      }
    }

    return tools;
  }

  private _jsonSchemaToZod(schema: any): z.ZodObject<any> {
    const shape: Record<string, z.ZodTypeAny> = {};
    const properties = schema.properties || {};
    const required = new Set(schema.required || []);

    for (const [key, prop] of Object.entries<any>(properties)) {
      let field: z.ZodTypeAny;

      switch (prop.type) {
        case "number":
        case "integer":
          field = z.number();
          break;
        case "boolean":
          field = z.boolean();
          break;
        case "array":
          field = z.array(z.any());
          break;
        case "object":
          field = z.record(z.string(), z.any());
          break;
        default:
          field = z.string();
      }

      if (prop.description) {
        field = field.describe(prop.description);
      }

      if (!required.has(key)) {
        field = field.optional();
      }

      shape[key] = field;
    }

    return z.object(shape);
  }

  get serverCount(): number {
    return this._servers.length;
  }

  get serverNames(): string[] {
    return this._servers.map(s => s.name);
  }
}
