import { executeOmniFocusScript } from '../utils/scriptExecution.js';

export interface OmnifocusFolder {
  id: string;
  name: string;
  path: string;
  parentId: string | null;
  projectCount: number;
  taskCount: number;
  hasSubfolders: boolean;
}

export interface ListFoldersResult {
  success: boolean;
  folders?: OmnifocusFolder[];
  totalCount?: number;
  error?: string;
}

export async function listFolders(): Promise<ListFoldersResult> {
  try {
    const result = await executeOmniFocusScript('@listFolders.js') as ListFoldersResult;
    
    if (!result || !result.success) {
      return {
        success: false,
        error: result?.error || 'Failed to list folders'
      };
    }
    
    return result;
  } catch (error) {
    console.error("Error in listFolders:", error);
    return {
      success: false,
      error: `Error listing folders: ${error}`
    };
  }
}