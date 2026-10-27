import type { ChangedFile, StoredTestCase } from './changeImpact.js';

export interface PriorFailure { testCaseId?: string; title?: string; error?: string; status?: string; }
export interface IntelligentPlanInput {
  request: string;
  changedFiles: ChangedFile[];
  testCases: StoredTestCase[];
  instructions?: string[];
  priorFailures?: PriorFailure[];
  maxTestCases?: number;
}
export interface IntelligentPlan {
  status: 'planned' | 'needs_coverage';
  request: string;
  selected: Array<{ id: string; title: string; score: number; reasons: string[]; file?: string }>;
  changedFiles: ChangedFile[];
  unmappedChangedFiles: string[];
  relevantInstructions: string[];
  relevantPriorFailures: PriorFailure[];
  broadRegressionRecommended: boolean;
  nextActions: string[];
  executesTests: false;
}
const STOP = new Set(['a','an','and','are','as','at','be','by','for','from','i','in','is','it','of','on','or','please','run','test','tests','the','this','to','with','app','application','change','changes']);
function tokens(value: string): string[] {
  return [...new Set((value.toLowerCase().match(/[a-z0-9][a-z0-9._/-]*/g) ?? []).filter(t => t.length > 1 && !STOP.has(t)))];
}
function strings(value: unknown): string[] { return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : typeof value === 'string' ? [value] : []; }
function pathMatches(file: string, pattern: string): boolean {
  const f = file.replaceAll('\\\\','/').replace(/^\.\//,'');
  const p = pattern.replaceAll('\\\\','/').replace(/^\.\//,'');
  if (!p || p === '*') return false;
  if (p.endsWith('/**')) { const prefix = p.slice(0,-3).replace(/\/$/,''); return f === prefix || f.startsWith(prefix + '/'); }
  if (p.endsWith('*')) return f.startsWith(p.slice(0,-1));
  return f === p || f.startsWith(p.endsWith('/') ? p : p + '/');
}
function casePaths(item: StoredTestCase): string[] {
  return ['relatedFiles','affectedPaths','sourceFiles','files','paths','modules'].flatMap(key => strings(item[key]));
}
export function buildIntelligentPlan(input: IntelligentPlanInput): IntelligentPlan {
  const requestTokens = tokens(input.request);
  const changed = input.changedFiles.map(f => f.path);
  const failures = input.priorFailures ?? [];
  const ranked = input.testCases.map((item, index) => {
    const id = typeof item.id === 'string' && item.id.trim() ? item.id.trim() : 'test-case-' + (index + 1);
    const title = typeof item.title === 'string' && item.title.trim() ? item.title.trim() : id;
    const paths = casePaths(item);
    const matchedPaths = changed.filter(file => paths.some(pattern => pathMatches(file, pattern)));
    const searchable = tokens([id,title,strings(item.description).join(' '),strings(item.tags).join(' '),strings(item.feature).join(' ')].join(' '));
    const overlap = requestTokens.filter(token => searchable.includes(token));
    const failedBefore = failures.filter(f => f.testCaseId === id || (f.title && tokens(f.title).some(t => searchable.includes(t))));
    const reasons: string[] = [];
    let score = 0;
    if (matchedPaths.length) { score += matchedPaths.length * 10; reasons.push('Explicit source mapping matches: ' + matchedPaths.join(', ')); }
    if (overlap.length) { score += overlap.length; reasons.push('Request terms match: ' + overlap.join(', ')); }
    if (failedBefore.length) { score += 4 * failedBefore.length; reasons.push('Prior failure evidence raises priority (' + failedBefore.length + ').'); }
    if (score > 0) return { id, title, score, reasons, file: typeof item.file === 'string' ? item.file : undefined, paths };
    return { id, title, score, reasons: ['No request, change mapping, or prior-failure signal matched.'], file: typeof item.file === 'string' ? item.file : undefined, paths };
  }).filter(item => item.score > 0).sort((a,b) => b.score - a.score || a.id.localeCompare(b.id));
  const limit = Math.max(1, Math.min(input.maxTestCases ?? 10, 30));
  const selected = ranked.slice(0, limit).map(({id,title,score,reasons,file}) => ({id,title,score,reasons,...(file ? {file}: {})}));
  const covered = new Set(ranked.slice(0,limit).flatMap(item => changed.filter(file => item.paths.some(pattern => pathMatches(file,pattern)))));
  const unmappedChangedFiles = changed.filter(file => !covered.has(file));
  const relevantInstructions = (input.instructions ?? []).filter(line => {
    const terms = tokens(line); return terms.some(t => requestTokens.includes(t) || changed.some(p => tokens(p).includes(t)));
  }).slice(0,30);
  const relevantPriorFailures = failures.filter(f => selected.some(s => s.id === f.testCaseId || (f.title && tokens(f.title).some(t => tokens(s.title).includes(t))))).slice(0,30);
  const broadRegressionRecommended = input.changedFiles.length === 0 || unmappedChangedFiles.length > 0 || selected.length === 0;
  const nextActions = [
    selected.length ? 'Review and run the selected existing test cases first.' : 'No saved test case is confidently mapped; add/review test coverage before claiming coverage.',
    ...(unmappedChangedFiles.length ? ['Inspect unmapped changed files and include broad regression coverage.'] : []),
    ...(relevantPriorFailures.length ? ['Prioritize the listed previously failing cases and compare new evidence with the original failures.'] : []),
    'Review effective instructions and the plan before opting into execution.',
  ];
  return { status: selected.length && !unmappedChangedFiles.length && requestTokens.length ? 'planned' : 'needs_coverage', request: input.request, selected, changedFiles: input.changedFiles, unmappedChangedFiles, relevantInstructions, relevantPriorFailures, broadRegressionRecommended, nextActions, executesTests: false };
}
