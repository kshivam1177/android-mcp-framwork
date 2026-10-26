import { spawn } from 'node:child_process';
import { AndroidBuildMcpError } from '../types.js';
import type { ExecResult } from '../types.js';

export interface ExecOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  /** Piped to the child's stdin, then the stream is closed. */
  input?: string;
}

const DEFAULT_TIMEOUT_MS = 120_000;

/**
 * Run a command with an argv array - never through a shell, so there is no
 * string-interpolation / injection surface. Always resolves with the full
 * result, including non-zero exit codes; callers decide what "failed" means
 * for their specific command (adb/gradle/etc wrap this and throw typed
 * AndroidBuildMcpErrors when appropriate).
 */
export function execCommand(command: string, args: string[], options: ExecOptions = {}): Promise<ExecResult> {
  const start = Date.now();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const displayCommand = [command, ...args].join(' ');

  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(command, args, {
        cwd: options.cwd,
        env: options.env ?? process.env,
        shell: false,
      });
    } catch (err) {
      reject(
        new AndroidBuildMcpError('COMMAND_FAILED', `Failed to start command: ${displayCommand} (${(err as Error).message})`, {
          command: displayCommand,
        })
      );
      return;
    }

    let stdout = '';
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGKILL');
      reject(
        new AndroidBuildMcpError('TIMEOUT', `Command timed out after ${timeoutMs}ms: ${displayCommand}`, {
          command: displayCommand,
          timeoutMs,
        })
      );
    }, timeoutMs);

    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });

    child.on('error', (err: NodeJS.ErrnoException) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (err.code === 'ENOENT') {
        reject(
          new AndroidBuildMcpError('COMMAND_FAILED', `Executable not found on PATH: ${command}`, {
            command: displayCommand,
          })
        );
        return;
      }
      reject(
        new AndroidBuildMcpError('COMMAND_FAILED', `Failed to run command: ${displayCommand} (${err.message})`, {
          command: displayCommand,
        })
      );
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        stdout,
        stderr,
        exitCode: code ?? -1,
        command: displayCommand,
        durationMs: Date.now() - start,
      });
    });

    if (options.input !== undefined) {
      child.stdin?.write(options.input);
    }
    child.stdin?.end();
  });
}

export interface ExecBinaryResult {
  stdout: Buffer;
  stderr: string;
  exitCode: number;
  command: string;
  durationMs: number;
}

/**
 * Same contract as execCommand, but stdout is accumulated as Buffer chunks
 * instead of being decoded as utf8 along the way. Required for anything
 * binary - screenshots (`exec-out screencap -p`), pulled files, etc. Using
 * the string-based execCommand for binary data silently corrupts bytes.
 */
export function execCommandBinary(command: string, args: string[], options: ExecOptions = {}): Promise<ExecBinaryResult> {
  const start = Date.now();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const displayCommand = [command, ...args].join(' ');

  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(command, args, {
        cwd: options.cwd,
        env: options.env ?? process.env,
        shell: false,
      });
    } catch (err) {
      reject(
        new AndroidBuildMcpError('COMMAND_FAILED', `Failed to start command: ${displayCommand} (${(err as Error).message})`, {
          command: displayCommand,
        })
      );
      return;
    }

    const stdoutChunks: Buffer[] = [];
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGKILL');
      reject(
        new AndroidBuildMcpError('TIMEOUT', `Command timed out after ${timeoutMs}ms: ${displayCommand}`, {
          command: displayCommand,
          timeoutMs,
        })
      );
    }, timeoutMs);

    child.stdout?.on('data', (chunk: Buffer) => {
      stdoutChunks.push(chunk);
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });

    child.on('error', (err: NodeJS.ErrnoException) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (err.code === 'ENOENT') {
        reject(
          new AndroidBuildMcpError('COMMAND_FAILED', `Executable not found on PATH: ${command}`, {
            command: displayCommand,
          })
        );
        return;
      }
      reject(
        new AndroidBuildMcpError('COMMAND_FAILED', `Failed to run command: ${displayCommand} (${err.message})`, {
          command: displayCommand,
        })
      );
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        stdout: Buffer.concat(stdoutChunks),
        stderr,
        exitCode: code ?? -1,
        command: displayCommand,
        durationMs: Date.now() - start,
      });
    });

    child.stdin?.end();
  });
}
