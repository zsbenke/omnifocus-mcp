import { z } from 'zod';
import { listFolders } from '../listFolders.js';
import { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';

export const schema = z.object({});

export async function handler(args: z.infer<typeof schema>, extra: RequestHandlerExtra) {
  try {
    const result = await listFolders();
    
    if (!result.success || !result.folders) {
      return {
        content: [{
          type: "text" as const,
          text: `Error listing folders: ${result.error || 'Unknown error'}`
        }],
        isError: true
      };
    }
    
    // Format the folder list
    let output = `# OmniFocus Folders\n\n`;
    output += `Total folders: ${result.totalCount}\n\n`;
    
    if (result.folders.length === 0) {
      output += `No folders found in OmniFocus.\n`;
    } else {
      // Group folders by hierarchy
      const rootFolders = result.folders.filter(f => !f.parentId);
      
      function formatFolder(folder: any, allFolders: any[], indent: string = ''): string {
        let text = `${indent}📁 ${folder.name}`;
        
        // Add folder statistics
        if (folder.projectCount > 0 || folder.taskCount > 0) {
          text += ` (${folder.projectCount} projects, ${folder.taskCount} tasks)`;
        }
        
        text += ` [${folder.id}]\n`;
        
        // Find and format subfolders
        const subfolders = allFolders.filter(f => f.parentId === folder.id);
        for (const subfolder of subfolders) {
          text += formatFolder(subfolder, allFolders, indent + '  ');
        }
        
        return text;
      }
      
      // Format root folders and their children
      for (const folder of rootFolders) {
        output += formatFolder(folder, result.folders);
      }
      
      output += `\n## How to use folders with dump_database:\n`;
      output += `1. Use dump_database without parameters to dump everything (may hit token limits)\n`;
      output += `2. Use dump_database with folder_id parameter to dump a specific folder:\n`;
      output += `   Example: dump_database(folder_id="abc123")\n`;
      output += `3. The folder dump will include all projects, tasks, and subfolders within that folder\n`;
    }
    
    return {
      content: [{
        type: "text" as const,
        text: output
      }]
    };
  } catch (err: unknown) {
    return {
      content: [{
        type: "text" as const,
        text: `Error listing folders. Please ensure OmniFocus is running and try again.`
      }],
      isError: true
    };
  }
}