import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RecipeProvider } from "../../services/recipes/RecipeService.ts";
import { createToolErrorResult } from "../shared/ToolErrorResult.ts";
import { createTextResult } from "../shared/ToolResult.ts";
import {
	RECIPE_EMPTY_ARRAY_KEYS,
	normalizeRecipeToolError,
	recipeDetailsOutputShape,
	recipeIdInputSchema,
	toRecipeDetailsForMcp,
} from "./RecipeToolSupport.ts";
import { z } from "zod";

export class GetRecipeTool {
	public readonly name = "get_recipe";
	private readonly recipeService: RecipeProvider;

	public constructor(recipeService: RecipeProvider) {
		this.recipeService = recipeService;
	}

	public register(server: McpServer): void {
		server.registerTool(
			this.name,
			{
				title: "Get Fitatu Recipe",
				description:
					"Gets canonical per-serving details for a raw recipeId returned by a recipe-aware MCP tool. Soft-deleted recipes remain readable with deleted=true and editable=false; product ids are rejected. Returns canonical recipe details { recipeId, name, servings, shared, editable, deleted, mealSchema, tags, ingredients, nutritionPerServing, ...optionalFields }.",
				inputSchema: z.object({ recipeId: recipeIdInputSchema }).strict(),
				outputSchema: recipeDetailsOutputShape,
				annotations: {
					title: "Get Fitatu Recipe",
					readOnlyHint: true,
					destructiveHint: false,
					idempotentHint: true,
					openWorldHint: true,
				},
			},
			async ({ recipeId }) => {
				try {
					const recipe = await this.recipeService.getRecipe(recipeId);
					return createTextResult(toRecipeDetailsForMcp(recipe), {
						keepEmptyArrayKeys: RECIPE_EMPTY_ARRAY_KEYS,
					});
				} catch (error) {
					return createToolErrorResult(
						this.name,
						"Unable to get Fitatu recipe.",
						normalizeRecipeToolError(error, { operation: "get", recipeId }),
					);
				}
			},
		);
	}
}
