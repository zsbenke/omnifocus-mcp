# Integration Testing with Real OmniFocus Data

This project includes integration tests that work with your actual OmniFocus database to ensure the MCP server works correctly with real data.

## Prerequisites

1. **macOS** with OmniFocus installed
2. **OmniFocus must be running** and unlocked during the test
3. **Some data in OmniFocus** (projects, tasks, etc.)

## Running Integration Tests

### Method 1: Using npm script (recommended)

```bash
npm run test:integration:omnifocus
```

### Method 2: Direct jest command

```bash
OMNIFOCUS_TEST=1 npx jest src/__tests__/integration/omnifocusDump.int.test.ts
```

### Method 3: Environment variable + regular test

```bash
export OMNIFOCUS_TEST=1
npm test -- src/__tests__/integration/omnifocusDump.int.test.ts
```

## What the Integration Tests Do

The integration tests verify:

1. **Full Database Dump** - Tests `dumpDatabase()` with complete OmniFocus library
2. **Scoped Database Dump** - Tests `dumpDatabase(recordId)` with specific project/folder
3. **Inbox Dump** - Tests `dumpInbox()` with inbox contents
4. **lastReviewDate Field** - Ensures the newly added `lastReviewDate` field is present on all tasks and projects

### Specific Validations

- All tasks have a `lastReviewDate` property (may be null)
- All projects have a `lastReviewDate` property (may be null)  
- At least one task or project has a non-null `lastReviewDate` value
- Real OmniFocus AppleScript/OmniJS integration works end-to-end

## Safety Features

- **Gated by Environment Variable**: Tests only run when `OMNIFOCUS_TEST=1` is set
- **Skipped in CI**: Won't break continuous integration or other developers' machines
- **Long Timeout**: 5-minute timeout to handle slow AppleScript operations
- **Real Data Only**: No mocking - tests actual OmniFocus integration

## Troubleshooting

### Test is Skipped
- Make sure `OMNIFOCUS_TEST=1` environment variable is set
- The test will show as "skipped" if the environment variable is not set

### Test Fails with OmniFocus Error
- Ensure OmniFocus is running and unlocked
- Make sure you have some projects and tasks in your OmniFocus database
- Try running OmniFocus manually to ensure it's responding

### Timeout Errors
- The test has a 5-minute timeout for slow operations
- If you have a very large OmniFocus database, the test might take longer
- Consider testing with a smaller subset of data

## Example Output

When successful, you'll see output like:

```
✓ dumpDatabase() – full library export includes lastReviewDate
✓ dumpDatabase(recordId) – scoped export still includes lastReviewDate  
✓ dumpInbox() – inbox export includes lastReviewDate

Example task with lastReviewDate: { name: "Review project specs", lastReviewDate: "2024-01-15T10:30:00.000Z" }
Example project with lastReviewDate: { name: "Website Redesign", lastReviewDate: "2024-01-10T14:00:00.000Z" }
```

This confirms that the `lastReviewDate` field is working correctly with real OmniFocus data.
