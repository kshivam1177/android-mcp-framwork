import type { ChangedFile, StoredTestCase } from './changeImpact.js';

const STOP_WORDS = new Set([
  'a','an','and','are','as','at','after','be','by','for','from','i','in','into','is','it','of','on','or','please','run','test','tests','the','this','to','with','app','application','change','changes',
]);
export interface RankedTestCase {
  id: string;
  title: string;
  category: string;
  score: number;
  reasons: string[];
  steps: Array<{ stepNumber: number; description: string; action?: string; target?: string; value?: string; expectedOutcome?: string }>;
  assertions: string[];
  file?: string;
}
export interface PlanCandidate {
  request: string;
  changedFiles: ChangedFile[];
  testCases: StoredTestCase[];
  maxTestCases?: number;
}
export interface NaturalLanguagePlanResult {
  status: 'planned' | 'needs_coverage';
  request: string;
  selectedTestCases: RankedTestCase[];
  steps: Array<{ action: string; target?: string; value?: string; assertion?: string; sourceTestCase: string }>;
  relevantTerms: string[];
  unmappedChangedFiles: string[];
  missingCoverage: string[];
  rationale: string[];
  executesTests: false;
}
function tokens(value: string): string[] {
  return [...new Set((value.toLowerCase().match(/[a-z0-9][a-z0-9._/-]*/g) ?? [])
    .map(token => token.replace(/^[./]+|[./]+$/g, ''))
    .filter(token => token.length > 1 && !STOP_WORDS.has(token)))];
}
function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  return [];
}
function normalizeCase(testCase: StoredTestCase, index: number): RankedTestCase {
  const id = typeof testCase.id === 'string' && testCase.id.trim() ? testCase.id.trim() : `test-case-${index + 1}`;
  const title = typeof testCase.title === 'string' && testCase.title.trim() ? testCase.title.trim() : id;
  const category = typeof testCase.category === 'string' && testCase.category.trim() ? testCase.category.trim() : 'general';
  const steps = Array.isArray(testCase.steps) ? testCase.steps.filter((step): step is Record<string, unknown> => Boolean(step) && typeof step === 'object' && !Array.isArray(step)).map((step, i) => ({
    stepNumber: typeof step.stepNumber === 'number' ? step.stepNumber : i + 1,
    description: typeof step.description === 'string' ? step.description : '',
    ...(typeof step.action === 'string' ? { action: step.action } : {}),
    ...(typeof step.target === 'string' ? { target: step.target } : {}),
    ...(typeof step.value === 'string' ? { value: step.value } : {}),
    ...(typeof step.expectedOutcome === 'string' ? { expectedOutcome: step.expectedOutcome } : {}),
  })) : [];
  const assertions = strings(testCase.assertions);
  return {
    id, title, category, score: 0, reasons: [], steps, assertions,
    ...(typeof testCase.file === 'string' ? { file: testCase.file } : {}),
  };
}
export function planFromRequest(input: PlanCandidate): NaturalLanguagePlanResult {
  const requestTokens = tokens(input.request);
  const ranked = input.testCases.map((testCase, index) => {
    const normalized = normalizeCase(testCase, index);
    const searchable = new Set(tokens([
      normalized.id, normalized.title, normalized.category,
      ...strings(testCase.description),
      ...strings(testCase.tags),
      ...strings(testCase.feature),
      ...strings(testCase.screenIds),
      ...strings(testCase.modules),
    ].join(' ')));
    const overlap = requestTokens.filter(token => searchable.has(token));
    const mappedPaths = [
      ...strings(testCase.relatedFiles), ...strings(testCase.affectedPaths),
      ...strings(testCase.sourceFiles), ...strings(testCase.files),
      ...strings(testCase.paths), ...strings(testCase.modules),
    ];
    const matchedChanges = input.changedFiles.map(file => file.path).filter(file => mappedPaths.some(pattern => {
      const normalizedPattern = pattern.replaceAll('\\\\', '/').replace(/^\.\//, '');
      const changed = file.replaceAll('\\\\', '/').replace(/^\.\//, '');
      if (normalizedPattern.endsWith('/**')) {
        const prefix = normalizedPattern.slice(0, -3).replace(/\/$/, '');
        return changed === prefix || changed.startsWith(prefix + '/');
      }
      if (normalizedPattern.endsWith('*')) return changed.startsWith(normalizedPattern.slice(0, -1));
      return changed === normalizedPattern || changed.startsWith(normalizedPattern.endsWith('/') ? normalizedPattern : normalizedPattern + '/');
    }));
    normalized.score = overlap.length + matchedChanges.length * 10;
    if (overlap.length) normalized.reasons.push(`Request terms matched: ${overlap.join(', ')}.`);
    if (matchedChanges.length) normalized.reasons.push(`Explicit source mapping matched changed files: ${matchedChanges.join(', ')}.`);
    if (!normalized.reasons.length) normalized.reasons.push('No request-term or explicit changed-file match.');
    return normalized;
  }).filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  const max = Math.min(Math.max(input.maxTestCases ?? 10, 1), 30);
  const selectedTestCases = ranked.slice(0, max);
  const steps: NaturalLanguagePlanResult['steps'] = [];
  const missingCoverage: string[] = [];
  for (const testCase of selectedTestCases) {
    if (!testCase.steps.length) {
      missingCoverage.push(`Test case "${testCase.id}" has no recorded steps.`);
      continue;
    }
    for (const step of testCase.steps) {
      const action = step.action?.trim() || step.description.trim();
      if (!action) {
        missingCoverage.push(`Test case "${testCase.id}" has an empty step ${step.stepNumber}.`);
        continue;
      }
      steps.push({
        action,
        ...(step.target ? { target: step.target } : {}),
        ...(step.value ? { value: step.value } : {}),
        ...(step.expectedOutcome ? { assertion: step.expectedOutcome } : {}),
        sourceTestCase: testCase.id,
      });
    }
    for (const assertion of testCase.assertions) {
      steps.push({ action: 'assert', assertion, sourceTestCase: testCase.id });
    }
  }
  if (!selectedTestCases.length) missingCoverage.push('No saved test case matched the request or changed-file mappings. Create/review test cases before execution.');
  const coveredChangedPaths = new Set<string>();
  for (const testCase of selectedTestCases) {
    const raw = input.testCases.find(item => (typeof item.id === 'string' ? item.id : '') === testCase.id);
    if (!raw) continue;
    const mappings = [...strings(raw.relatedFiles), ...strings(raw.affectedPaths), ...strings(raw.sourceFiles), ...strings(raw.files), ...strings(raw.paths), ...strings(raw.modules)];
    for (const changed of input.changedFiles.map(file => file.path)) {
      if (mappings.some(pattern => {
        const normalizedPattern = pattern.replaceAll('\\\\', '/').replace(/^\.\//, '');
        const file = changed.replaceAll('\\\\', '/').replace(/^\.\//, '');
        return normalizedPattern.endsWith('/**')
          ? file === normalizedPattern.slice(0, -3).replace(/\/$/, '') || file.startsWith(normalizedPattern.slice(0, -3).replace(/\/$/, '') + '/')
          : normalizedPattern.endsWith('*') ? file.startsWith(normalizedPattern.slice(0, -1))
            : file === normalizedPattern || file.startsWith(normalizedPattern.endsWith('/') ? normalizedPattern : normalizedPattern + '/');
      })) coveredChangedPaths.add(changed);
    }
  }
  const unmappedChangedFiles = input.changedFiles.map(file => file.path).filter(file => !coveredChangedPaths.has(file));
  if (unmappedChangedFiles.length) missingCoverage.push(`No selected test case explicitly maps to: ${unmappedChangedFiles.join(', ')}.`);
  if (!requestTokens.length) missingCoverage.push('The request did not contain enough specific terms to rank saved test cases.');
  const status = selectedTestCases.length > 0 && steps.length > 0 && missingCoverage.length === 0 ? 'planned' : 'needs_coverage';
  const rationale = [
    `Ranked ${input.testCases.length} saved test case(s) using request terms and explicit changed-file mappings.`,
    'Only saved test-case steps and assertions are included; no new UI actions are invented.',
    'This tool prepares a plan only. It does not execute tests or assert that coverage is complete.',
  ];
  if (status === 'needs_coverage') rationale.push('Resolve the listed coverage gaps before treating this as a complete test plan.');
  return { status, request: input.request, selectedTestCases, steps, relevantTerms: requestTokens, unmappedChangedFiles, missingCoverage, rationale, executesTests: false };
}
