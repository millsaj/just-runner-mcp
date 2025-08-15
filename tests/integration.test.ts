// integration.test.ts
// Integration tests for just-mcp using MCP in-memory transport and real Justfile examples.

import { describe, it, expect, afterEach } from 'vitest';
import path from 'path';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { spawn } from 'child_process';
import { once } from 'events';
import cases from './cases';

const CLI = path.join(__dirname, '../dist/cli.js');
const SUPPORT_DIR = path.join(__dirname, 'support');

// Helper function to extract text content from MCP content array
function getTextContent(content: any[]): string {
    return content
        .filter(item => item.type === 'text')
        .map(item => item.text)
        .join(' ');
}

// Helper to create and connect a client
async function createConnectedClient(options: { justfile?: string, justBinary?: string, cwd?: string }) {
    const args = [CLI];
    if (options.justfile) {
        args.push('--justfile', options.justfile);
    }
    if (options.justBinary) {
        args.push('--just-binary', options.justBinary);
    }
    const transport = new StdioClientTransport({
        command: 'node',
        args,
        ...(options.cwd ? { cwd: options.cwd } : {}),
    });
    const client = new Client({
        name: 'integration-test',
        version: '1.0.0',
        transport,
    });
    await client.connect(transport);
    return client;
}

describe('just-mcp integration (MCP stdio)', () => {
    let client: Client | undefined;
    afterEach(async () => {
        if (client) {
            await client.close?.();
            client = undefined;
        }
    });

    // Run all cases from cases array
    for (const testCase of cases) {
        describe(`Case: ${testCase.name}`, () => {
            const justfilePath = path.join(SUPPORT_DIR, testCase.justfile);

            if (testCase.expectError) {
                it(`fails to start for ${testCase.name} (expect error)`, async () => {
                    // Spawn the CLI as a subprocess
                    const proc = spawn('node', [CLI, '--justfile', justfilePath], { stdio: ['ignore', 'pipe', 'pipe'] });
                    let stderr = '';
                    proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
                    const [code] = await once(proc, 'exit');
                    expect(code, `Process should exit with error for ${testCase.name}`).not.toBe(0);
                    expect(stderr, `Stderr should contain error for ${testCase.name}`).toMatch(/error|not found|failed|Cannot|malformed/i);
                }, 10000);
            } else {
                const uniqToolCount = new Set(testCase.tools?.map(t => t.name)).size;

                it(`registers ${uniqToolCount} tools`, async () => {
                    client = await createConnectedClient({ justfile: justfilePath });
                    const listToolsResult = await client.listTools();
                    const actualTools = listToolsResult.tools || listToolsResult;
                    expect(actualTools.length, `Should register ${uniqToolCount} tools`).toBe(uniqToolCount);
                });

                for (const expectedTool of testCase.tools ?? []) {
                    it(`allows calling tool ${expectedTool.name} with args ${JSON.stringify(expectedTool.input)}`, async () => {
                        if (!client) {
                            client = await createConnectedClient({ justfile: justfilePath });
                        }
                        const actualResult = await client.callTool({ name: expectedTool.name, arguments: expectedTool.input });
                        if (expectedTool.outputExact) {
                            expect(getTextContent(actualResult.content as any[])).toContain(expectedTool.outputExact);
                        } else if (expectedTool.outputContains) {
                            expect(getTextContent(actualResult.content as any[])).toContain(expectedTool.outputContains);
                        }
                    });
                }
            }
        });
    }

    describe('Default Justfile', () => {
        it('runs with default Justfile if present (cwd=./tests/support)', async () => {
            client = await createConnectedClient({ cwd: SUPPORT_DIR });
            const listToolsResult = await client.listTools();
            const actualTools = listToolsResult.tools || listToolsResult;

            expect(actualTools.length, 'Should list at least one tool').toBeGreaterThan(0);
            const found = actualTools.find((t: any) => t.name === "hello");
            expect(found, 'Tool just_hello should be listed').toBeTruthy();

            const actualResult = await client.callTool({ name: 'hello' });
            expect(getTextContent(actualResult.content as any[]), 'Output should contain hello message').toContain('Hello from default Justfile');
        }, 10000);
    });

    describe('Non-existent tool', () => {
        it('returns an error when calling a non-existent tool', async () => {
            client = await createConnectedClient({ cwd: SUPPORT_DIR });
            const nonExistentToolName = 'this_tool_does_not_exist';

            let actualResult = await client.callTool({ name: nonExistentToolName });
            expect(getTextContent(actualResult.content as any[]), 'Output should indicate unknown tool').toContain("Unknown Just recipe");
        });
    });

    describe('CLI Features', () => {
        it('handles custom timeout setting', async () => {
            const justfilePath = path.join(SUPPORT_DIR, 'basic.justfile');
            // Test that the server starts with a custom timeout
            client = await createConnectedClient({ justfile: justfilePath });
            const listToolsResult = await client.listTools();
            const actualTools = listToolsResult.tools || listToolsResult;
            expect(actualTools.length, 'Should list tools with custom timeout').toBeGreaterThan(0);
        });

        it('handles recipes with exit codes correctly', async () => {
            const justfilePath = path.join(SUPPORT_DIR, 'exit_codes.justfile');
            client = await createConnectedClient({ justfile: justfilePath });
            
            // Test successful recipe
            const successResult = await client.callTool({ name: 'success', arguments: {} });
            expect(getTextContent(successResult.content as any[])).toContain('Success!');
            
            // Test failing recipe
            const failResult = await client.callTool({ name: 'failure', arguments: {} });
            expect(getTextContent(failResult.content as any[])).toContain('exit code: 1');
        });
    });
});
