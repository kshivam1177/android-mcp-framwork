export interface TestCandidateInput {
  request: string;
  acceptanceCriteria: string[];
  platform: 'android' | 'flutter' | 'cross-platform';
}
export interface TestCandidate {
  schemaVersion: 1;
  format: 'androidmcp-test-candidate';
  id: string;
  title: string;
  platform: TestCandidateInput['platform'];
  request: string;
  reviewRequired: true;
  executable: false;
  acceptanceCriteria: string[];
  steps: Array<{ action: 'wait_for_ui'; description: string; expectedOutcome: string; reviewRequired: true }>;
  notes: string[];
}
function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'candidate';
}
export function createTestCandidate(input: TestCandidateInput): TestCandidate {
  const request = input.request.trim();
  if (request.length < 3) throw new Error('Request must contain at least 3 characters.');
  const criteria = input.acceptanceCriteria.map(item => item.trim()).filter(Boolean);
  if (criteria.length === 0) throw new Error('Provide at least one explicit acceptance criterion; the generator does not invent expected behavior.');
  if (criteria.length > 30) throw new Error('At most 30 acceptance criteria are supported per candidate.');
  return {
    schemaVersion: 1, format: 'androidmcp-test-candidate', id: 'candidate-' + slug(request),
    title: request.slice(0, 120), platform: input.platform, request,
    reviewRequired: true, executable: false, acceptanceCriteria: criteria,
    steps: criteria.map((criterion, index) => ({
      action: 'wait_for_ui',
      description: 'Review and define the UI interaction for acceptance criterion ' + (index + 1),
      expectedOutcome: criterion, reviewRequired: true,
    })),
    notes: [
      'Draft only: no source code, test script, or Android CLI Journey was generated.',
      'Replace each placeholder action with verified project-specific steps and selectors before execution.',
      'Verify that each expectedOutcome is observable in the UI hierarchy; criteria may need to be rewritten as visible text or accessibility labels.',
      'This candidate is intentionally non-executable until a human reviews and saves it as a test case.',
    ],
  };
}
