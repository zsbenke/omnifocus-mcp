#!/usr/bin/env node

// Script to find OmniFocus IDs by name
// Usage: node find-omnifocus-ids.js [search-term]

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const searchTerm = process.argv[2];

if (!searchTerm) {
  console.log('Usage: node find-omnifocus-ids.js <search-term>');
  console.log('\nExamples:');
  console.log('  node find-omnifocus-ids.js "Work"       # Find all items containing "Work"');
  console.log('  node find-omnifocus-ids.js "Shopping"   # Find all items containing "Shopping"');
  process.exit(1);
}

console.log(`Searching for items containing: "${searchTerm}"\n`);

// First, dump the entire database
const server = spawn('node', [join(__dirname, 'dist/server.js')], {
  stdio: ['pipe', 'pipe', 'pipe']
});

const request = {
  jsonrpc: '2.0',
  method: 'tools/call',
  params: {
    name: 'dump_database',
    arguments: {} // Dump everything - don't pass recordId
  },
  id: 1
};

server.stdin.write(JSON.stringify(request) + '\n');

let output = '';
server.stdout.on('data', (data) => {
  output += data.toString();
});

server.on('close', () => {
  try {
    const lines = output.split('\n').filter(line => line.trim());
    const response = JSON.parse(lines[lines.length - 1]);

    if (response.result && response.result.content) {
      const content = response.result.content[0].text;
      const contentLines = content.split('\n');

      const matches = [];

      // Search through all lines
      contentLines.forEach((line, index) => {
        if (line.toLowerCase().includes(searchTerm.toLowerCase())) {
          // Extract ID if present
          const idMatch = line.match(/\[([^\]]+)\]/);
          if (idMatch) {
            const id = idMatch[1];
            let type = 'Unknown';

            if (line.trim().startsWith('F:')) type = 'Folder';
            else if (line.includes('P:')) type = 'Project';
            else if (line.includes('•')) type = 'Task';

            // Extract name
            let name = line;
            name = name.replace(/^[\s]*[FP•:][\s]*/, ''); // Remove prefix
            name = name.replace(/🚩/, '').trim(); // Remove flag
            name = name.replace(/\[[^\]]+\].*$/, '').trim(); // Remove ID and everything after

            matches.push({ type, name, id, line: line.trim() });
          }
        }
      });

      if (matches.length === 0) {
        console.log('No matches found.');
      } else {
        console.log(`Found ${matches.length} matches:\n`);

        // Group by type
        const grouped = matches.reduce((acc, match) => {
          if (!acc[match.type]) acc[match.type] = [];
          acc[match.type].push(match);
          return acc;
        }, {});

        // Display grouped results
        Object.entries(grouped).forEach(([type, items]) => {
          console.log(`\n${type}s:`);
          items.forEach(item => {
            console.log(`  ${item.name}`);
            console.log(`    ID: ${item.id}`);
            console.log(`    Test: node test-dump-record.js ${item.id}`);
          });
        });
      }
    }
  } catch (e) {
    console.error('Error:', e);
  }
});