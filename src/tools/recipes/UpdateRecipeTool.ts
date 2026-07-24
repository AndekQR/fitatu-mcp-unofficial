import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { RecipeProvider } from "../../services/recipes/RecipeService.ts";
import { createToolErrorResult } from "../shared/ToolErrorResult.ts";
import { createTextResult } from "../shared/ToolResult.ts";
import {
	RECIPE_EMPTY_ARRAY_KEYS,
	recipeDetailsOutputSchema,
	recipeUpdateInputSchema,
	recipeWarningOutputSchema,
	toRecipeDetailsForMcp,
	toRecipeUpdateInput,
} from "./RecipeToolSupport.ts";

export class UpdateRecipeTool {
	public readonly name = "update_recipe";
	private readonly recipeService: RecipeProvider;

	public constructor(recipeService: RecipeProvider) {
		this.recipeService = recipeService;
	}

	public register(server: McpServer): void {
		server.registerTool(
			this.name,
			{
				title: "Update Fitatu Recipe",
				description:
					"Partially updates an owned editable recipe. Provide at least one field besides recipeId. Omitted fields are preserved; null clears nullable text or time fields, while [] clears tags or mealSchema. Fitatu may replace the recipe with a new id; use the returned recipeId for later operations.",
				inputSchema: recipeUpdateInputSchema,
				outputSchema: {
					previousRecipeId: recipeDetailsOutputSchema.shape.recipeId.describe(
						"Recipe id targeted by the update. It may become obsolete when identityChanged is true.",
					),
					recipeId: recipeDetailsOutputSchema.shape.recipeId.describe(
						"Canonical id to use after the update. This is always identical to details.recipeId.",
					),
					identityChanged: z
						.boolean()
						.describe(
							"Whether Fitatu replaced the recipe id: true exactly when recipeId differs from previousRecipeId.",
						),
					details: recipeDetailsOutputSchema.describe(
						"Canonical details for the updated recipe, read using the resulting recipeId.",
					),
					warnings: recipeWarningOutputSchema
						.array()
						.describe(
							"Non-fatal write warnings; empty when no duplicate ingredient selections were found.",
						),
				},
				annotations: {
					title: "Update Fitatu Recipe",
					readOnlyHint: false,
					destructiveHint: true,
					idempotentHint: false,
					openWorldHint: true,
				},
			},
			async ({ recipeId, ...patch }) => {
				try {
					if (Object.values(patch).every((value) => value === undefined)) {
						throw new Error("At least one recipe field must be provided");
					}
					const result = await this.recipeService.updateRecipe(recipeId, toRecipeUpdateInput(patch));
					return createTextResult(
						{
							previousRecipeId: result.previousRecipeId,
							recipeId: result.recipeId,
							identityChanged: result.identityChanged,
							details: toRecipeDetailsForMcp(result.details),
							warnings: result.warnings,
						},
						{ keepEmptyArrayKeys: RECIPE_EMPTY_ARRAY_KEYS },
					);
				} catch (error) {
					return createToolErrorResult(this.name, "Unable to update Fitatu recipe.", error);
				}
			},
		);
	}
}
