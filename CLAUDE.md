# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Development Commands

- `npm run build` - Build TypeScript and copy AppleScript files
- `npm run dev` - Watch mode for TypeScript compilation
- `npm start` - Run the built server
- `npm test` - Run all tests
- `npm test:watch` - Run tests in watch mode
- `npm test:coverage` - Run tests with coverage report
- `npm test:integration:omnifocus` - Run OmniFocus integration tests (requires OmniFocus to be running)

## Architecture Overview

This is a Model Context Protocol (MCP) server that bridges AI assistants (like Claude) with OmniFocus task management on macOS. The codebase follows a modular architecture:

### Core Components

1. **MCP Server (`src/server.ts`)**: Entry point that registers all tools with the MCP SDK and handles STDIO transport.

2. **Tool System**: Two-layer architecture for each tool:
   - **Definitions** (`src/tools/definitions/`): MCP-specific tool wrappers with Zod schemas and handlers
   - **Primitives** (`src/tools/primitives/`): Core business logic that interacts with OmniFocus

3. **Script Execution (`src/utils/scriptExecution.ts`)**: Executes OmniJS scripts in OmniFocus via JXA (JavaScript for Automation) wrapper.

4. **OmniJS Scripts (`src/utils/omnifocusScripts/`)**: JavaScript files that run inside OmniFocus to access its object model.

### Key Implementation Details

- **Database Dumping**: The `dumpDatabase` tool supports dumping the entire database or a specific record (folder/project/task) via the `recordId` parameter. It formats output in a compact, hierarchical format.

- **Task Creation**: Tasks can be nested under parent tasks using either `parentTaskId` or `parentTaskName`. The implementation uses AppleScript for direct OmniFocus automation.

- **Script Execution Pattern**: OmniJS scripts are wrapped in JXA to execute within OmniFocus context. Scripts starting with `@` are resolved from the package's script directory.

- **Type System**: Strong TypeScript types define OmniFocus entities (tasks, projects, folders, tags) with comprehensive metadata fields including creation/modification dates.

### Testing

Tests are written in Jest with TypeScript support. The test structure mirrors the source code:
- Unit tests for primitives test business logic
- Definition tests verify MCP integration
- Integration tests require OmniFocus to be running

## Common Development Tasks

When adding a new tool:
1. Create the primitive implementation in `src/tools/primitives/`
2. Create the MCP definition in `src/tools/definitions/` with Zod schema
3. Register the tool in `src/server.ts`
4. Add corresponding tests
5. If needed, create an OmniJS script in `src/utils/omnifocusScripts/`

When debugging script execution:
- Check console output for stderr from osascript
- Temporary script files are created in system temp directory
- Scripts can be tested directly in Script Editor or OmniFocus automation console

## Integration Testing

The project includes integration tests that work with your actual OmniFocus database to ensure the MCP server functions correctly with real data.

### Prerequisites for Integration Testing

1. **macOS** with OmniFocus installed
2. **OmniFocus must be running** and unlocked during the test
3. **Some data in OmniFocus** (projects, tasks, etc.)

### Running Integration Tests

**Recommended method:**
```bash
npm run test:integration:omnifocus
```

**Alternative methods:**
```bash
# Direct jest command
OMNIFOCUS_TEST=1 npx jest src/__tests__/integration/omnifocusDump.int.test.ts

# Environment variable + regular test
export OMNIFOCUS_TEST=1
npm test -- src/__tests__/integration/omnifocusDump.int.test.ts
```

### What Integration Tests Verify

1. **Full Database Dump** - Tests `dumpDatabase()` with complete OmniFocus library
2. **Scoped Database Dump** - Tests `dumpDatabase(recordId)` with specific project/folder
3. **Inbox Dump** - Tests `dumpInbox()` with inbox contents
4. **Field Validation** - Ensures all required fields (including `lastReviewDate`) are present on tasks and projects

### Safety Features

- **Gated by Environment Variable**: Tests only run when `OMNIFOCUS_TEST=1` is set
- **Skipped in CI**: Won't break continuous integration or other developers' machines
- **Long Timeout**: 5-minute timeout to handle slow AppleScript operations
- **Real Data Only**: No mocking - tests actual OmniFocus integration

### Troubleshooting Integration Tests

**Test is Skipped:**
- Ensure `OMNIFOCUS_TEST=1` environment variable is set
- The test will show as "skipped" if the environment variable is not set

**Test Fails with OmniFocus Error:**
- Ensure OmniFocus is running and unlocked
- Make sure you have some projects and tasks in your OmniFocus database
- Try running OmniFocus manually to ensure it's responding

**Timeout Errors:**
- The test has a 5-minute timeout for slow operations
- If you have a very large OmniFocus database, the test might take longer
- Consider testing with a smaller subset of data