import { executeOmniFocusScript } from '../../utils/scriptExecution.js';

export async function dumpInbox(): Promise<any> {
  try {
    // Execute the OmniFocus script
    const data = await executeOmniFocusScript('@omnifocusDumpInbox.js');
    
    // Wait a moment for the script to complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Create an empty result if no data returned
    if (!data) {
      return {
        exportDate: new Date().toISOString(),
        tasks: [],
        tags: {}
      };
    }
    
    // Check if it's an error response
    if (data.success === false) {
      throw new Error(data.error || 'Unknown error occurred');
    }
    
    return data;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to dump inbox: ${error.message}`);
    }
    throw new Error('Failed to dump inbox: Unknown error');
  }
}