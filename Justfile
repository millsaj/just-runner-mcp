# Justfile for MCP Just Runner

# Setup the project by installing dependencies
install:
    npm install

# Build the TypeScript code
build:
    npx tsc

# Run the MCP inspector locally for a justfile
dev JUSTFILE="tests/support/basic.justfile": build
    npx -y @modelcontextprotocol/inspector node dist/cli.js --justfile {{JUSTFILE}}

# Build and run the tests
test: build
    npx vitest run

# Run a specific test case by name
test-case name: build
    npx vitest run --testNamePattern "{{name}}"
