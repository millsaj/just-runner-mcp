#!/usr/bin/env node
import { Command } from 'commander';
import { startJustMcpServer } from './just-mcp.js';

// Add global error handlers to catch any unhandled errors
process.on('uncaughtException', (err) => {
    console.error('[just-mcp] UNCAUGHT EXCEPTION:', err);
    process.exit(1); // Exit on uncaught exceptions
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[just-mcp] UNHANDLED REJECTION:', reason);
    process.exit(1); // Exit on unhandled rejections
});


const program = new Command();
program
	.name('just-mcp')
	.description('Expose Justfile recipes as MCP tools')
	.option('--justfile <path>', 'Path to Justfile', 'Justfile')
	.option('--just-binary <path>', 'Path to just binary', 'just')
	.option('--timeout <ms>', 'Timeout for recipe execution in milliseconds (default: 30000)', parseInt, 30000)
	.option('--list-tools', 'Print available tools and exit')
	.option('--help', 'Show help message');

program.parse(process.argv);
const opts = program.opts();

async function main() {
	if (opts.help) {
		program.help();
		return;
	}
	if (opts.listTools) {
		// Print available tools and exit
		const { parseJustList } = await import('./justfile-parser.js');
		const { recipeToTool } = await import('./tool-metadata.js');
		const recipes = await parseJustList(opts.justBinary, opts.justfile);
		const tools = recipes.map(recipeToTool);
		for (const tool of tools) {
			console.log(`${tool.name}: ${tool.description}`);
		}
		process.exit(0);
	}
	await startJustMcpServer({ justfile: opts.justfile, justBinary: opts.justBinary, timeout: opts.timeout });
	// Prevent process from exiting (keep alive for MCP stdio)
	await new Promise(() => {});
}

main().catch((err) => {
	console.error(err?.message || err);
	process.exit(1);
});
