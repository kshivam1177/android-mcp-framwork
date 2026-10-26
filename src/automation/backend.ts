export interface UiElement { text?: string; resourceId?: string; contentDescription?: string; className?: string; bounds?: { left:number; top:number; right:number; bottom:number }; clickable?: boolean; enabled?: boolean; editable?: boolean; }
export interface UiSnapshot { width:number; height:number; timestamp:number; elements:UiElement[]; }
