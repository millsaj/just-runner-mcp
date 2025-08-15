import { spawn } from 'child_process';

export interface JustRecipe {
	name: string;
	parameters: { name: string; required: boolean; default: string | null }[];
	description: string;
}

export async function runCommand(
       cmd: string[],
       cwd = '.',
       timeout = 30000,
       debug = false
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
       return new Promise((resolve, reject) => {
	       const child = spawn(cmd[0], cmd.slice(1), {
		       cwd,
		       env: process.env,
		       stdio: ['ignore', 'pipe', 'pipe'],
		       shell: true
	       });
	       let stdout = '';
	       let stderr = '';
	       child.stdout.on('data', (d) => {
		       stdout += d.toString();
	       });
	       child.stderr.on('data', (d) => {
		       stderr += d.toString();
	       });
	       const timeoutId = setTimeout(() => {
		       child.kill();
		       if (debug || process.env.JUST_MCP_DEBUG) {
			       console.error('[runCommand] Command timed out after', timeout, 'ms');
		       }
		       reject(new Error(`Command timed out after ${timeout}ms`));
	       }, timeout);
	       child.on('close', (code) => {
		       clearTimeout(timeoutId);
		       resolve({ stdout: stdout.trim(), stderr: stderr.trim(), exitCode: code ?? 0 });
	       });
	       child.on('error', (err) => {
		       clearTimeout(timeoutId);
		       if (debug || process.env.JUST_MCP_DEBUG) {
			       console.error('[runCommand] Process error:', err);
		       }
		       reject(err);
	       });
	       // No need to end stdin, we use 'ignore' for stdin
       });
}

export async function parseJustList(justBinary = 'just', justfilePath = 'Justfile'): Promise<JustRecipe[]> {
	const cmd = justBinary.split(' ').concat(['--list']);
	if (justfilePath) {
		cmd.push('--justfile', justfilePath);
	}
	const { stdout, stderr, exitCode } = await runCommand(cmd);
	if (exitCode !== 0) {
		throw new Error(stderr || 'Failed to run just --list');
	}
	const recipes: JustRecipe[] = [];
	for (const line of stdout.split('\n')) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('Available recipes:')) continue;
		const [recipePart, comment] = trimmed.split('#', 2);
		const tokens = recipePart.trim().split(/\s+/);
		if (!tokens[0]) continue;
		const name = tokens[0];
		const parameters = tokens.slice(1).map((param) => {
			// Handle parameters with defaults like 'port="3000"'
			const equalsMatch = param.match(/^(\w+)="?([^"]*)"?$/);
			if (equalsMatch) {
				return {
					name: equalsMatch[1],
					required: false,
					default: equalsMatch[2]
				};
			}
			// Handle required parameters (no default)
			return {
				name: param,
				required: true,
				default: null
			};
		});
		let description = comment ? comment.trim() : `Execute the ${name} recipe`;
		recipes.push({ name, parameters, description });
	}
	return recipes;
}
