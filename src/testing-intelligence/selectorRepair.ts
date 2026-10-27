import type { UiNode } from '../types.js';
export type SelectorKind = 'resourceId'|'contentDesc'|'text';
export interface SelectorReference { kind: SelectorKind; value: string; }
export interface SelectorRepairProposal { status: 'still_matches'|'repair_candidates'|'no_candidate'; original: SelectorReference; matchedCount: number; proposals: Array<{kind: SelectorKind; value: string; score: number; evidence: string; reviewRequired: true}>; note: string; }
function valueFor(node: UiNode, kind: SelectorKind): string | undefined {
  return kind === 'resourceId' ? node.resourceId : kind === 'contentDesc' ? node.contentDesc : node.text;
}
function normalize(value: string): string { return value.trim().toLowerCase().replace(/[^a-z0-9]+/g,' '); }
export function proposeSelectorRepair(original: SelectorReference, nodes: UiNode[]): SelectorRepairProposal {
  const target = original.value.trim();
  if (!target) throw new Error('Original selector value must not be empty.');
  const exact = nodes.filter(node => valueFor(node, original.kind) === target);
  if (exact.length === 1) return { status:'still_matches', original, matchedCount:1, proposals:[], note:'The original selector still matches exactly one visible node; no repair is proposed.' };
  if (exact.length > 1) return { status:'repair_candidates', original, matchedCount:exact.length, proposals:[], note:'The original selector is ambiguous. Review the screen and add a stable unique selector; no automatic change is made.' };
  const targetNorm = normalize(target);
  const candidates = nodes.flatMap(node => {
    const values: Array<{kind:SelectorKind; value:string; weight:number}> = [
      ...(node.resourceId ? [{kind:'resourceId' as const,value:node.resourceId,weight:3}] : []),
      ...(node.contentDesc ? [{kind:'contentDesc' as const,value:node.contentDesc,weight:2}] : []),
      ...(node.text ? [{kind:'text' as const,value:node.text,weight:1}] : []),
    ];
    return values.map(v => {
      const normalized = normalize(v.value);
      const exactText = normalized === targetNorm;
      const containment = normalized.length > 2 && targetNorm.length > 2 && (normalized.includes(targetNorm) || targetNorm.includes(normalized));
      const shared = targetNorm.split(' ').filter(Boolean).filter(t => normalized.split(' ').includes(t)).length;
      const score = (exactText ? 100 : containment ? 60 : shared ? Math.min(45, shared * 12) : 0) + v.weight;
      return { ...v, score, node };
    }).filter(v => v.score >= 13 && v.value.trim());
  }).sort((a,b)=>b.score-a.score || a.kind.localeCompare(b.kind) || a.value.localeCompare(b.value));
  const unique = new Map<string, typeof candidates[number]>();
  for (const candidate of candidates) {
    const key = candidate.kind + ':' + candidate.value;
    if (!unique.has(key)) unique.set(key,candidate);
  }
  const proposals = [...unique.values()].slice(0,5).map(c => ({kind:c.kind,value:c.value,score:c.score,evidence:'Visible node candidate; resourceId/contentDesc/text inspected from the current hierarchy.',reviewRequired:true as const}));
  return { status:proposals.length ? 'repair_candidates' : 'no_candidate', original, matchedCount:0, proposals, note:proposals.length ? 'Candidates are suggestions only. Verify semantics and uniqueness before updating any saved test.' : 'No sufficiently similar visible selector was found; capture a fresh hierarchy or inspect the screen manually.' };
}
