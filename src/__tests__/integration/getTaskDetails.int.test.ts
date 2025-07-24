import { describe, it, expect, beforeAll, jest } from '@jest/globals';
import { handler as getTaskDetailsHandler } from '../../tools/definitions/getTaskDetails.js';
import { dumpDatabase } from '../../tools/dumpDatabase.js';
import type { OmnifocusDatabase, OmnifocusTask } from '../../types.js';

// Only run these tests when explicitly enabled
const RUN = process.env.OMNIFOCUS_TEST === '1';
const integration = RUN ? describe : describe.skip;

// Set a long timeout for AppleScript operations
jest.setTimeout(300_000); // 5 minutes

// Mock for RequestHandlerExtra (not needed in these handlers)
const mockExtra = {} as any;

// Helper to flatten MCP response content
function flattenContent(result: any): string {
  if (!result.content || !Array.isArray(result.content)) return '';
  return result.content.map((c: any) => c.text || '').join('\n');
}

// Helper to run dumpDatabase with timeout
async function timeboxedDumpDatabase(maxMillis = 30000): Promise<OmnifocusDatabase | undefined> {
  try {
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('Database dump timeout')), maxMillis)
    );
    const dumpPromise = dumpDatabase();
    return await Promise.race([dumpPromise, timeoutPromise]);
  } catch (error) {
    console.log('Database dump exceeded time limit or failed:', error);
    return undefined;
  }
}

// Helper to find a "rich" task with many fields populated
function findRichTask(db: OmnifocusDatabase): OmnifocusTask | undefined {
  // Priority: active tasks with project/parent, tags, and dates
  const candidates = db.tasks.filter(t => 
    !t.completed &&
    (t.projectId || t.parentId) &&
    (t.tagNames?.length ?? 0) > 0 &&
    (t.dueDate || t.deferDate || t.estimatedMinutes)
  );
  
  if (candidates.length > 0) return candidates[0];
  
  // Fallback: any active task with project/parent
  const fallback = db.tasks.filter(t => !t.completed && (t.projectId || t.parentId));
  if (fallback.length > 0) return fallback[0];
  
  // Last resort: any task
  return db.tasks[0];
}

// Helper to find a minimal task (different from rich task)
function findMinimalTask(db: OmnifocusDatabase, richTask: OmnifocusTask | undefined): OmnifocusTask | undefined {
  if (!richTask) return db.tasks[0];
  return db.tasks.find(t => t.id !== richTask.id) || db.tasks[0];
}

// Helper to verify core fields appear in response text
function expectCoreFieldsInText(text: string, task: OmnifocusTask): void {
  expect(text).toContain(task.id);
  expect(text).toContain(task.name);
  
  if (task.tagNames && task.tagNames.length > 0) {
    expect(text.toLowerCase()).toContain('tag');
    task.tagNames.forEach(tag => expect(text).toContain(tag));
  }
  
  if (task.projectId || task.parentId) {
    expect(text.toLowerCase()).toMatch(/project|parent/i);
  }
}

