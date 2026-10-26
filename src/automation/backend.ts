/**
 * Both automation tiers implement this. adbBackend.ts needs nothing beyond
 * platform-tools; u2Backend.ts shells out to `u2cli` and requires the user to
 * have run `pip install uiautomator2 && python -m uiautomator2 init` once.
 * Tool handlers in src/tools/ui-automation call through resolveBackend()
 * rather than importing either implementation directly.
 */
export interface AutomationBackend {
  readonly name: 'adb' | 'uiautomator2';
  /** Cheap reachability check - does NOT throw, just reports availability. */
  isAvailable(targetId: string): Promise<boolean>;
  /** Raw UI hierarchy XML for the current screen. */
  dumpHierarchy(targetId: string): Promise<string>;
  tap(targetId: string, x: number, y: number): Promise<void>;
  longPress(targetId: string, x: number, y: number, durationMs?: number): Promise<void>;
  swipe(targetId: string, startX: number, startY: number, endX: number, endY: number, durationMs?: number): Promise<void>;
  drag(targetId: string, startX: number, startY: number, endX: number, endY: number, durationMs?: number): Promise<void>;
  typeText(targetId: string, text: string): Promise<void>;
  keyEvent(targetId: string, keyCode: string): Promise<void>;
  /** adb's screencap produces PNG; the uiautomator2 bridge's raw screenshot
   * is JPEG - callers need the real mime type, not an assumed one. */
  screenshot(targetId: string): Promise<{ data: Buffer; mimeType: string }>;
}
