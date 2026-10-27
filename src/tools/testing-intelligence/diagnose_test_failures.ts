import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { diagnoseFailure } from '../../testing-intelligence/failureDiagnosis.js';
import { withErrorHandling, textResult } from '../../utils/response.js';
import type { ToolModule } from '../types.js';
export const toolName='diagnose_test_failures'; export const workflow='testing-intelligence';
const failureSchema=z.object({testCaseId:z.string().optional(),status:z.string().optional(),error:z.string().optional(),message:z.string().optional(),expectedOutcome:z.string().optional(),attempt:z.number().int().min(1).optional(),readOnly:z.boolean().optional().default(false)});
export function register(server:McpServer) {
 return server.registerTool(toolName,{title:'Diagnose Test Failures',description:'Classify failure evidence into environment, assertion, application, test-definition, likely-flaky, or unknown categories. Retry advice is bounded to at most two retries, requires an explicit safe-to-repeat declaration, and never discards original failures.',inputSchema:{failures:z.array(failureSchema).min(1).max(100),maxRetries:z.number().int().min(0).max(2).optional().default(0)},annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}},withErrorHandling(async(args:{failures:Array<{testCaseId?:string;status?:string;error?:string;message?:string;expectedOutcome?:string;attempt?:number;readOnly?:boolean}>;maxRetries?:number})=>{
   const results=args.failures.map(f=>({testCaseId:f.testCaseId,diagnosis:diagnoseFailure({...f,maxRetries:args.maxRetries??0})}));
   const counts=Object.fromEntries(['environment','assertion','application','likely_flaky','test_definition','unknown'].map(k=>[k,results.filter(r=>r.diagnosis.kind===k).length]));
   const result={results,counts,policy:{maxRetries:args.maxRetries??0,absoluteMaximum:2,originalFailurePreserved:true,automaticTestDefinitionChanges:false}};
   return textResult(JSON.stringify(result,null,2),result as unknown as Record<string,unknown>);
 }));
}
const mod:ToolModule={toolName,workflow,register}; export default mod;
