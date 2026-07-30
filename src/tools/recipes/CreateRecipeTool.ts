import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { RecipeIngredientInput } from "../../api/recipes/RecipeIngredientInput.ts";
import { RecipeTag } from "../../api/recipes/RecipeTag.ts";
import { RecipeWriteInput } from "../../api/recipes/RecipeWriteInput.ts";
import type { RecipeProvider } from "../../services/recipes/RecipeService.ts";
import { ToolErrorResult } from "../shared/ToolErrorResult.ts";
import { createTextResult } from "../shared/ToolResult.ts";
import {
	RECIPE_EMPTY_ARRAY_KEYS,
	recipeDetailsOutputSchema,
	recipeWarningOutputSchema,
	recipeWriteInputSchema,
	toRecipeDescription,
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
					"Creates a Fitatu recipe from validated products selected with search_food. A non-empty name, at least one ingredient, and a positive whole number of servings are required. Pass preparation instructions as steps with one step per array item so Fitatu displays separate step fields. Ingredient quantities must be positive finite numbers. For custom tags use RECIPE_TAG_USERS_TYPE. Recipes are private unless shared=true. Returns { recipeId, details, warnings }; details.measures contains measureId values accepted by add_meal_items, recipeId is canonical, and repeating the same request creates another recipe.",
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
					const result = await this.recipeService.createRecipe(
						new RecipeWriteInput(
							input.name,
							input.ingredients.map(
								(ingredient) =>
									new RecipeIngredientInput(
										ingredient.productId,
										ingredient.measureId,
										ingredient.measureQuantity,
									),
							),
							(input.tags ?? []).map((tag) => new RecipeTag(tag.name, tag.category, tag.translation)),
							input.servings,
							input.shared ?? false,
							toRecipeDescription(input.steps ?? []),
							input.cookingTimeMinutes ?? null,
							input.preparationTimeMinutes ?? null,
							input.mealSchema ?? [],
						),
					);
					return createTextResult(
						{
							recipeId: result.recipeId,
							details: toRecipeDetailsForMcp(result.details),
							warnings: toRecipeWarningsForMcp(result.warnings),
						},
						{ keepEmptyArrayKeys: RECIPE_EMPTY_ARRAY_KEYS },
					);
				} catch (error) {
					return ToolErrorResult.create(this.name, "Unable to create Fitatu recipe.", error);
				}
			},
		);
	}
}
