export interface JustRecipe {
	name: string;
	parameters: { name: string; required: boolean; default: string | null }[];
	description: string;
}

export interface MCPToolDefinition {
	name: string;
	description: string;
	inputSchema: {
		type: 'object';
		properties: Record<string, { type: string; description: string }>;
		required: string[];
	};
}
