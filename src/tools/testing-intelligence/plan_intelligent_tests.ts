import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getConfigDir } from '../../config/loader.js';
import { collectGitChanges, type StoredTestCase } from '../../testing-intelligence/changeImpact.js';
import { buildIntelligentPlan, type PriorFailure } from '../../testing-intelligence/intelligentPlanning.js';
import { resolveProjectRoot } from '../../utils/paths.js';
import { withErrorHandling, textResult } from '../../utils/response.js';
import type { ToolModule } from '../types.js';
export const toolName = 'plan_intelligent_tests';
export const workflow = 'testing-intelligence';
async function readJsonCases(dir:string):Promise<StoredTestCase[]> {
  const result:StoredTestCase[]=[];
  try { for (const file of (await fs.readdir(dir)).filter(n=>n.endsWith('.json')).sort()) { try { const v:unknown=JSON.parse(await fs.readFile(path.join(dir,file),'utf8')); if(v&&typeof v==='object'&&!Array.isArray(v)) result.push({...v as StoredTestCase,file:path.join(dir,file)}); } catch { /* malformed case is not trusted */ } } } catch(e) { if((e as NodeJS.ErrnoException).code!=='ENOENT') throw e; }
  return result;
}
async function readInstructions(dir:string):Promise<string[]> {
  const lines:string[]=[];
  async function walk(current:string):Promise<void> { let entries; try { entries=await fs.readdir(current,{withFileTypes:true}); } catch(e) { if((e as NodeJS.ErrnoException).code==='ENOENT') return; throw e; }
    for(const entry of entries.sort((a,b)=>a.name.localeCompare(b.name))) { const full=path.join(current,entry.name); if(entry.isDirectory()) await walk(full); else if(entry.isFile()&&entry.name.endsWith('.md')) { const body=await fs.readFile(full,'utf8'); lines.push(...body.split(/\r?\n/).map(x=>x.trim()).filter(x=>x.length>0&&!x.startsWith('#')).slice(0,200)); } } }
  await walk(dir); return lines;
}
async function readFailures(reportsDir:string):Promise<PriorFailure[]> {
  const out:PriorFailure[]=[];
  async function walk(current:string,depth=0):Promise<void> { if(depth>5||out.length>=100) return; let entries; try { entries=await fs.readdir(current,{withFileTypes:true}); } catch(e) { if((e as NodeJS.ErrnoException).code==='ENOENT') return; throw e; }
    for(const entry of entries) { if(out.length>=100) break; const full=path.join(current,entry.name); if(entry.isDirectory()) await walk(full,depth+1); else if(entry.isFile()&&entry.name.endsWith('.json')) { try { const v=JSON.parse(await fs.readFile(full,'utf8')) as Record<string,unknown>; const status=String(v.status??'').toLowerCase(); const steps=Array.isArray(v.stepResults)?v.stepResults:[]; const errors=steps.filter(s=>s&&typeof s==='object'&&String((s as Record<string,unknown>).status).toLowerCase().includes('fail')); if(status.includes('fail')||errors.length) out.push({testCaseId:typeof v.testCaseId==='string'?v.testCaseId:undefined,title:typeof v.title==='string'?v.title:undefined,error:errors.map(s=>String((s as Record<string,unknown>).error??(s as Record<string,unknown>).message??'')).join(' ').slice(0,500),status}); } catch { /* ignore non-report JSON */ } } } }
  await walk(reportsDir); return out;
}
export function register(server:McpServer) {
  return server.registerTool(toolName,{title:'Plan Intelligent Change-Aware Tests',description:'Rank existing saved tests using the request, Git diff, explicit file mappings, project instructions, and previous failure reports. Returns explainable coverage gaps and never executes tests.',inputSchema:{request:z.string().min(3).max(4000),projectPath:z.string().optional(),base:z.string().optional(),maxTestCases:z.number().int().min(1).max(30).optional().default(10)},annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}},withErrorHandling(async(args:{request:string;projectPath?:string;base?:string;maxTestCases?:number})=>{
    const root=resolveProjectRoot(path.resolve(args.projectPath??process.cwd())); const config=getConfigDir(root);
    let changes; const warnings:string[]=[];
    try { changes=await collectGitChanges(root,args.base??'HEAD~1'); } catch(e) { changes={changedFiles:[],base:args.base??'HEAD~1',head:'unknown',selectedSuites:['broad-regression'],fallbackToBroadRun:true,rationale:['Git change analysis unavailable.'],error:e instanceof Error?e.message:String(e)}; warnings.push('Git change analysis unavailable; broad regression is recommended.'); }
    const [testCases,instructions,priorFailures]=await Promise.all([readJsonCases(path.join(config,'testcases')),readInstructions(path.join(config,'instructions')),readFailures(path.join(config,'test-reports'))]);
    const plan=buildIntelligentPlan({request:args.request,changedFiles:changes.changedFiles,testCases,instructions,priorFailures,maxTestCases:args.maxTestCases});
    const result={...plan,projectRoot:root,selectedSuites:changes.selectedSuites,gitFallback:changes.fallbackToBroadRun,changeRationale:changes.rationale,testCaseCount:testCases.length,instructionLineCount:instructions.length,priorFailureCount:priorFailures.length,warnings};
    return textResult(JSON.stringify(result,null,2),result as unknown as Record<string,unknown>);
  }));
}
const mod:ToolModule={toolName,workflow,register}; export default mod;
