/** adbBackend.ts is the single supported UI-automation implementation. */
export interface AutomationBackend {
  readonly name: 'adb';
  isAvailable(targetId: string): Promise<boolean>;
  dumpHierarchy(targetId: string): Promise<string>;
  tap(targetId: string, x: number, y: number): Promise<void>;
  longPress(targetId: string, x: number, y: number, durationMs?: number): Promise<void>;
  swipe(targetId: string, startX: number, startY: number, endX: number, endY: number, durationMs?: number): Promise<void>;
  drag(targetId: string, startX: number, startY: number, endX: number, endY: number, durationMs?: number): Promise<void>;
  typeText(targetId: string, text: string): Promise<void>;
  keyEvent(targetId: string, keyCode: string): Promise<void>;
  screenshot(targetId: string): Promise<{ data: Buffer; mimeType: string }>;
}
