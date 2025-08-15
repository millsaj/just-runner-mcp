# Just Runner MCP Server

A Model Context Protocol (MCP) server that exposes [Just](https://github.com/casey/just) recipes as MCP tools, allowing AI assistants to discover and execute project commands defined in Justfiles.

[![GitMCP](https://img.shields.io/endpoint?url=https://gitmcp.io/badge/millsaj/just-runner-mcp)](https://gitmcp.io/millsaj/just-runner-mcp)

## Quick Start

Install and run the MCP server with npx:

```bash
# Install just command runner if not already installed
# See https://github.com/casey/just#installation

# Run the MCP server pointing to a directory with a Justfile
npx just-runner-mcp --justfile ./path/to/your/justfile

# Or run from current directory (will search for Justfile)
npx just-runner-mcp
```

### MCP Client Configuration

Add to your MCP client configuration (e.g., Claude Desktop):

```json
{
  "mcpServers": {
    "just-runner": {
      "command": "npx",
      "args": ["just-runner-mcp", "--justfile", "/path/to/your/project"]
    }
  }
}
```

## Why Just?

[Just](https://github.com/casey/just) is a command runner that saves and runs project-specific commands in a `justfile`. It's an excellent choice for exposing project automation to AI assistants because:

- **Simple syntax**: Justfiles use a clean, make-inspired syntax that's easy to read and write
- **Cross-platform**: Works on Linux, macOS, Windows, and other Unix-like systems  
- **Language agnostic**: Recipes can be written in any language (bash, python, etc.)
- **Self-documenting**: Recipes can include documentation comments that describe what they do
- **Parameterized**: Recipes can accept arguments, making them flexible and reusable
- **Dependency management**: Recipes can depend on other recipes, ensuring proper execution order

Here's an example justfile that demonstrates the versatility:

```just
# Build the project
build:
    cargo build --release

# Run tests with optional filter
test filter="":
    #!/usr/bin/env python3
    import subprocess
    import sys
    
    cmd = ["cargo", "test"]
    if "{{filter}}":
        cmd.extend(["--", "{{filter}}"])
    
    subprocess.run(cmd, check=True)

# Deploy to production (requires confirmation)
[confirm]
deploy: build test
    ./scripts/deploy.sh --env production

# Clean build artifacts
clean:
    cargo clean
    rm -rf target/
```

When exposed through this MCP server, each recipe becomes a tool that AI assistants can discover and execute, making project automation accessible and discoverable.

## Tool Generation

The MCP server automatically parses Justfiles and generates MCP tools for each recipe. Each tool is named after the recipe and includes:

- **Name**: The recipe name from the justfile
- **Description**: Extracted from documentation comments (lines starting with `#` above the recipe)
- **Parameters**: Automatically detected recipe parameters with their default values and types

For example, this justfile recipe:

```just
# Compile Latex Document. FILEPATH must be an absolute path
compile-latex FILEPATH:
    tectonic {{FILEPATH}}

# Compile Typst Document. FILEPATH must be an absolute path
compile-typst FILEPATH:
    typst compile --format pdf {{FILEPATH}}
    typst compile --format png {{FILEPATH}} "page-{0p}-of-{t}.png"
```

Would expose the following tools to the MCP client:

```json
{
  "tools": [
    {
      "name": "just compile-latex",
      "description": "Compile Latex Document. FILEPATH must be an absolute path",
      "inputSchema": {
        "type": "object",
        "properties": {
          "FILEPATH": {
            "type": "string",
            "description": "Parameter: FILEPATH (required)"
          }
        },
        "required": ["FILEPATH"]
      }
    },
    {
      "name": "just compile-typst",
      "description": "Compile Typst Document. FILEPATH must be an absolute path",
      "inputSchema": {
        "type": "object",
        "properties": {
          "FILEPATH": {
            "type": "string",
            "description": "Parameter: FILEPATH (required)"
          }
        },
        "required": ["FILEPATH"]
      }
    }
  ]
}
```

## CLI Options

The MCP server supports several command-line options:

```console
Usage: just-mcp [options]

Expose Justfile recipes as MCP tools

Options:
  --justfile <path>     Path to Justfile (default: "Justfile")
  --just-binary <path>  Path to just binary (default: "just")
  --timeout <ms>        Timeout for recipe execution in milliseconds (default: 30000)
  --list-tools          Print available tools and exit
  --help                Show help message
  -h                    display help for command
```

## DevelopmentCompile Latex Document. FILEPATH must be an absolute path

This project is built with TypeScript and uses the Model Context Protocol SDK. The repository includes:

- **`src/just-mcp.ts`**: Main MCP server implementation
- **`src/justfile-parser.ts`**: Justfile parsing logic
- **`src/cli.ts`**: Command-line interface
- **`tests/`**: Comprehensive test suite with integration tests

### Running Tests

```bash
# Run all tests
just test

# Run specific test file
just test tests/integration.test.ts
```

## Examples

This section demonstrates a practical Justfile for a development project and the MCP tools it generates. Each recipe becomes a tool that AI assistants can discover and execute.

### Simple Development Justfile

Here's a justfile for a typical development workflow:

```just
# Install project dependencies
install:
    npm install

# Start the development server
dev port="3000":
    echo "Starting dev server on port {{port}}"
    npm run dev -- --port {{port}}

# Run all tests
test:
    npm test

# Deploy to staging environment
deploy-staging: build test
    echo "Deploying to staging..."
    ./scripts/deploy.sh staging
```

### MCP Tools Output

When you run `just-runner-mcp --list-tools`, you get the following JSON response showing all available tools:

```json
{
  "tools": [
    {
      "name": "just install",
      "description": "Install project dependencies",
      "inputSchema": {
        "type": "object",
        "properties": {},
        "required": []
      }
    },
    {
      "name": "just dev",
      "description": "Start the development server",
      "inputSchema": {
        "type": "object",
        "properties": {
          "port": {
            "type": "string",
            "description": "Parameter: port (default: 3000)"
          }
        },
        "required": []
      }
    },
    {
      "name": "just test",
      "description": "Run all tests",
      "inputSchema": {
        "type": "object",
        "properties": {},
        "required": []
      }
    },
    {
      "name": "just deploy-staging",
      "description": "Deploy to staging environment",
      "inputSchema": {
        "type": "object",
        "properties": {},
        "required": []
      }
    }
  ]
}
```

With these tools available, an AI assistant can help you with common development tasks like "install the dependencies", "start the dev server on port 8080", "run the tests", or "deploy to staging".

