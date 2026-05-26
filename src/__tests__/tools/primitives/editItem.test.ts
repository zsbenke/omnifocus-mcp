import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock child_process before importing the module that uses it
const mockExecAsync = jest.fn<any>();

jest.unstable_mockModule('util', () => ({
  promisify: jest.fn(() => mockExecAsync)
}));

// Import after mocking
const { editItem } = await import('../../../tools/primitives/editItem.js');

describe('editItem', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Moving a task to another project', () => {
    it('should physically move the task with "move ... to end of tasks of", not "set assigned container"', async () => {
      const mockResponse = '{"success":true,"id":"task123","name":"Test Task","changedProperties":"moved to project"}';
      mockExecAsync.mockResolvedValue({ stdout: mockResponse, stderr: '' });

      await editItem({
        itemType: 'task',
        id: 'task123',
        newProjectId: 'proj456'
      });

      const execCall = mockExecAsync.mock.calls[0];
      expect(execCall).toBeDefined();
      const script = execCall[0];

      // Resolves the destination project by id
      expect(script).toContain('first flattened project where id = "proj456"');
      // Uses the reliable move idiom that actually relocates the task
      expect(script).toContain('move foundItem to end of tasks of destProject');
      // Does NOT rely on assigning the container, which silently no-ops
      expect(script).not.toContain('set assigned container of foundItem to destProject');
    });
  });
});
