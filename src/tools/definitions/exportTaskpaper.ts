import { z } from 'zod';
import { exportTaskpaper } from '../primitives/exportTaskpaper.js';
import { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import { writeFileSync } from 'fs';

export const schema = z.object({
  recordId: z.string().optional().describe("The ID of a project, folder, or task to export. If a task ID is provided, exports its containing project. Omit to export entire database."),
  hideCompleted: z.boolean().optional().describe("Hide completed items (default: true)"),
  filePath: z.string().optional().describe("Optional file path to save the TaskPaper output")
});

export async function handler(args: z.infer<typeof schema>, extra: RequestHandlerExtra) {
  try {
    const hideCompleted = args.hideCompleted !== false;
    const result = await exportTaskpaper(args.recordId, hideCompleted);

    if (!result.success) {
      return {
        content: [{
          type: "text" as const,
          text: `❌ ${result.error || 'Export failed'}`
        }],
        isError: true
      };
    }

    const taskpaperOutput = result.taskpaper || '';

    // If filePath is provided, save to file
    if (args.filePath) {
      try {
        writeFileSync(args.filePath, taskpaperOutput, 'utf8');
        return {
          content: [{
            type: "text" as const,
            text: `✅ TaskPaper export saved to: ${args.filePath}\n\nExported at: ${result.exportDate}`
          }]
        };
      } catch (writeError: unknown) {
        return {
          content: [{
            type: "text" as const,
            text: `Error writing to file ${args.filePath}: ${writeError instanceof Error ? writeError.message : 'Unknown error'}`
          }],
          isError: true
        };
      }
    }

    // Return TaskPaper content directly
    let output = `📝 **TaskPaper Export**\n\n`;
    output += `Exported at: ${result.exportDate}\n`;
    if (args.recordId) {
      output += `Record ID: ${args.recordId}\n`;
    }
    output += `\n---\n\n`;
    output += taskpaperOutput;

    return {
      content: [{
        type: "text" as const,
        text: output
      }]
    };
  } catch (err: unknown) {
    const error = err as Error;
    return {
      content: [{
        type: "text" as const,
        text: `Error exporting TaskPaper: ${error.message}`
      }],
      isError: true
    };
  }
}
