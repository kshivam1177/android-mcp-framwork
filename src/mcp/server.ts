import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { registerTools, getTools } from './toolRegistry.js';

export async function startMcpServer(): Promise<void> {
  const server = new Server({ name: 'androidbuildmcp', version: '0.1.0' }, { capabilities: { tools: {} } });
  registerTools();
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: getTools().map(tool => ({ name: tool.name, description: tool.description, inputSchema: tool.inputSchema })) }));
  server.setRequestHandler(CallToolRequestSchema, async request => {
    const tool = getTools().find(item => item.name === request.params.name);
    if (!tool) throw new Error(`Unknown tool: ${request.params.name}`);
    try {
      const result = await tool.handler(request.params.arguments ?? {});
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { isError: true, content: [{ type: 'text' as const, text: message }] };
    }
  });
  await server.connect(new StdioServerTransport());
}
