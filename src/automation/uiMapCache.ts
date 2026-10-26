export interface UiMapElement {
  id: string;
  role?: string;
  label?: string;
  resourceId?: string;
  testId?: string;
  clickable?: boolean;
  editable?: boolean;
  bounds?: { left: number; top: number; right: number; bottom: number };
  [key: string]: unknown;
}
export interface UiMapSnapshot {
  key: string;
  capturedAt: number;
  appVersion?: string;
  sourceFingerprint?: string;
  hierarchy?: string;
  screenshotRef?: string;
  elements: UiMapElement[];
}
export interface UiMapCacheOptions {
  ttlMs?: number;
  now?: () => number;
}

/**
 * Small process-local UI-map cache. A caller must provide a stable screen key
 * and invalidate it after navigation, app restart, or a state-changing action.
 * Fingerprints and app versions prevent reuse across known app revisions.
 */
export class UiMapCache {
  private readonly snapshots = new Map<string, UiMapSnapshot>();
  private readonly ttlMs: number;
  private readonly now: () => number;

  constructor(options: UiMapCacheOptions = {}) {
    this.ttlMs = Math.max(0, options.ttlMs ?? 30_000);
    this.now = options.now ?? Date.now;
  }

  get(key: string, expected: { appVersion?: string; sourceFingerprint?: string } = {}): UiMapSnapshot | undefined {
    const snapshot = this.snapshots.get(key);
    if (!snapshot) return undefined;
    const expired = this.now() - snapshot.capturedAt > this.ttlMs || this.now() < snapshot.capturedAt;
    const versionMismatch = expected.appVersion !== undefined && snapshot.appVersion !== expected.appVersion;
    const fingerprintMismatch = expected.sourceFingerprint !== undefined && snapshot.sourceFingerprint !== expected.sourceFingerprint;
    if (expired || versionMismatch || fingerprintMismatch) {
      this.snapshots.delete(key);
      return undefined;
    }
    return structuredClone(snapshot);
  }

  set(snapshot: UiMapSnapshot): void {
    if (!snapshot.key.trim()) throw new Error('UI-map snapshot key must not be empty.');
    if (!Array.isArray(snapshot.elements)) throw new Error('UI-map snapshot elements must be an array.');
    this.snapshots.set(snapshot.key, structuredClone({ ...snapshot, elements: snapshot.elements.map((element, index) => ({
      ...element,
      id: element.id?.trim() || `element-${index + 1}`,
    })) }));
  }

  invalidate(key: string): boolean {
    return this.snapshots.delete(key);
  }

  invalidateAll(): void {
    this.snapshots.clear();
  }

  get size(): number {
    return this.snapshots.size;
  }
}
