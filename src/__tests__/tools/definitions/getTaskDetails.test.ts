import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockGetTaskDetails = jest.fn<any>();

jest.unstable_mockModule('../../../tools/primitives/getTaskDetails.js', () => ({
  getTaskDetails: mockGetTaskDetails
}));

const { handler } = await import('../../../tools/definitions/getTaskDetails.js');

describe('getTaskDetails tool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should format date fields with year and time', async () => {
    const localTime = new Date(2026, 0, 2, 14, 30, 0, 0).toISOString();
    mockGetTaskDetails.mockResolvedValue({
      success: true,
      task: {
        id: 'task123',
        name: 'Timed task',
        dueDate: localTime
      }
    });

    const result = await handler({ taskId: 'task123' }, {} as any);
    const output = result.content[0].text;

    expect(output).toContain('**Due Date:** 2026-01-02 14:30');
  });

  it('should format date fields without time when time component is missing', async () => {
    const localMidnight = new Date(2026, 0, 2, 0, 0, 0, 0).toISOString();
    mockGetTaskDetails.mockResolvedValue({
      success: true,
      task: {
        id: 'task123',
        name: 'Date-only task',
        dueDate: localMidnight
      }
    });

    const result = await handler({ taskId: 'task123' }, {} as any);
    const output = result.content[0].text;

    expect(output).toContain('**Due Date:** 2026-01-02');
    expect(output).not.toContain('2026-01-02 00:00');
  });
});
