import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock the executeOmniFocusScript function
const mockExecuteOmniFocusScript = jest.fn<any>();

jest.unstable_mockModule('../../../utils/scriptExecution.js', () => ({
  executeOmniFocusScript: mockExecuteOmniFocusScript
}));

// Import after mocking
const { dumpInbox } = await import('../../../tools/primitives/dumpInbox.js');

describe('dumpInbox primitive', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should successfully return inbox data', async () => {
    const mockInboxData = {
      exportDate: '2024-01-01T00:00:00.000Z',
      tasks: [
        {
          id: 'task123',
          name: 'Test task',
          inInbox: true
        }
      ],
      tags: {}
    };

    mockExecuteOmniFocusScript.mockResolvedValue(mockInboxData);

    const result = await dumpInbox();

    expect(mockExecuteOmniFocusScript).toHaveBeenCalledWith('@omnifocusDumpInbox.js');
    expect(result).toEqual(mockInboxData);
  });

  it('should return empty data when script returns null', async () => {
    mockExecuteOmniFocusScript.mockResolvedValue(null);

    const result = await dumpInbox();

    expect(result).toEqual({
      exportDate: expect.any(String),
      tasks: [],
      tags: {}
    });
  });

  it('should throw error when script returns error response', async () => {
    const errorResponse = {
      success: false,
      error: 'OmniFocus is not running'
    };

    mockExecuteOmniFocusScript.mockResolvedValue(errorResponse);

    await expect(dumpInbox()).rejects.toThrow('Failed to dump inbox: OmniFocus is not running');
  });

  it('should throw generic error when script returns error without message', async () => {
    const errorResponse = {
      success: false
    };

    mockExecuteOmniFocusScript.mockResolvedValue(errorResponse);

    await expect(dumpInbox()).rejects.toThrow('Failed to dump inbox: Unknown error occurred');
  });

  it('should handle script execution errors', async () => {
    mockExecuteOmniFocusScript.mockRejectedValue(new Error('Script execution failed'));

    await expect(dumpInbox()).rejects.toThrow('Failed to dump inbox: Script execution failed');
  });

  it('should handle non-Error exceptions', async () => {
    mockExecuteOmniFocusScript.mockRejectedValue('String error');

    await expect(dumpInbox()).rejects.toThrow('Failed to dump inbox: Unknown error');
  });
});