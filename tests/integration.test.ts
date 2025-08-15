// integration.test.ts
// Integration tests for just-mcp using MCP in-memory transport and real Justfile examples.

import { describe, it, expect, afterEach } from 'vitest';
import path from 'path';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { spawn } from 'child_process';
import { once } from 'events';
import fs from 'fs';
import cases from './cases';

const CLI = path.join(__dirname, '../dist/cli.js');
const SUPPORT_DIR = path.join(__dirname, 'support');

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
                it(`registers ${testCase.tools?.length ?? 0} tools`, async () => {
                    client = await createConnectedClient({ justfile: justfilePath });
                    const listToolsResult = await client.listTools();
                    const actualTools = listToolsResult.tools || listToolsResult;
                    expect(actualTools.length, `Should register ${testCase.tools?.length ?? 0} tools`).toBe(testCase.tools?.length ?? 0);
                });

                for (const expectedTool of testCase.tools ?? []) {
                    it(`allows calling tool ${expectedTool.name}`, async () => {
                        if (!client) {
                            client = await createConnectedClient({ justfile: justfilePath });
                        }
                        // For timeout test, pass --timeout to CLI and check for timeout error
                        if (testCase.timeout) {
                            // Close any existing client
                            await client?.close?.();
                            client = undefined;
                            const args = [CLI, '--justfile', justfilePath, '--timeout', String(testCase.timeout)];
                            const transport = new StdioClientTransport({
                                command: 'node',
                                args,
                            });
                            const timeoutClient = new Client({
                                name: 'integration-test',
                                version: '1.0.0',
                                transport,
                            });
                            await timeoutClient.connect(transport);
                            const actualResult = await timeoutClient.callTool({ name: expectedTool.name, arguments: expectedTool.input });
                            expect(String(actualResult.output)).toMatch(/timed out|timeout/i);
                            await timeoutClient.close?.();
                        } else {
                            const actualResult = await client.callTool({ name: expectedTool.name, arguments: expectedTool.input });
                            if (expectedTool.outputExact) {
                                expect(String(actualResult.output)).toContain(expectedTool.outputExact);
                            } else if (expectedTool.outputContains) {
                                expect(String(actualResult.output)).toContain(expectedTool.outputContains);
                            }
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
            const found = actualTools.find((t: any) => t.name === "just_hello");
            expect(found, 'Tool just_hello should be listed').toBeTruthy();

            const actualResult = await client.callTool({ name: 'just_hello' });
            expect(String(actualResult.output), 'Output should contain hello message').toContain('Hello from default Justfile');
        }, 10000);
    });

    describe('Alternate just binary', () => {
        it('runs with a different just binary', async () => {
            const testCase = cases[0];
            const testCaseTool = testCase.tools![0];
            expect(testCase.tools?.length, 'Test case should have at least one tool').toBeGreaterThan(0);

            const fakeJustPath = path.join(SUPPORT_DIR, 'fake-just.sh');
            const justfilePath = path.join(SUPPORT_DIR, testCase.justfile);

            // Check if the fake binary exists and is executable
            let isExecutable = false;
            try {
                fs.accessSync(fakeJustPath, fs.constants.X_OK);
                isExecutable = true;
            } catch {}

            if (!isExecutable) {
                // If not executable, expect startup failure
                const proc = spawn('node', [CLI, '--justfile', justfilePath, '--just-binary', fakeJustPath], { stdio: ['ignore', 'pipe', 'pipe'] });
                let stderr = '';
                proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
                const [code] = await once(proc, 'exit');
                expect(code, 'Process should exit with error if fake binary is not executable').not.toBe(0);
                expect(stderr, 'Stderr should mention error or permission').toMatch(/error|not found|failed|Cannot|ENOENT|EACCES/i);
                return;
            }

            // If executable, proceed as before
            client = await createConnectedClient({ justfile: justfilePath, justBinary: fakeJustPath });
            const listToolsResult = await client.listTools();
            const actualTools = listToolsResult.tools || listToolsResult;

            expect(actualTools.length, 'Should list at least one tool').toBeGreaterThan(0);

            // Verify our fake binary was invoked
            const result = await client.callTool({ name: testCaseTool.name, arguments: testCaseTool.input });
            expect(result.output, 'Output should indicate fake binary was invoked').toContain('FAKE JUST BINARY INVOKED');
        }, 15000);
    });

    describe('Non-existent tool', () => {
        it('returns an error when calling a non-existent tool', async () => {
            client = await createConnectedClient({ cwd: SUPPORT_DIR });
            const nonExistentToolName = 'this_tool_does_not_exist';

            let actualResult = await client.callTool({ name: nonExistentToolName });
            expect(actualResult.output, 'Output should indicate unknown tool').toContain("Unknown tool");
        });
    });

    describe('Timeout behavior', () => {
        it('enforces timeout for long-running recipe', async () => {
            const justfilePath = path.join(SUPPORT_DIR, 'timeout.justfile');
            const args = [CLI, '--justfile', justfilePath, '--timeout', '0.3']; // short timeout
            const transport = new StdioClientTransport({
                command: 'node',
                args,
            });
            const timeoutClient = new Client({
                name: 'integration-test',
                version: '1.0.0',
                transport,
            });
            await timeoutClient.connect(transport);
            const result = await timeoutClient.callTool({ name: 'just_slow', arguments: {} });
            expect(String(result.output)).toMatch(/timed out|timeout/i);
            await timeoutClient.close?.();
        });
    });
});
