import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { parseJustList, runCommand, JustRecipe } from './justfile-parser.js';
import { recipeToTool } from './tool-metadata.js';
import { existsSync } from 'fs';
import { resolve as pathResolve } from 'path';

export interface JustMcpOptions {
	justfile?: string;
	justBinary?: string;
	timeout?: number;
}

export async function validateEnvironment(justBinary: string, justfile: string): Promise<string> {
	// Try justBinary, then npx just (just-install)
	let resolvedBinary = justBinary;
	let found = false;
	try {
		await runCommand([justBinary, '--version']);
		found = true;
	} catch {}
	if (!found) {
		try {
			await runCommand(['npx', 'just', '--version']);
			resolvedBinary = 'npx just';
			found = true;
		} catch {}
	}
	if (!found) {
		throw new Error(`'just' binary not found: ${justBinary} (also tried npx just)`);
	}
	if (!existsSync(justfile)) {
		throw new Error(`Justfile not found: ${justfile}`);
	}
	const { exitCode, stderr } = await runCommand(resolvedBinary.split(' ').concat(['--list', '--justfile', justfile]));
	if (exitCode !== 0) {
		throw new Error(`Cannot list Just recipes: ${stderr}`);
	}
	return resolvedBinary;
}

export async function startJustMcpServer(opts: JustMcpOptions = {}) {
	const justfile = pathResolve(opts.justfile || 'Justfile');
	const justBinary = opts.justBinary || 'just';
	const timeout = typeof opts.timeout === 'number' ? opts.timeout : 30000;
	let resolvedBinary: string;
	try {
		resolvedBinary = await validateEnvironment(justBinary, justfile);
	} catch (err: any) {
		console.error('[just-mcp] Startup error:\n', err?.message || err);
		process.exit(1);
	}
	let recipes: JustRecipe[] = [];
	try {
		recipes = await parseJustList(justBinary, justfile);
	} catch (err: any) {
		console.error('[just-mcp] Failed to parse Justfile:', err?.message || err);
		process.exit(1);
	}
	const tools = recipes.map(recipeToTool);
	const server = new Server(
		{
			name: `Just MCP server for ${justfile}`,
			version: '0.1.0',
		},
		{
			capabilities: { tools: {} },
		}
	);
	server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));
		server.setRequestHandler(CallToolRequestSchema, async (request) => {
		try {
			const { name: recipeName, arguments: args } = request.params;
			const recipe = recipes.find((r) => r.name === recipeName);
			if (!recipe) throw new Error(`Unknown Just recipe: ${recipeName}`);
			// Build just command
			const cmd = [justBinary, '--justfile', justfile, recipe.name];
			
			// Add parameters in order, using provided values or defaults
			for (const param of recipe.parameters) {
				const providedValue = args?.[param.name];
				if (providedValue !== undefined) {
					// Use provided value
					cmd.push(String(providedValue));
				} else if (!param.required && param.default !== null) {
					// Use default value for optional parameters
					cmd.push(param.default);
				} else if (param.required) {
					// Required parameter not provided - let just handle the error
					// Don't add anything, just will show the error
				}
				// For optional parameters without defaults, don't add anything
			}
			
			const { stdout, stderr, exitCode } = await runCommand(cmd, '.', timeout);
			let resultText = stdout;
			if (stderr) resultText += `\n[stderr (includes trace logging by just)]\n${stderr}`;
			if (exitCode !== 0) resultText += `\n[exit code: ${exitCode}]`;
			return { content: [{ type: "text", text: resultText }] };
		} catch (err: any) {
			return { content: [{ type: "text", text: `[just-mcp] Tool execution error:\n${err?.message || err}` }] };
		}
	});
	const transport = new StdioServerTransport();
	// Graceful shutdown on signals
	process.on('SIGINT', () => {
		console.error('[just-mcp] Received SIGINT, shutting down.');
		process.exit(0);
	});
	process.on('SIGTERM', () => {
		console.error('[just-mcp] Received SIGTERM, shutting down.');
		process.exit(0);
	});
	try {
		await server.connect(transport);
	} catch (err: any) {
		console.error('[just-mcp] MCP server error:', err?.message || err);
		process.exit(1);
	}
}
