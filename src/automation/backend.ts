export interface UiElement {
  text?: string;
  resourceId?: string;
  contentDescription?: string;
  className?: string;
  bounds?: { left: number; top: number; right: number; bottom: number };
  clickable?: boolean;
  enabled?: boolean;
  editable?: boolean;
  focusable?: boolean;
}
export interface UiSnapshot {
  width: number;
  height: number;
  timestamp: number;
  elements: UiElement[];
  rawXml?: string;
}

/** Common contract used by the current ADB-backed UI automation tools. */
export interface AutomationBackend {
  listDevices(): Promise<unknown>;
  screenshot(serial?: string): Promise<string>;
  snapshot(serial?: string): Promise<UiSnapshot>;
  tap(x: number, y: number, serial?: string): Promise<unknown>;
  typeText(text: string, serial?: string): Promise<unknown>;
  pressKey(key: string, serial?: string): Promise<unknown>;
}
