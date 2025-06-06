import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock the dumpDatabase function
const mockDumpDatabase = jest.fn<any>();

jest.unstable_mockModule('../../../tools/dumpDatabase.js', () => ({
  dumpDatabase: mockDumpDatabase
}));

// Import after mocking
const { handler, schema } = await import('../../../tools/definitions/dumpDatabase.js');

describe('dumpDatabase tool with record support', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should call dumpDatabase with required recordId', async () => {
    const mockDatabase = {
      exportDate: '2024-01-01T00:00:00.000Z',
      tasks: [],
      projects: {},
      folders: {},
      tags: {}
    };

    mockDumpDatabase.mockResolvedValue(mockDatabase);

    const args = {
      hideCompleted: true,
      hideRecurringDuplicates: true,
      recordId: 'folder123'
    };

    await handler(args, {} as any);

    expect(mockDumpDatabase).toHaveBeenCalledWith('folder123');
  });

  it('should call dumpDatabase with recordId when provided', async () => {
    const mockDatabase = {
      exportDate: '2024-01-01T00:00:00.000Z',
      tasks: [],
      projects: {},
      folders: {},
      tags: {}
    };

    mockDumpDatabase.mockResolvedValue(mockDatabase);

    const args = {
      hideCompleted: true,
      hideRecurringDuplicates: true,
      recordId: 'task123'
    };

    await handler(args, {} as any);

    expect(mockDumpDatabase).toHaveBeenCalledWith('task123');
  });

  it('should validate schema correctly with recordId parameter for folder', () => {
    const validArgs = {
      hideCompleted: true,
      hideRecurringDuplicates: true,
      recordId: 'oFmFgRbvabZ'
    };

    const result = schema.safeParse(validArgs);
    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.recordId).toBe('oFmFgRbvabZ');
    }
  });

  it('should validate schema correctly with recordId parameter for project', () => {
    const validArgs = {
      hideCompleted: true,
      hideRecurringDuplicates: true,
      recordId: 'lTjzfk3zqek'
    };

    const result = schema.safeParse(validArgs);
    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.recordId).toBe('lTjzfk3zqek');
    }
  });

  it('should validate schema correctly with recordId parameter for task', () => {
    const validArgs = {
      hideCompleted: true,
      hideRecurringDuplicates: true,
      recordId: 'bOVm4rhZEpw'
    };

    const result = schema.safeParse(validArgs);
    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.recordId).toBe('bOVm4rhZEpw');
    }
  });

  it('should reject schema without recordId parameter', () => {
    const invalidArgs = {
      hideCompleted: true,
      hideRecurringDuplicates: true
    };

    const result = schema.safeParse(invalidArgs);
    expect(result.success).toBe(false);
  });

  it('should reject invalid recordId parameter', () => {
    const invalidArgs = {
      hideCompleted: true,
      hideRecurringDuplicates: true,
      recordId: 123 // Should be string
    };

    const result = schema.safeParse(invalidArgs);
    expect(result.success).toBe(false);
  });

  it('should handle database dump error', async () => {
    mockDumpDatabase.mockRejectedValue(new Error('OmniFocus not available'));

    const args = {
      hideCompleted: true,
      hideRecurringDuplicates: true,
      recordId: 'folder123'
    };

    const result = await handler(args, {} as any);

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toBe('Error generating report. Please ensure OmniFocus is running and try again.');
    expect(result.isError).toBe(true);
  });
});