import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { startRecording, saveRecordingScreenshot } from '../../automation/recorder.js';
import { withErrorHandling, textResult } from '../../utils/response.js';
import { resolveTargetAndBackend } from './_shared.js';
import type { ToolModule } from '../types.js';

export const toolName = 'start_recording';
export const workflow = 'ui-automation';

export function register(server: McpServer) {
  return server.registerTool(toolName, {
    title: 'Start UI Recording',
    description: 'Start an opt-in recording of UI actions on the selected Android device. Actions and typed text are stored in the project recording file; password/OTP-like fields are automatically redacted. Do not record credentials or secrets.',
    inputSchema: {
      flowId: z.string().min(1).max(80).regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/),
      targetId: z.string().optional(),
      projectPath: z.string().optional(),
      redactText: z.boolean().optional().default(false).describe('When true, redact all typed text. Redacted text actions cannot be replayed until replaced in the recording JSON.'),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, withErrorHandling(async (args: { flowId: string; targetId?: string; projectPath?: string; redactText?: boolean }) => {
    const { target, backend } = await resolveTargetAndBackend(args.targetId);
    const started = await startRecording({
      flowId: args.flowId,
      deviceId: target.id,
      projectRoot: args.projectPath ?? process.cwd(),
      redactText: args.redactText,
    });
    let screenshotCaptured = false;
    try {
      const screenshot = await backend.screenshot(target.id);
      await saveRecordingScreenshot('start', screenshot.data);
      screenshotCaptured = true;
    } catch {
      // Recording actions should remain available even if a device cannot provide a starting screenshot.
    }
    return textResult(`Started recording "${started.flowId}" on ${started.deviceId}.`, {
      ...started,
      screenshotCaptured,
      recordingPath: `.androidmcp-framework/recordings/${started.flowId}.json (written when recording stops)`,
    });
  }));
}

const mod: ToolModule = { toolName, workflow, register };
export default mod;
