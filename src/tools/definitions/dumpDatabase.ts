import { z } from 'zod';
import { writeFileSync } from 'fs';
import { dumpDatabase } from '../dumpDatabase.js';
import { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import { formatDateTime } from './formatDateTime.js';

export const schema = z.object({
  hideCompleted: z.boolean().optional().describe("Set to false to show completed and dropped tasks (default: true)"),
  hideRecurringDuplicates: z.boolean().optional().describe("Set to true to hide duplicate instances of recurring tasks (default: true)"),
  projectsOnly: z.boolean().optional().describe("Set to true to export only projects without their tasks or subtasks (default: false)"),
  recordId: z.string().describe("Record ID (folder, project, or task) to use as root for the dump tree. Use list_folders to get folder IDs or get_task_details to find task/project IDs."),
  filePath: z.string().optional().describe("Optional file path to save the database dump output (should be a .txt file, e.g., /tmp/omnifocus-dump.txt)")
});

export async function handler(args: z.infer<typeof schema>, extra: RequestHandlerExtra) {
  try {
    // Get raw database - pass recordId and hideCompleted
    const database = await dumpDatabase(args.recordId, args.hideCompleted !== false);

    // Format as compact report
    const formattedReport = formatCompactReport(database, {
      hideCompleted: args.hideCompleted !== false, // Default to true
      hideRecurringDuplicates: args.hideRecurringDuplicates !== false, // Default to true
      projectsOnly: args.projectsOnly === true // Default to false
    });

    // If filePath is provided, save to file
    if (args.filePath) {
      try {
        writeFileSync(args.filePath, formattedReport, 'utf8');
        return {
          content: [{
            type: "text" as const,
            text: `Database dump successfully saved to: ${args.filePath}`
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
        text: `Error generating report. Please ensure OmniFocus is running and try again.`
      }],
      isError: true
    };
  }
}

// Function to format the database in the compact report format
function formatCompactReport(database: any, options: { hideCompleted: boolean, hideRecurringDuplicates: boolean, projectsOnly: boolean }): string {
  const { hideCompleted, hideRecurringDuplicates, projectsOnly } = options;

  // Get current date for the header
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];

  let output = `# OMNIFOCUS [${dateStr}]\n\n`;

  // Add legend
  output += `FORMAT LEGEND:
F: Folder | P: Project | P✓: Completed Project | P✗: Dropped Project
•: Task | ✓: Completed Task | ✗: Dropped Task | 🚩: Flagged
IDs: [abc123] | Dates: [DUE:YYYY-MM-DD or YYYY-MM-DD HH:mm] [defer:YYYY-MM-DD or YYYY-MM-DD HH:mm] [add:YYYY-MM-DD or YYYY-MM-DD HH:mm] [mod:YYYY-MM-DD or YYYY-MM-DD HH:mm] [rev:YYYY-MM-DD or YYYY-MM-DD HH:mm] | Duration: (30m) or (2h) | Tags: <tag1,tag2>\n\n`;

  // Map of folder IDs to folder objects for quick lookup
  const folderMap = new Map();
  Object.values(database.folders).forEach((folder: any) => {
    folderMap.set(folder.id, folder);
  });



  // Function to get folder hierarchy path
  function getFolderPath(folderId: string): string[] {
    const path = [];
    let currentId = folderId;

    while (currentId) {
      const folder = folderMap.get(currentId);
      if (!folder) break;

      path.unshift(folder.name);
      currentId = folder.parentFolderID;
    }

    return path;
  }

  // Get root folders (no parent)
  const rootFolders = Object.values(database.folders).filter((folder: any) => !folder.parentFolderID);

  // Process folders recursively
  function processFolder(folder: any, level: number): string {
    const indent = '   '.repeat(level);
    let folderOutput = `${indent}F: ${folder.name} [${folder.id}]\n`;

    // Process subfolders
    if (folder.subfolders && folder.subfolders.length > 0) {
      for (const subfolderId of folder.subfolders) {
        const subfolder = database.folders[subfolderId];
        if (subfolder) {
          folderOutput += `${processFolder(subfolder, level + 1)}`;
        }
      }
    }

    // Process projects in this folder
    if (folder.projects && folder.projects.length > 0) {
      for (const projectId of folder.projects) {
        const project = database.projects[projectId];
        if (project) {
          folderOutput += processProject(project, level + 1);
        }
      }
    }

    return folderOutput;
  }

  // Process a project
  function processProject(project: any, level: number): string {
    const indent = '   '.repeat(level);

    // Skip if it's completed or dropped and we're hiding completed items
    if (hideCompleted && (project.status === 'Done' || project.status === 'Dropped')) {
      return '';
    }

    // Determine project symbol based on status
    let projectSymbol = 'P:'; // Default for active projects
    if (project.status === 'Done') {
      projectSymbol = 'P✓:';
    } else if (project.status === 'Dropped') {
      projectSymbol = 'P✗:';
    }

    // Format project status info
    let statusInfo = '';
    if (project.status === 'OnHold') {
      statusInfo = ' [OnHold]';
    }

    // Add due date if present
    if (project.dueDate) {
      const dueDateStr = formatDateTime(project.dueDate);
      statusInfo += statusInfo ? ` [DUE:${dueDateStr}]` : ` [DUE:${dueDateStr}]`;
    }

    // Add creation date if present
    if (project.creationDate) {
      const createdDateStr = formatDateTime(project.creationDate);
      statusInfo += ` [add:${createdDateStr}]`;
    }

    // Add modification date if present
    if (project.modificationDate) {
      const modifiedDateStr = formatDateTime(project.modificationDate);
      statusInfo += ` [mod:${modifiedDateStr}]`;
    }

    // Add last review date if present
    if (project.lastReviewDate) {
      const reviewedDateStr = formatDateTime(project.lastReviewDate);
      statusInfo += ` [rev:${reviewedDateStr}]`;
    }

    // Add flag if present
    const flaggedSymbol = project.flagged ? ' 🚩' : '';

    // Add project ID
    const projectId = ` [${project.id}]`;

    let projectOutput = `${indent}${projectSymbol} ${project.name}${flaggedSymbol}${projectId}${statusInfo}\n`;

    // Only process tasks if projectsOnly is false
    if (!projectsOnly) {
      // Find the root task of the project (task with same ID as project)
      const rootTask = database.tasks.find((task: any) => task.id === project.id);
      
      if (rootTask && rootTask.childIds && rootTask.childIds.length > 0) {
        // If root task exists and has children, process only its children (skip the root task itself)
        const childTasks = database.tasks.filter((t: any) => rootTask.childIds.includes(t.id));
        for (const childTask of childTasks) {
          projectOutput += processTask(childTask, level + 1);
        }
      } else if (!rootTask) {
        // If no root task, process direct children of the project
        const projectTasks = database.tasks.filter((task: any) =>
          task.projectId === project.id && task.parentId === project.id
        );

        for (const task of projectTasks) {
          projectOutput += processTask(task, level + 1);
        }
      }
    }

    return projectOutput;
  }

  // Process a task
  function processTask(task: any, level: number): string {
    const indent = '   '.repeat(level);

    // Skip if it's completed or dropped and we're hiding completed items
    if (hideCompleted && (task.completed || task.taskStatus === 'Completed' || task.taskStatus === 'Dropped')) {
      return '';
    }

    // Determine task symbol based on status
    let taskSymbol = '•'; // Default for active tasks
    if (task.completed || task.taskStatus === 'Completed') {
      taskSymbol = '✓';
    } else if (task.taskStatus === 'Dropped') {
      taskSymbol = '✗';
    }
    
    // Flag symbol
    const flagSymbol = task.flagged ? '🚩 ' : '';

    // Format dates
    let dateInfo = '';
    if (task.dueDate) {
      const dueDateStr = formatDateTime(task.dueDate);
      dateInfo += ` [DUE:${dueDateStr}]`;
    }
    if (task.deferDate) {
      const deferDateStr = formatDateTime(task.deferDate);
      dateInfo += ` [defer:${deferDateStr}]`;
    }
    if (task.creationDate) {
      const createdDateStr = formatDateTime(task.creationDate);
      dateInfo += ` [add:${createdDateStr}]`;
    }
    if (task.modificationDate) {
      const modifiedDateStr = formatDateTime(task.modificationDate);
      dateInfo += ` [mod:${modifiedDateStr}]`;
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


    // Add task ID
    const taskId = ` [${task.id}]`;

    let taskOutput = `${indent}${taskSymbol} ${flagSymbol}${task.name}${taskId}${dateInfo}${durationStr}${tagsStr}\n`;

    // Process subtasks
    if (task.childIds && task.childIds.length > 0) {
      const childTasks = database.tasks.filter((t: any) => task.childIds.includes(t.id));

      for (const childTask of childTasks) {
        taskOutput += processTask(childTask, level + 1);
      }
    }

    return taskOutput;
  }

  // Process all root folders
  for (const folder of rootFolders) {
    output += processFolder(folder, 0);
  }

  // Process projects not in any folder (if any)
  const rootProjects = Object.values(database.projects).filter((project: any) => !project.folderID);

  for (const project of rootProjects) {
    output += processProject(project, 0);
  }

  // Special handling: If we have tasks but no output yet (e.g., when dumping a specific task)
  // This happens when dumping a non-root task directly
  // Only process tasks if projectsOnly is false
  if (!projectsOnly && database.tasks.length > 0 && output.indexOf('•') === -1) {
    // Find tasks that don't have a parent in the current task list
    const taskIds = new Set(database.tasks.map((t: any) => t.id));
    const projectIds = new Set(Object.keys(database.projects));

    const rootTasksInDump = database.tasks.filter((task: any) => {
      // A task is considered root in this dump if:
      // 1. It has no parent, OR
      // 2. Its parent is not in the current task list (might be a project or a task outside the dump), OR
      // 3. Its parent is a project (parentId matches a project ID)
      return !task.parentId ||
             !taskIds.has(task.parentId) ||
             projectIds.has(task.parentId);
    });

    // Process these tasks directly
    for (const task of rootTasksInDump) {
      output += processTask(task, 0);
    }
  }

  return output;
}
