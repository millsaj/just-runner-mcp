export type ToolCase = {
  name: string;
  justfile: string;
  tools?: Array<{
    name: string;
    input: {
      [x: string]: unknown;
    } | undefined;
    outputExact?: string;
    outputContains?: string;
  }>;
  expectError?: boolean;
};

const cases: ToolCase[] = [
  {
    name: "basic_recipe",
    justfile: "basic.justfile",
    tools: [
      {
        name: "just hello",
        input: {},
        outputExact: "Hello, world!"
      }
    ]
  },
  {
    name: "recipe_with_parameters",
    justfile: "parameters.justfile",
    tools: [
      {
        name: "just greet",
        input: { "name": "Alice" },
        outputExact: "Hello Alice!"
      },
      {
        name: "just serve",
        input: {},
        outputExact: "Starting server on port 3000"
      },
      {
        name: "just serve",
        input: { "port": 4000 },
        outputExact: "Starting server on port 4000"
      }
    ]
  },
  {
    name: "recipe_with_dependencies",
    justfile: "dependencies.justfile",
    tools: [
      {
        name: "just build",
        input: {},
        outputExact: "Building..."
      },
      {
        name: "just test",
        input: {},
        outputContains: "Building..."
      }
    ]
  },
  {
    name: "shebang_recipe",
    justfile: "shebang.justfile",
    tools: [
      {
        name: "just node-script",
        input: {},
        outputContains: "Node.js says hello"
      }
    ]
  },
  {
    name: "malformed_justfile",
    justfile: "malformed.justfile",
    expectError: true
  },
  {
    name: "recipe_naming_edge_cases",
    justfile: "naming.justfile",
    tools: [
      {
        name: "just test-build",
        input: {},
        outputExact: "Test build complete"
      },
      {
        name: "just deploy_prod",
        input: {},
        outputExact: "Deploying to prod"
      }
    ]
  },
  {
    name: "mixed_parameters",
    justfile: "mixed_params.justfile",
    tools: [
      {
        name: "just deploy",
        input: { "env": "staging" },
        outputContains: "Deploying version latest to staging"
      },
      {
        name: "just deploy",
        input: { "env": "prod", "version": "1.0.0" },
        outputContains: "Deploying version 1.0.0 to prod"
      }
    ]
  },
  {
    name: "exit_code_handling",
    justfile: "exit_codes.justfile",
    tools: [
      {
        name: "just success",
        input: {},
        outputExact: "Success!"
      },
      {
        name: "just failure",
        input: {},
        outputContains: "exit code: 1"
      }
    ]
  }
]

export default cases as ToolCase[];
