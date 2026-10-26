const running = new Map<string, { pid?: number; startedAt: number }>();
export function registerProcess(id:string,pid?:number):void{running.set(id,{pid,startedAt:Date.now()});}
export function unregisterProcess(id:string):void{running.delete(id);}
export function listProcesses(){return [...running.entries()].map(([id,value])=>({id,...value}));}
