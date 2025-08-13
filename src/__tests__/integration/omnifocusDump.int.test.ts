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

  it('dump_database MCP tool - hideCompleted parameter test', async () => {
    console.log('=== Testing hideCompleted parameter ===');
    
    // Use a specific project that likely has completed tasks
    const recordId = 'dsBLnVJyW06'; // Vízlágyító vásárlása project
    
    console.log(`Using project recordId: ${recordId}`);

    // First test with hideCompleted = true (default)
    console.log('\n--- Testing with hideCompleted = true ---');
    const resultHidden = await dumpDatabaseHandler({ 
      recordId,
      hideCompleted: true
    }, mockExtra);

    expect(resultHidden).toBeDefined();
    expect(resultHidden.content).toBeDefined();
    const textHidden = resultHidden.content[0].text;
    
    // Count task symbols in output
    const activeTasksHidden = (textHidden.match(/• /g) || []).length;
    const completedTasksHidden = (textHidden.match(/✓ /g) || []).length;
    const droppedTasksHidden = (textHidden.match(/✗ /g) || []).length;
    
    console.log(`With hideCompleted=true: Active tasks: ${activeTasksHidden}, Completed: ${completedTasksHidden}, Dropped: ${droppedTasksHidden}`);

    // Now test with hideCompleted = false
    console.log('\n--- Testing with hideCompleted = false ---');
    const resultShown = await dumpDatabaseHandler({ 
      recordId,
      hideCompleted: false
    }, mockExtra);

    expect(resultShown).toBeDefined();
    expect(resultShown.content).toBeDefined();
    const textShown = resultShown.content[0].text;
    
    // Count task symbols in output
    const activeTasksShown = (textShown.match(/• /g) || []).length;
    const completedTasksShown = (textShown.match(/✓ /g) || []).length;
    const droppedTasksShown = (textShown.match(/✗ /g) || []).length;
    
    console.log(`With hideCompleted=false: Active tasks: ${activeTasksShown}, Completed: ${completedTasksShown}, Dropped: ${droppedTasksShown}`);
    
    // When hideCompleted is false, we should see completed/dropped tasks if they exist
    // The total tasks should be >= the hidden version
    const totalHidden = activeTasksHidden + completedTasksHidden + droppedTasksHidden;
    const totalShown = activeTasksShown + completedTasksShown + droppedTasksShown;
    
    console.log(`\nTotal tasks - Hidden: ${totalHidden}, Shown: ${totalShown}`);
    
    // Verify that hideCompleted=false shows at least as many tasks
    expect(totalShown).toBeGreaterThanOrEqual(totalHidden);
    
    // If there are completed tasks when showing all, verify they weren't shown when hidden
    if (completedTasksShown > 0) {
      console.log('✅ Completed tasks are properly shown when hideCompleted=false');
      expect(completedTasksHidden).toBe(0);
    }
    
    // Log a sample of the output for debugging
    console.log('\n--- Sample output with hideCompleted=false (first 2000 chars) ---');
    console.log(textShown.substring(0, 2000));
    
    // Also show a section with completed tasks if they exist
    if (completedTasksShown > 0) {
      const completedIndex = textShown.indexOf('✓');
      if (completedIndex > 0) {
        console.log('\n--- Section showing completed tasks ---');
        console.log(textShown.substring(Math.max(0, completedIndex - 200), Math.min(textShown.length, completedIndex + 500)));
      }
    }
  });
});
