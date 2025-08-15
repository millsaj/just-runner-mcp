import { JustRecipe } from './justfile-parser.js';

export interface MCPToolDefinition {
	name: string;
	description: string;
	inputSchema: {
		type: 'object';
		properties: Record<string, { type: string; description: string }>;
		required: string[];
	};
}

export function recipeToTool(recipe: JustRecipe): MCPToolDefinition {
	const name = recipe.name;
	const properties: Record<string, { type: string; description: string }> = {};
	const required: string[] = [];
	for (const param of recipe.parameters) {
		properties[param.name] = {
			type: 'string',
			description: param.required
				? 'Required'
				: param.default !== null
				? `Optional (default: ${param.default})`
				: 'Optional',
		};
		if (param.required) required.push(param.name);
	}

	return {
		name,
		description: `Run just recipe: ${recipe.name}\n${recipe.description}`,
		inputSchema: {
			type: 'object',
			properties,
			required,
		},
	};
}
