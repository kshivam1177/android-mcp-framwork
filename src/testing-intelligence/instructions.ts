export type InstructionScope = 'global' | 'project' | 'feature' | 'run';
export interface ScopedInstructions {
  scope: InstructionScope;
  values: Record<string, unknown>;
}
export interface EffectiveInstructions {
  values: Record<string, unknown>;
  appliedScopes: InstructionScope[];
}

/**
 * Resolve instruction layers from least to most specific. Object-valued settings
 * are merged recursively; arrays and scalar values are replaced by the more
 * specific layer. Safety constraints should be enforced by execution code and
 * must not be represented as overridable instruction values.
 */
export function resolveInstructions(layers: ScopedInstructions[]): EffectiveInstructions {
  const rank: Record<InstructionScope, number> = { global: 0, project: 1, feature: 2, run: 3 };
  const ordered = [...layers].sort((a, b) => rank[a.scope] - rank[b.scope]);
  const values: Record<string, unknown> = {};
  for (const layer of ordered) merge(values, layer.values);
  return { values, appliedScopes: [...new Set(ordered.map(layer => layer.scope))] };
}

function merge(target: Record<string, unknown>, source: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(source)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const existing = target[key];
      const nested = existing && typeof existing === 'object' && !Array.isArray(existing)
        ? existing as Record<string, unknown>
        : {};
      merge(nested, value as Record<string, unknown>);
      target[key] = nested;
    } else {
      target[key] = value;
    }
  }
}

export interface NaturalLanguageTestPlan {
  goal: string;
  steps: Array<{ action: string; target?: string; value?: string; assertion?: string }>;
  status: 'planned' | 'blocked';
  blockedReason?: string;
}

/** Minimal structural validation; this does not execute or trust an LLM plan. */
export function validateTestPlan(input: unknown): NaturalLanguageTestPlan {
  if (!input || typeof input !== 'object') {
    return { goal: '', steps: [], status: 'blocked', blockedReason: 'Plan must be a JSON object.' };
  }
  const candidate = input as Record<string, unknown>;
  if (typeof candidate.goal !== 'string' || !candidate.goal.trim()) {
    return { goal: '', steps: [], status: 'blocked', blockedReason: 'A non-empty test goal is required.' };
  }
  if (!Array.isArray(candidate.steps) || candidate.steps.length === 0) {
    return { goal: candidate.goal, steps: [], status: 'blocked', blockedReason: 'At least one explicit step is required; no actions were executed.' };
  }
  const steps: NaturalLanguageTestPlan['steps'] = [];
  for (let i = 0; i < candidate.steps.length; i++) {
    const step = candidate.steps[i];
    if (!step || typeof step !== 'object' || typeof (step as Record<string, unknown>).action !== 'string' || !(step as Record<string, string>).action.trim()) {
      return { goal: candidate.goal, steps, status: 'blocked', blockedReason: `Step ${i + 1} must include a non-empty action.` };
    }
    const item = step as Record<string, unknown>;
    steps.push({
      action: (item.action as string).trim(),
      ...(typeof item.target === 'string' ? { target: item.target } : {}),
      ...(typeof item.value === 'string' ? { value: item.value } : {}),
      ...(typeof item.assertion === 'string' ? { assertion: item.assertion } : {}),
    });
  }
  return { goal: candidate.goal.trim(), steps, status: 'planned' };
}
