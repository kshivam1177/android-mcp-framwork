import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export type RecordedSelector = {
  resourceId?: string;
  text?: string;
  contentDesc?: string;
  className?: string;
};

export type RecordedAction = {
  id: string;
  type: 'tap' | 'long_press' | 'swipe' | 'type_text' | 'key_press';
  timestamp: string;
  durationMs: number;
  selector?: RecordedSelector;
  coordinates?: { x: number; y: number };
  normalizedCoordinates?: { x: number; y: number };
  swipe?: { startX: number; startY: number; endX: number; endY: number };
  normalizedSwipe?: { startX: number; startY: number; endX: number; endY: number };
  screenSize?: { width: number; height: number };
  text?: string;
  redacted?: boolean;
  keyCode?: string;
};

export type RecordingDocument = {
  schemaVersion: 1;
  flowId: string;
  deviceId: string;
  startedAt: string;
  stoppedAt: string;
  durationMs: number;
  actions: RecordedAction[];
  screenshots: Record<string, string>;
};

type RecordingState = {
  flowId: string;
  deviceId: string;
  projectRoot: string;
  startedAt: number;
  startedAtIso: string;
  actions: RecordedAction[];
  screenshots: Record<string, string>;
  redactText: boolean;
  lastSelector?: RecordedSelector;
};

const ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/;
let active: RecordingState | null = null;

export function validateRecordingId(value: string): string {
  if (!ID_PATTERN.test(value) || value === '.' || value === '..') {
    throw new Error('flowId must be 1-80 characters and contain only letters, numbers, dot, underscore, or hyphen.');
  }
  return value;
}

function frameworkDir(projectRoot: string): string {
  return path.join(path.resolve(projectRoot), '.androidmcp-framework');
}

export function isRecording(targetId?: string): boolean {
  return Boolean(active && (!targetId || active.deviceId === targetId));
}

export function getRecordingInfo(): { flowId: string; deviceId: string; projectRoot: string } | null {
  if (!active) return null;
  return { flowId: active.flowId, deviceId: active.deviceId, projectRoot: active.projectRoot };
}

export async function startRecording(options: {
  flowId: string;
  deviceId: string;
  projectRoot: string;
  redactText?: boolean;
}): Promise<{ flowId: string; deviceId: string; startedAt: string; redactText: boolean }> {
  if (active) throw new Error(`Recording "${active.flowId}" is already active. Stop it before starting another recording.`);
  const flowId = validateRecordingId(options.flowId);
  const projectRoot = path.resolve(options.projectRoot);
  const startedAtIso = new Date().toISOString();
  const recordingsDir = path.join(frameworkDir(projectRoot), 'recordings');
  const evidenceDir = path.join(frameworkDir(projectRoot), 'recording-evidence', flowId);
  await fs.mkdir(recordingsDir, { recursive: true });
  await fs.mkdir(evidenceDir, { recursive: true });
  const destination = path.join(recordingsDir, `${flowId}.json`);
  try {
    await fs.access(destination);
    throw new Error(`Recording "${flowId}" already exists. Choose a different flowId; existing recordings are never overwritten.`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  active = {
    flowId,
    deviceId: options.deviceId,
    projectRoot,
    startedAt: Date.now(),
    startedAtIso,
    actions: [],
    screenshots: {},
    redactText: options.redactText ?? false,
  };
  return { flowId, deviceId: options.deviceId, startedAt: startedAtIso, redactText: active.redactText };
}

export function recordAction(action: Omit<RecordedAction, 'id' | 'timestamp'> & { timestamp?: string }): void {
  if (!active) return;
  if (active.actions.length >= 500) throw new Error('Recording reached the 500-action safety limit. Stop the recording before continuing.');
  const selector = action.selector ?? (action.type === 'type_text' ? active.lastSelector : undefined);
  const selectorText = selector ? Object.values(selector).join(' ').toLowerCase() : '';
  const sensitive = action.type === 'type_text' && /password|passwd|secret|token|otp|pin/.test(selectorText);
  const shouldRedact = action.type === 'type_text' && (active.redactText || sensitive);
  const recorded: RecordedAction = {
    ...action,
    id: `${action.type.replace(/[^a-z0-9]+/gi, '-')}-${active.actions.length + 1}`,
    timestamp: action.timestamp ?? new Date().toISOString(),
    ...(selector ? { selector } : {}),
    ...(shouldRedact ? { text: undefined, redacted: true } : {}),
  };
  if (recorded.type === 'tap') active.lastSelector = selector;
  active.actions.push(recorded);
}

export async function saveRecordingScreenshot(name: 'start' | 'stop', data: Buffer): Promise<string | undefined> {
  if (!active) return undefined;
  const evidenceDir = path.join(frameworkDir(active.projectRoot), 'recording-evidence', active.flowId);
  await fs.mkdir(evidenceDir, { recursive: true });
  const file = path.join(evidenceDir, `${name}.png`);
  await fs.writeFile(file, data);
  const relative = path.relative(active.projectRoot, file).split(path.sep).join('/');
  active.screenshots[name] = relative;
  return relative;
}

export async function stopRecording(): Promise<{
  flowId: string;
  actionCount: number;
  recordingPath: string;
  evidenceDirectory: string;
  durationMs: number;
}> {
  if (!active) throw new Error('No recording is active. Call start_recording first.');
  const state = active;
  const stoppedAt = new Date();
  const durationMs = Date.now() - state.startedAt;
  const document: RecordingDocument = {
    schemaVersion: 1,
    flowId: state.flowId,
    deviceId: state.deviceId,
    startedAt: state.startedAtIso,
    stoppedAt: stoppedAt.toISOString(),
    durationMs,
    actions: state.actions,
    screenshots: state.screenshots,
  };
  const directory = frameworkDir(state.projectRoot);
  const recordingPath = path.join(directory, 'recordings', `${state.flowId}.json`);
  await fs.mkdir(path.dirname(recordingPath), { recursive: true });
  await fs.writeFile(recordingPath, JSON.stringify(document, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' });
  active = null;
  return {
    flowId: state.flowId,
    actionCount: state.actions.length,
    recordingPath: path.relative(state.projectRoot, recordingPath).split(path.sep).join('/'),
    evidenceDirectory: path.relative(state.projectRoot, path.join(directory, 'recording-evidence', state.flowId)).split(path.sep).join('/'),
    durationMs,
  };
}

export function createReplayRunId(): string {
  return randomUUID().slice(0, 8);
}
