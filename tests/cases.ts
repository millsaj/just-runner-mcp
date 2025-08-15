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
    name: "simple",
    justfile: "simple.justfile",
    tools: [
        {
            name: "just_build",
            input: {"target": "foo"},
            outputExact: "Building for foo"
        },
        {
            name: "just_deploy",
            input: {"env": "prod", "version": "1.2.3"},
            outputExact: "Deploying 1.2.3 to prod"
        }
    ]
  },
  {
    name: "no_params",
    justfile: "no_params.justfile",
    tools: [
      {
        name: "just_test",
        input: {},
        outputExact: "Running tests"}
    ]
  },
  {
    name: "no_description",
    justfile: "no_description.justfile",
    tools: [
        {
            name: "just_hello",
            input: {"name": "Jen"},
            outputExact: "Hello Jen!"
        }
    ]
  },
  {
    name: "malformed",
    justfile: "malformed.justfile",
    expectError: true
  },
  {
    name: "large_output",
    justfile: "large_output.justfile",
    tools: [
        {
            name: "just_spam",
            input: {},
            outputContains: "yes"
        }
    ]
  },
  {
    name: "fail_recipe",
    justfile: "fail.justfile",
    tools: [
        {
            name: "just_fail",
            input: {}, 
            outputContains: "exit code: 1"
        }
    ]
  },
  {
    name: "polyglot",
    justfile: "polyglot.just",
    tools: [
        { name: "just_js", input: {}, outputContains: "Greetings from JavaScript!" },
    ]
  }
]

export default cases as ToolCase[];