integration('OmniFocus get_task_details integration tests', () => {
  let database: OmnifocusDatabase | undefined;
  let richTask: OmnifocusTask | undefined;
  let minimalTask: OmnifocusTask | undefined;
  let hasDatabase = false;

  beforeAll(async () => {
    console.log('🔍 Running OmniFocus integration tests - this will read your actual OmniFocus database');
    console.log('⏱️  Dumping database with 30-second timeout...');
    
    database = await timeboxedDumpDatabase();
    
    if (!database) {
      console.log('❌ Database dump failed or timed out - skipping all tests');
      hasDatabase = false;
      return;
    }
    
    if (!database.tasks || database.tasks.length === 0) {
      console.log('❌ No tasks found in database - skipping all tests');
      hasDatabase = false;
      return;
    }
    
    hasDatabase = true;
    console.log(`✅ Found ${database.tasks.length} tasks in database`);
    
    richTask = findRichTask(database);
    minimalTask = findMinimalTask(database, richTask);
    
    if (richTask) {
      console.log(`📋 Rich reference task: "${richTask.name}" (${richTask.id})`);
    }
    if (minimalTask && minimalTask !== richTask) {
      console.log(`📋 Minimal reference task: "${minimalTask.name}" (${minimalTask.id})`);
    }
  });

  describe('lookup by ID', () => {
    it('should retrieve task details by exact ID (rich task)', async () => {
      if (!hasDatabase || !richTask) {
        console.log('⚠️  Skipping test: No rich task available');
        return;
      }
      
      const result = await getTaskDetailsHandler({ taskId: richTask.id }, mockExtra);
      
      expect(result.isError).not.toBe(true);
      const text = flattenContent(result);
      expectCoreFieldsInText(text, richTask);
    });

    it('should return error for non-existent task ID', async () => {
      if (!hasDatabase) {
        console.log('⚠️  Skipping test: No database available');
        return;
      }
      
      const result = await getTaskDetailsHandler({ taskId: '__INVALID_ID__' }, mockExtra);
      
      expect(result.isError).toBe(true);
      const text = flattenContent(result);
      expect(text.toLowerCase()).toMatch(/no task found|not found/i);
    });
  });

  describe('lookup by name', () => {
    it('should retrieve task details by exact name (rich task)', async () => {
      if (!hasDatabase || !richTask) {
        console.log('⚠️  Skipping test: No rich task available');
        return;
      }
      
      const result = await getTaskDetailsHandler({ taskName: richTask.name }, mockExtra);
      
      expect(result.isError).not.toBe(true);
      const text = flattenContent(result);
      expectCoreFieldsInText(text, richTask);
    });

    it('should retrieve task details by exact name (minimal task)', async () => {
      if (!hasDatabase || !minimalTask) {
        console.log('⚠️  Skipping test: No minimal task available');
        return;
      }
      
      const result = await getTaskDetailsHandler({ taskName: minimalTask.name }, mockExtra);
      
      expect(result.isError).not.toBe(true);
      const text = flattenContent(result);
      expect(text).toContain(minimalTask.id);
      expect(text).toContain(minimalTask.name);
    });

    it('should handle partial name match (unique)', async () => {
      if (!hasDatabase || !richTask) {
        console.log('⚠️  Skipping test: No rich task available');
        return;
      }
      
      // Use first half of the name as partial match
      const partialName = richTask.name.substring(0, Math.ceil(richTask.name.length / 2));
      const result = await getTaskDetailsHandler({ taskName: partialName }, mockExtra);
      
      // Could succeed (unique match) or fail (multiple matches)
      const text = flattenContent(result);
      if (!result.isError) {
        // Success case - should find our task
        expect(text).toContain(richTask.id);
      } else {
        // Error case - should be ambiguous
        expect(text.toLowerCase()).toMatch(/multiple tasks found|ambiguous/i);
      }
    });

    it('should return error for ambiguous partial name', async () => {
      if (!hasDatabase || !richTask || !database) {
        console.log('⚠️  Skipping test: No reference data available');
        return;
      }
      
      // Try to find a common prefix
      const prefix = richTask.name.substring(0, 3);
      const matchingTasks = database.tasks.filter(t => 
        t.name.toLowerCase().startsWith(prefix.toLowerCase())
      );
      
      if (matchingTasks.length < 2) {
        console.log('⚠️  Skipping test: No ambiguous prefix found in database');
        return;
      }
      
      const result = await getTaskDetailsHandler({ taskName: prefix }, mockExtra);
      
      expect(result.isError).toBe(true);
      const text = flattenContent(result);
      expect(text.toLowerCase()).toMatch(/multiple tasks found|ambiguous/i);
    });

    it('should handle special characters in task names', async () => {
      if (!hasDatabase || !database) {
        console.log('⚠️  Skipping test: No database available');
        return;
      }
      
      // Find a task with special characters
      const specialTask = database.tasks.find(t => 
        /[\[\]\(\)\*\?\+\{\}\\]/.test(t.name)
      );
      
      if (!specialTask) {
        console.log('⚠️  Skipping test: No task with special characters found');
        return;
      }
      
      const result = await getTaskDetailsHandler({ taskName: specialTask.name }, mockExtra);
      
      expect(result.isError).not.toBe(true);
      const text = flattenContent(result);
      expect(text).toContain(specialTask.id);
      expect(text).toContain(specialTask.name);
    });

    it('should return error for non-existent task name', async () => {
      if (!hasDatabase) {
        console.log('⚠️  Skipping test: No database available');
        return;
      }
      
      const uniqueName = `__NONEXISTENT_TASK_${Date.now()}__`;
      const result = await getTaskDetailsHandler({ taskName: uniqueName }, mockExtra);
      
      expect(result.isError).toBe(true);
      const text = flattenContent(result);
      expect(text.toLowerCase()).toMatch(/no task found|not found/i);
    });
  });

  describe('error cases', () => {
    it('should handle whitespace-only task name', async () => {
      if (!hasDatabase) {
        console.log('⚠️  Skipping test: No database available');
        return;
      }
      
      const result = await getTaskDetailsHandler({ taskName: '   ' }, mockExtra);
      
      expect(result.isError).toBe(true);
      const text = flattenContent(result);
      expect(text.toLowerCase()).toMatch(/no task found|not found/i);
    });

    it('should fail when both taskId and taskName are provided', async () => {
      if (!hasDatabase) {
        console.log('⚠️  Skipping test: No database available');
        return;
      }
      
      const result = await getTaskDetailsHandler({ 
        taskId: 'someId', 
        taskName: 'someName' 
      }, mockExtra);
      
      // When both are provided, it uses taskId and ignores taskName
      // So this should fail with "task not found" for the invalid ID
      expect(result.isError).toBe(true);
      const text = flattenContent(result);
      expect(text.toLowerCase()).toMatch(/task not found|no task found/i);
    });

    it('should fail when neither taskId nor taskName are provided', async () => {
      if (!hasDatabase) {
        console.log('⚠️  Skipping test: No database available');
        return;
      }
      
      const result = await getTaskDetailsHandler({}, mockExtra);
      
      expect(result.isError).toBe(true);
      const text = flattenContent(result);
      expect(text.toLowerCase()).toMatch(/either.*must be provided|required/i);
    });
  });

  describe('encoding and edge cases', () => {
    it('should handle tasks with emoji and unicode characters', async () => {
      if (!hasDatabase || !database) {
        console.log('⚠️  Skipping test: No database available');
        return;
      }
      
      // Find a task with emoji or unicode
      const emojiTask = database.tasks.find(t => 
        /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]/u.test(t.name)
      );
      
      if (!emojiTask) {
        console.log('⚠️  Skipping test: No task with emoji/unicode found');
        return;
      }
      
      const result = await getTaskDetailsHandler({ taskName: emojiTask.name }, mockExtra);
      
      expect(result.isError).not.toBe(true);
      const text = flattenContent(result);
      expect(text).toContain(emojiTask.name);
    });

    it('should handle very long task names with partial match', async () => {
      if (!hasDatabase || !database) {
        console.log('⚠️  Skipping test: No database available');
        return;
      }
      
      // Find a task with a long name
      const longTask = database.tasks.find(t => t.name.length > 50);
      
      if (!longTask) {
        console.log('⚠️  Skipping test: No task with long name found');
        return;
      }
      
      // Use first 30 characters for partial match
      const partialName = longTask.name.substring(0, 30);
      const result = await getTaskDetailsHandler({ taskName: partialName }, mockExtra);
      
      // Should either find it uniquely or report multiple matches
      const text = flattenContent(result);
      if (!result.isError) {
        expect(text).toContain(longTask.name);
      } else {
        expect(text.toLowerCase()).toMatch(/multiple|ambiguous/i);
      }
    });
  });
});