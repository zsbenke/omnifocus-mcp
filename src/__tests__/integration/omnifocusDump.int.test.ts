/**
 * Integration test for OmniFocus MCP dump tools.
 *
 * IMPORTANT:  This test performs live automation of OmniFocus through Apple-
 *             Script / JXA.  To avoid breaking CI and developer machines that
 *             do not have OmniFocus installed, the test is disabled unless the
 *             environment variable OMNIFOCUS_TEST=1 is set.
 *
 *   $ OMNIFOCUS_TEST=1 npx jest src/__tests__/integration/omnifocusDump.int.test.ts
 */

import { describe, it, expect, jest } from '@jest/globals';
import { handler as dumpDatabaseHandler } from '../../tools/definitions/dumpDatabase';
import { handler as dumpInboxHandler } from '../../tools/definitions/dumpInbox';

const RUN = process.env.OMNIFOCUS_TEST === '1';

/* Helper that runs a spec only when RUN === true */
const integration = RUN ? describe : describe.skip;

integration('OmniFocus MCP dump tools (live integration)', () => {
  // 5 minutes – AppleScript can be sluggish on large libraries
  jest.setTimeout(300_000);

  // Mock RequestHandlerExtra since we don't need it for this test
  const mockExtra = {} as any;

  it('dump_database MCP tool - specific folder export', async () => {
    console.log('=== Testing dump_database MCP tool (specific folder) ===');
    
    // Use the specific folder ID from omnifocus:///folder/bBoxVSr-27Z
    const recordId = 'bBoxVSr-27Z';
    
    console.log(`Using folder recordId: ${recordId}`);

    const result = await dumpDatabaseHandler({ 
      recordId,
      hideCompleted: true,
      hideRecurringDuplicates: true,
      projectsOnly: false
    }, mockExtra);

    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(Array.isArray(result.content)).toBe(true);
    expect(result.content.length).toBeGreaterThan(0);

    // Output the actual MCP tool response
    console.log('--- MCP Tool Response (Full) ---');
    console.log('Content items:', result.content.length);
    result.content.forEach((item, index) => {
      console.log(`\nContent item ${index + 1}:`);
      console.log('Type:', item.type);
      if (item.type === 'text') {
        console.log('Full text content:');
        console.log(item.text);
      }
    });
  });

  it('dump_database MCP tool - with file output', async () => {
    console.log('\n=== Testing dump_database MCP tool (with file output) ===');
    
    // Use the same specific folder ID
    const recordId = 'bBoxVSr-27Z';
    console.log(`Using folder recordId for file output: ${recordId}`);

    const filePath = '/tmp/omnifocus-integration-test.txt';
    
    const result = await dumpDatabaseHandler({ 
      recordId,
      filePath,
      hideCompleted: true,
      projectsOnly: false
    }, mockExtra);

    expect(result).toBeDefined();
    expect(result.content).toBeDefined();

    // Output the MCP tool response
    console.log('--- MCP Tool Response (with file) ---');
    console.log('Success:', result.isError === undefined || !result.isError);
    result.content.forEach((item, index) => {
      console.log(`Content item ${index + 1}:`, item);
    });
  });

  it('dump_inbox MCP tool', async () => {
    console.log('\n=== Testing dump_inbox MCP tool ===');
    
    const result = await dumpInboxHandler({ 
      hideCompleted: true,
      hideRecurringDuplicates: true,
      hideDeferred: true
    }, mockExtra);

    expect(result).toBeDefined();
    expect(result.content).toBeDefined();

    // Output the actual MCP tool response
    console.log('--- MCP Tool Response (Full) ---');
    console.log('Content items:', result.content.length);
    result.content.forEach((item, index) => {
      console.log(`\nContent item ${index + 1}:`);
      console.log('Type:', item.type);
      if (item.type === 'text') {
        console.log('Full text content:');
        console.log(item.text);
      }
    });
  });

  it('dump_inbox MCP tool - with file output', async () => {
    console.log('\n=== Testing dump_inbox MCP tool (with file output) ===');
    
    const filePath = '/tmp/omnifocus-inbox-test.txt';
    
    const result = await dumpInboxHandler({ 
      filePath,
      hideCompleted: true
    }, mockExtra);

    expect(result).toBeDefined();
    expect(result.content).toBeDefined();

    // Output the MCP tool response
    console.log('--- MCP Tool Response (with file) ---');
    console.log('Success:', result.isError === undefined || !result.isError);
    result.content.forEach((item, index) => {
      console.log(`Content item ${index + 1}:`, item);
    });
  });
});
