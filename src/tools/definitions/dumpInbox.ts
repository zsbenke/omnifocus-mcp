import { z } from 'zod';
import { dumpInbox } from '../primitives/dumpInbox.js';
import { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';

export const schema = z.object({
  hideCompleted: z.boolean().optional().describe("Set to false to show completed and dropped tasks (default: true)"),
  hideRecurringDuplicates: z.boolean().optional().describe("Set to true to hide duplicate instances of recurring tasks (default: true)"),
  hideDeferred: z.boolean().optional().describe("Set to false to show deferred tasks (default: true)")
});

export async function handler(args: z.infer<typeof schema>, extra: RequestHandlerExtra) {
  try {
    // Get inbox tasks
    const inboxData = await dumpInbox();

    // Format as compact report
    const formattedReport = formatInboxReport(inboxData, {
      hideCompleted: args.hideCompleted !== false, // Default to true
      hideRecurringDuplicates: args.hideRecurringDuplicates !== false, // Default to true
      hideDeferred: args.hideDeferred !== false // Default to true
    });

    return {
      content: [{
        type: "text" as const,
        text: formattedReport
      }]
    };
  } catch (err: unknown) {
    return {
      content: [{
        type: "text" as const,
        text: `Error generating inbox report. Please ensure OmniFocus is running and try again.`
      }],
      isError: true
    };
  }
}

// Function to format date in compact format (M/D)
function formatCompactDate(isoDate: string | null): string {
  if (!isoDate) return '';

  const date = new Date(isoDate);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

// Function to format the inbox in the compact report format
function formatInboxReport(inboxData: any, options: { hideCompleted: boolean, hideRecurringDuplicates: boolean, hideDeferred: boolean }): string {
  const { hideCompleted, hideRecurringDuplicates, hideDeferred } = options;

  // Get current date for the header
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];

  let output = `# OMNIFOCUS INBOX [${dateStr}]\n\n`;

  // Add legend
  output += `FORMAT LEGEND:
•: Task | 🚩: Flagged
IDs: [abc123] | Dates: [M/D] | Duration: (30m) or (2h) | Tags: <tag1,tag2>
Status: #next #avail #block #due #over #compl #drop\n\n`;



  // Process top-level inbox tasks (no parent)
  const topLevelTasks = inboxData.tasks.filter((task: any) => !task.parentId);

  if (topLevelTasks.length === 0) {
    output += "No tasks in inbox.\n";
    return output;
  }

  // Process a task
  function processTask(task: any, level: number): string {
    const indent = '   '.repeat(level);

    // Skip if it's completed or dropped and we're hiding completed items
    if (hideCompleted && (task.completed || task.taskStatus === 'Completed' || task.taskStatus === 'Dropped')) {
      return '';
    }

    // Skip if it has a defer date and we're hiding deferred items
    if (hideDeferred && task.deferDate) {
      const deferDate = new Date(task.deferDate);
      const now = new Date();
      if (deferDate > now) {
        return '';
      }
    }

    // Flag symbol
    const flagSymbol = task.flagged ? '🚩 ' : '';

    // Format dates
    let dateInfo = '';
    if (task.dueDate) {
      const dueDateStr = formatCompactDate(task.dueDate);
      dateInfo += ` [DUE:${dueDateStr}]`;
    }
    if (task.deferDate) {
      const deferDateStr = formatCompactDate(task.deferDate);
      dateInfo += ` [defer:${deferDateStr}]`;
    }

    // Format duration
    let durationStr = '';
    if (task.estimatedMinutes) {
      // Convert to hours if >= 60 minutes
      if (task.estimatedMinutes >= 60) {
        const hours = Math.floor(task.estimatedMinutes / 60);
        durationStr = ` (${hours}h)`;
      } else {
        durationStr = ` (${task.estimatedMinutes}m)`;
      }
    }

    // Format tags
    let tagsStr = '';
    if (task.tagNames && task.tagNames.length > 0) {
      tagsStr = ` <${task.tagNames.join(',')}>`;
    }

    // Format status
    let statusStr = '';
    switch (task.taskStatus) {
      case 'Next':
        statusStr = ' #next';
        break;
      case 'Available':
        statusStr = ' #avail';
        break;
      case 'Blocked':
        statusStr = ' #block';
        break;
      case 'DueSoon':
        statusStr = ' #due';
        break;
      case 'Overdue':
        statusStr = ' #over';
        break;
      case 'Completed':
        statusStr = ' #compl';
        break;
      case 'Dropped':
        statusStr = ' #drop';
        break;
    }

    // Add task ID
    const taskId = ` [${task.id}]`;

    let taskOutput = `${indent}• ${flagSymbol}${task.name}${taskId}${dateInfo}${durationStr}${tagsStr}${statusStr}\n`;

    // Process subtasks
    if (task.childIds && task.childIds.length > 0) {
      const childTasks = inboxData.tasks.filter((t: any) => task.childIds.includes(t.id));

      for (const childTask of childTasks) {
        taskOutput += processTask(childTask, level + 1);
      }
    }

    return taskOutput;
  }

  // Process all top-level inbox tasks
  for (const task of topLevelTasks) {
    output += processTask(task, 0);
  }

  return output;
}

