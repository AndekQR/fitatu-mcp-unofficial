import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RecipeProvider } from "../../services/recipes/RecipeService.ts";
import { createToolErrorResult } from "../shared/ToolErrorResult.ts";
import { createTextResult } from "../shared/ToolResult.ts";
import {
	RECIPE_EMPTY_ARRAY_KEYS,
	recipeDetailsOutputSchema,
	recipeWarningOutputSchema,
	recipeWriteInputSchema,
	toRecipeDetailsForMcp,
	toRecipeWarningsForMcp,
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
					"Creates a Fitatu recipe from validated products selected with search_food. A non-empty name, at least one ingredient, and a positive whole number of servings are required. Ingredient quantities must be positive finite numbers. For custom tags use RECIPE_TAG_USERS_TYPE. Recipes are private unless shared=true. Returns { recipeId, details, warnings }; recipeId is canonical and repeating the same request creates another recipe.",
				inputSchema: recipeWriteInputSchema,
				outputSchema: {
					recipeId: recipeDetailsOutputSchema.shape.recipeId.describe(
						"Canonical id for subsequent operations. This is always identical to details.recipeId.",
					),
					details: recipeDetailsOutputSchema.describe(
						"Canonical recipe details returned by a read-after-write request.",
					),
					warnings: recipeWarningOutputSchema
						.array()
						.describe("Non-fatal write warnings; currently empty for validated recipe creation."),
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
						ingredients: input.ingredients.map(({ productId, ...ingredient }) => ({
							...ingredient,
							itemId: productId,
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
							warnings: toRecipeWarningsForMcp(result.warnings),
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
