import { describe, expect, it, vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import tool from '../plan_intelligent_tests.js';
describe('plan_intelligent_tests registration',()=>{
 it('registers a read-only planning tool',()=>{
  const server=new McpServer({name:'test',version:'1.0.0'}); const spy=vi.spyOn(server,'registerTool');
  tool.register(server); expect(spy).toHaveBeenCalledWith('plan_intelligent_tests',expect.objectContaining({annotations:expect.objectContaining({readOnlyHint:true})}),expect.any(Function));
 });
});
