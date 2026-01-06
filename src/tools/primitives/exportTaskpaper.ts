import { executeOmniFocusScript } from '../../utils/scriptExecution.js';

export interface ExportTaskpaperResult {
  success: boolean;
  taskpaper?: string;
  exportDate?: string;
  error?: string;
}

export async function exportTaskpaper(
  recordId?: string,
  hideCompleted: boolean = true
): Promise<ExportTaskpaperResult> {
  try {
    const scriptArgs = {
      __recordIdParam__: recordId || null,
      __hideCompletedParam__: hideCompleted
    };

    const data = await executeOmniFocusScript('@exportTaskpaper.js', scriptArgs);

    // Wait for script to complete
    await new Promise(resolve => setTimeout(resolve, 500));

    if (!data) {
      return {
        success: false,
        error: 'No data returned from OmniFocus'
      };
    }

    if (data.success === false) {
      return {
        success: false,
        error: data.error || 'Unknown error occurred'
      };
    }

    return {
      success: true,
      taskpaper: data.taskpaper,
      exportDate: data.exportDate
    };
  } catch (error) {
    if (error instanceof Error) {
      return {
        success: false,
        error: `Failed to export TaskPaper: ${error.message}`
      };
    }
    return {
      success: false,
      error: 'Failed to export TaskPaper: Unknown error'
    };
  }
}
