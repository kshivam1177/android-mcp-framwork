export interface UiElement { text?: string; resourceId?: string; className?: string; contentDescription?: string; bounds?: { left: number; top: number; right: number; bottom: number }; clickable?: boolean; enabled?: boolean; focusable?: boolean; editable?: boolean; }
export interface UiSnapshot { width: number; height: number; timestamp: number; elements: UiElement[]; rawXml?: string; }
export interface AutomationBackend {
  listDevices(): Promise<unknown>;
  screenshot(serial?: string): Promise<string>;
  snapshot(serial?: string): Promise<UiSnapshot>;
  tap(x: number, y: number, serial?: string): Promise<unknown>;
  typeText(text: string, serial?: string): Promise<unknown>;
  pressKey(key: string, serial?: string): Promise<unknown>;
}
