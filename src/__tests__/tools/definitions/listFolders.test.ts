import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock the listFolders function
const mockListFolders = jest.fn<any>();

jest.unstable_mockModule('../../../tools/listFolders.js', () => ({
  listFolders: mockListFolders
}));

// Import after mocking
const { handler } = await import('../../../tools/definitions/listFolders.js');

describe('listFolders tool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return formatted folder list when folders exist', async () => {
    const mockFoldersResult = {
      success: true,
      folders: [
        {
          id: 'folder1',
          name: 'Work',
          path: 'Work',
          parentId: null,
          projectCount: 5,
          taskCount: 20,
          hasSubfolders: true
        },
        {
          id: 'folder2',
          name: 'Personal',
          path: 'Personal',
          parentId: null,
          projectCount: 3,
          taskCount: 10,
          hasSubfolders: false
        }
      ],
      totalCount: 2
    };

    mockListFolders.mockResolvedValue(mockFoldersResult);

    const result = await handler({}, {} as any);

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    const text = result.content[0].text;
    
    expect(text).toContain('# OmniFocus Folders');
    expect(text).toContain('Total folders: 2');
    expect(text).toContain('📁 Work');
    expect(text).toContain('📁 Personal');
    expect(text).toContain('(5 projects, 20 tasks)');
    expect(text).toContain('(3 projects, 10 tasks)');
    expect(text).toContain('[folder1]');
    expect(text).toContain('[folder2]');
    expect(text).toContain('How to use folders with dump_database');
  });

  it('should handle empty folder list', async () => {
    const mockFoldersResult = {
      success: true,
      folders: [],
      totalCount: 0
    };

    mockListFolders.mockResolvedValue(mockFoldersResult);

    const result = await handler({}, {} as any);

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    const text = result.content[0].text;
    
    expect(text).toContain('# OmniFocus Folders');
    expect(text).toContain('Total folders: 0');
    expect(text).toContain('No folders found in OmniFocus');
  });

  it('should handle error from listFolders', async () => {
    const mockFoldersResult = {
      success: false,
      error: 'OmniFocus is not running'
    };

    mockListFolders.mockResolvedValue(mockFoldersResult);

    const result = await handler({}, {} as any);

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toContain('Error listing folders: OmniFocus is not running');
    expect(result.isError).toBe(true);
  });

  it('should handle exception during execution', async () => {
    mockListFolders.mockRejectedValue(new Error('Network error'));

    const result = await handler({}, {} as any);

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toContain('Error listing folders. Please ensure OmniFocus is running and try again.');
    expect(result.isError).toBe(true);
  });

  it('should format hierarchical folders correctly', async () => {
    const mockFoldersResult = {
      success: true,
      folders: [
        {
          id: 'parent1',
          name: 'Work',
          path: 'Work',
          parentId: null,
          projectCount: 2,
          taskCount: 5,
          hasSubfolders: true
        },
        {
          id: 'child1',
          name: 'Development',
          path: 'Work / Development',
          parentId: 'parent1',
          projectCount: 3,
          taskCount: 15,
          hasSubfolders: false
        }
      ],
      totalCount: 2
    };

    mockListFolders.mockResolvedValue(mockFoldersResult);

    const result = await handler({}, {} as any);

    expect(result.content).toHaveLength(1);
    const text = result.content[0].text;
    
    expect(text).toContain('📁 Work');
    expect(text).toContain('  📁 Development');
    expect(text).toContain('[parent1]');
    expect(text).toContain('[child1]');
  });
});