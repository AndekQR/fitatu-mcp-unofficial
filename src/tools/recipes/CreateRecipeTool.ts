import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RecipeProvider } from "../../services/recipes/RecipeService.ts";
import { createToolErrorResult } from "../shared/ToolErrorResult.ts";
import { createTextResult } from "../shared/ToolResult.ts";
import {
	RECIPE_EMPTY_ARRAY_KEYS,
	recipeDetailsOutputSchema,
	recipeWarningOutputSchema,
	recipeWriteInputShape,
	toRecipeDetailsForMcp,
} from "./RecipeToolSupport.ts";

export class CreateRecipeTool {
	public readonly name = "create_recipe";
	private readonly recipeService: RecipeProvider;

	public constructor(recipeService: RecipeProvider) {
		this.recipeService = recipeService;
	}

	public register(server: McpServer): void {
		server.registerTool(
			this.name,
			{
				title: "Create Fitatu Recipe",
				description:
					"Creates a Fitatu recipe from products selected with search_food. For each ingredient, pass the candidate's productId as itemId and a measureId from that candidate. Recipes are private unless shared=true is explicitly provided. Returns canonical per-serving details after Fitatu accepts the write.",
				inputSchema: recipeWriteInputShape,
				outputSchema: {
					recipeId: recipeDetailsOutputSchema.shape.recipeId.describe(
						"Canonical id for subsequent operations. This is always identical to details.recipeId.",
					),
					details: recipeDetailsOutputSchema.describe(
						"Canonical recipe details returned by a read-after-write request.",
					),
					warnings: recipeWarningOutputSchema
						.array()
						.describe(
							"Non-fatal write warnings; empty when no duplicate ingredient selections were found.",
						),
				},
				annotations: {
					title: "Create Fitatu Recipe",
					readOnlyHint: false,
					destructiveHint: false,
					idempotentHint: false,
					openWorldHint: true,
				},
			},
			async (input) => {
				try {
					const result = await this.recipeService.createRecipe({
						name: input.name,
						ingredients: input.ingredients.map((ingredient) => ({
							...ingredient,
							type: "PRODUCT",
						})),
						tags: input.tags ?? [],
						servings: input.servings,
						shared: input.shared ?? false,
						description: input.description ?? null,
						cookingTimeMinutes: input.cookingTimeMinutes ?? null,
						preparationTimeMinutes: input.preparationTimeMinutes ?? null,
						mealSchema: input.mealSchema ?? [],
					});
					return createTextResult(
						{
							recipeId: result.recipeId,
							details: toRecipeDetailsForMcp(result.details),
							warnings: result.warnings,
						},
						{ keepEmptyArrayKeys: RECIPE_EMPTY_ARRAY_KEYS },
					);
				} catch (error) {
					return createToolErrorResult(this.name, "Unable to create Fitatu recipe.", error);
				}
			},
		);
	}
}
