test:
    npx tsc
    npx vitest run

test-case name:
    npx tsc
    npx vitest run --testNamePattern "{{name}}"

start-mcp justfile:
    node dist/cli.js --justfile tests/support/{{justfile}}