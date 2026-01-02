import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock the dumpInbox function
const mockDumpInbox = jest.fn<any>();

jest.unstable_mockModule('../../../tools/primitives/dumpInbox.js', () => ({
  dumpInbox: mockDumpInbox
}));

// Import after mocking
const { handler, schema } = await import('../../../tools/definitions/dumpInbox.js');

describe('dumpInbox tool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should call dumpInbox and format the output', async () => {
    const mockInboxData = {
      exportDate: '2024-01-01T00:00:00.000Z',
      tasks: [
        {
          id: 'task123',
          name: 'Test inbox task',
          note: 'Test note',
          taskStatus: 'Available',
          flagged: false,
          dueDate: null,
          deferDate: null,
          effectiveDueDate: null,
          effectiveDeferDate: null,
          estimatedMinutes: 30,
          completedByChildren: false,
          sequential: false,
          tags: [],
          tagNames: [],
          projectId: null,
          parentId: null,
          childIds: [],
          inInbox: true
        }
      ],
      tags: {}
    };

    mockDumpInbox.mockResolvedValue(mockInboxData);

    const args = {
      hideCompleted: true,
      hideRecurringDuplicates: true
    };

    const result = await handler(args, {} as any);

    expect(mockDumpInbox).toHaveBeenCalled();
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toContain('OMNIFOCUS INBOX');
    expect(result.content[0].text).toContain('Test inbox task');
  });

  it('should format date fields with year and time', async () => {
    const mockInboxData = {
      exportDate: '2024-01-01T00:00:00.000Z',
      tasks: [
        {
          id: 'task123',
          name: 'Time-sensitive inbox task',
          taskStatus: 'Available',
          flagged: false,
          dueDate: '2027-01-31T14:00:00.000Z',
          deferDate: '2026-06-01T09:00:00.000Z',
          creationDate: '2025-02-25T15:45:00.000Z',
          modificationDate: '2025-02-26T16:30:00.000Z',
          estimatedMinutes: 30,
          tagNames: [],
          parentId: null,
          childIds: [],
          inInbox: true
        }
      ],
      tags: {}
    };

    mockDumpInbox.mockResolvedValue(mockInboxData);

    const args = {
      hideCompleted: true,
      hideRecurringDuplicates: true,
      hideDeferred: false
    };

    const result = await handler(args, {} as any);
    const output = result.content[0].text;

    expect(output).toMatch(/\[DUE:\d{4}-\d{2}-\d{2} \d{2}:\d{2}\]/);
    expect(output).toMatch(/\[defer:\d{4}-\d{2}-\d{2} \d{2}:\d{2}\]/);
    expect(output).toMatch(/\[add:\d{4}-\d{2}-\d{2} \d{2}:\d{2}\]/);
    expect(output).toMatch(/\[mod:\d{4}-\d{2}-\d{2} \d{2}:\d{2}\]/);
  });

  it('should format date fields without time when time component is missing', async () => {
    const localMidnight = new Date(2026, 0, 2, 0, 0, 0, 0).toISOString();
    const mockInboxData = {
      exportDate: '2024-01-01T00:00:00.000Z',
      tasks: [
        {
          id: 'task123',
          name: 'Date-only inbox task',
          taskStatus: 'Available',
          flagged: false,
          dueDate: localMidnight,
          estimatedMinutes: 30,
          tagNames: [],
          parentId: null,
          childIds: [],
          inInbox: true
        }
      ],
      tags: {}
    };

    mockDumpInbox.mockResolvedValue(mockInboxData);

    const args = {
      hideCompleted: true,
      hideRecurringDuplicates: true,
      hideDeferred: false
    };

    const result = await handler(args, {} as any);
    const output = result.content[0].text;

    expect(output).toContain('[DUE:2026-01-02]');
    expect(output).not.toContain('2026-01-02 00:00');
  });

  it('should handle empty inbox', async () => {
    const mockInboxData = {
      exportDate: '2024-01-01T00:00:00.000Z',
      tasks: [],
      tags: {}
    };

    mockDumpInbox.mockResolvedValue(mockInboxData);

    const args = {
      hideCompleted: true,
      hideRecurringDuplicates: true
    };

    const result = await handler(args, {} as any);

    expect(mockDumpInbox).toHaveBeenCalled();
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toContain('No tasks in inbox');
  });

  it('should hide completed tasks when hideCompleted is true', async () => {
    const mockInboxData = {
      exportDate: '2024-01-01T00:00:00.000Z',
      tasks: [
        {
          id: 'task1',
          name: 'Active task',
          taskStatus: 'Available',
          flagged: false,
          parentId: null,
          childIds: [],
          inInbox: true
        },
        {
          id: 'task2',
          name: 'Completed task',
          taskStatus: 'Completed',
          flagged: false,
          parentId: null,
          childIds: [],
          inInbox: true
        }
      ],
      tags: {}
    };

    mockDumpInbox.mockResolvedValue(mockInboxData);

    const args = {
      hideCompleted: true,
      hideRecurringDuplicates: true
    };

    const result = await handler(args, {} as any);

    expect(result.content[0].text).toContain('Active task');
    expect(result.content[0].text).not.toContain('Completed task');
  });

  it('should show completed tasks when hideCompleted is false', async () => {
    const mockInboxData = {
      exportDate: '2024-01-01T00:00:00.000Z',
      tasks: [
        {
          id: 'task1',
          name: 'Active task',
          taskStatus: 'Available',
          flagged: false,
          parentId: null,
          childIds: [],
          inInbox: true
        },
        {
          id: 'task2',
          name: 'Completed task',
          taskStatus: 'Completed',
          flagged: false,
          parentId: null,
          childIds: [],
          inInbox: true
        }
      ],
      tags: {}
    };

    mockDumpInbox.mockResolvedValue(mockInboxData);

    const args = {
      hideCompleted: false,
      hideRecurringDuplicates: true
    };

    const result = await handler(args, {} as any);

    expect(result.content[0].text).toContain('Active task');
    expect(result.content[0].text).toContain('Completed task');
  });

  it('should validate schema correctly', () => {
    const validArgs = {
      hideCompleted: true,
      hideRecurringDuplicates: true
    };

    const result = schema.safeParse(validArgs);
    expect(result.success).toBe(true);
  });

  it('should accept empty args with defaults', () => {
    const emptyArgs = {};

    const result = schema.safeParse(emptyArgs);
    expect(result.success).toBe(true);
  });

  it('should reject invalid hideCompleted parameter', () => {
    const invalidArgs = {
      hideCompleted: 'true', // Should be boolean
      hideRecurringDuplicates: true
    };

    const result = schema.safeParse(invalidArgs);
    expect(result.success).toBe(false);
  });

  it('should hide deferred tasks when hideDeferred is true', async () => {
    const mockInboxData = {
      exportDate: '2024-01-01T00:00:00.000Z',
      tasks: [
        {
          id: 'task1',
          name: 'Active task',
          taskStatus: 'Available',
          flagged: false,
          deferDate: null,
          parentId: null,
          childIds: [],
          inInbox: true
        },
        {
          id: 'task2',
          name: 'Deferred task',
          taskStatus: 'Available',
          flagged: false,
          deferDate: '2099-01-01T00:00:00.000Z', // Future date
          parentId: null,
          childIds: [],
          inInbox: true
        }
      ],
      tags: {}
    };

    mockDumpInbox.mockResolvedValue(mockInboxData);

    const args = {
      hideCompleted: true,
      hideRecurringDuplicates: true,
      hideDeferred: true
    };

    const result = await handler(args, {} as any);

    expect(result.content[0].text).toContain('Active task');
    expect(result.content[0].text).not.toContain('Deferred task');
  });

  it('should show deferred tasks when hideDeferred is false', async () => {
    const mockInboxData = {
      exportDate: '2024-01-01T00:00:00.000Z',
      tasks: [
        {
          id: 'task1',
          name: 'Active task',
          taskStatus: 'Available',
          flagged: false,
          deferDate: null,
          parentId: null,
          childIds: [],
          inInbox: true
        },
        {
          id: 'task2',
          name: 'Deferred task',
          taskStatus: 'Available',
          flagged: false,
          deferDate: '2099-01-01T00:00:00.000Z', // Future date
          parentId: null,
          childIds: [],
          inInbox: true
        }
      ],
      tags: {}
    };

    mockDumpInbox.mockResolvedValue(mockInboxData);

    const args = {
      hideCompleted: true,
      hideRecurringDuplicates: true,
      hideDeferred: false
    };

    const result = await handler(args, {} as any);

    expect(result.content[0].text).toContain('Active task');
    expect(result.content[0].text).toContain('Deferred task');
  });

  it('should handle inbox dump error', async () => {
    mockDumpInbox.mockRejectedValue(new Error('OmniFocus not available'));

    const args = {
      hideCompleted: true,
      hideRecurringDuplicates: true
    };

    const result = await handler(args, {} as any);

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toBe('Error generating inbox report. Please ensure OmniFocus is running and try again.');
    expect(result.isError).toBe(true);
  });
});
