import { spawn } from 'node:child_process';

export interface ExecOptions { cwd?: string; env?: NodeJS.ProcessEnv; timeoutMs?: number; maxOutputBytes?: number; }
export interface ExecResult { command: string; exitCode: number; stdout: string; stderr: string; durationMs: number; }

export async function execFile(command: string, args: string[] = [], options: ExecOptions = {}): Promise<ExecResult> {
  const started = Date.now();
  const max = options.maxOutputBytes ?? 4 * 1024 * 1024;
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: options.cwd, env: options.env ?? process.env, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = ''; let bytes = 0; let settled = false;
    const finish = (error?: Error, code = -1) => { if (settled) return; settled = true; clearTimeout(timer); if (error) reject(error); else resolve({ command: [command, ...args].join(' '), exitCode: code, stdout, stderr, durationMs: Date.now() - started }); };
    const collect = (target: 'stdout' | 'stderr') => (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > max) { child.kill(); finish(new Error(`Command output exceeded ${max} bytes`)); return; }
      if (target === 'stdout') stdout += chunk.toString('utf8'); else stderr += chunk.toString('utf8');
    };
    child.stdout.on('data', collect('stdout')); child.stderr.on('data', collect('stderr'));
    child.once('error', (err) => finish(err));
    child.once('close', (code) => finish(undefined, code ?? -1));
    const timer = setTimeout(() => { child.kill(); finish(new Error(`Command timed out after ${options.timeoutMs}ms`)); }, options.timeoutMs ?? 120000);
  });
}
