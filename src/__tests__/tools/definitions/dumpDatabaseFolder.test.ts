import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock the dumpDatabase function
const mockDumpDatabase = jest.fn<any>();

jest.unstable_mockModule('../../../tools/dumpDatabase.js', () => ({
  dumpDatabase: mockDumpDatabase
}));

// Import after mocking
const { handler, schema } = await import('../../../tools/definitions/dumpDatabase.js');

describe('dumpDatabase tool with folder support', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should call dumpDatabase without folderId when not provided', async () => {
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
      hideRecurringDuplicates: true
    };

    await handler(args, {} as any);

    expect(mockDumpDatabase).toHaveBeenCalledWith(undefined);
  });

  it('should call dumpDatabase with folderId when provided', async () => {
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
      folderId: 'folder123'
    };

    await handler(args, {} as any);

    expect(mockDumpDatabase).toHaveBeenCalledWith('folder123');
  });

  it('should validate schema correctly with folderId parameter', () => {
    const validArgs = {
      hideCompleted: true,
      hideRecurringDuplicates: true,
      folderId: 'folder123'
    };

    const result = schema.safeParse(validArgs);
    expect(result.success).toBe(true);
    
    if (result.success) {
      expect(result.data.folderId).toBe('folder123');
    }
  });

  it('should validate schema correctly without folderId parameter', () => {
    const validArgs = {
      hideCompleted: true,
      hideRecurringDuplicates: true
    };

    const result = schema.safeParse(validArgs);
    expect(result.success).toBe(true);
    
    if (result.success) {
      expect(result.data.folderId).toBeUndefined();
    }
  });

  it('should reject invalid folderId parameter', () => {
    const invalidArgs = {
      hideCompleted: true,
      hideRecurringDuplicates: true,
      folderId: 123 // Should be string
    };

    const result = schema.safeParse(invalidArgs);
    expect(result.success).toBe(false);
  });

  it('should handle database dump error', async () => {
    mockDumpDatabase.mockRejectedValue(new Error('OmniFocus not available'));

    const args = {
      hideCompleted: true,
      hideRecurringDuplicates: true,
      folderId: 'folder123'
    };

    const result = await handler(args, {} as any);

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toBe('Error generating report. Please ensure OmniFocus is running and try again.');
    expect(result.isError).toBe(true);
  });
});