import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { RecipeProvider } from "../../services/recipes/RecipeService.ts";
import { ToolErrorResult } from "../shared/ToolErrorResult.ts";
import { createTextResult } from "../shared/ToolResult.ts";
import {
	RECIPE_EMPTY_ARRAY_KEYS,
	recipeDetailsOutputSchema,
	recipeUpdateInputSchema,
	recipeWarningOutputSchema,
	recipeMutationStatusSchema,
	toRecipeDetailsForMcp,
	toRecipeUpdateInput,
	toRecipeWarningsForMcp,
} from "./RecipeToolSupport.ts";

export class UpdateRecipeTool {
	public static readonly toolName = "update_recipe";
	private readonly recipeService: RecipeProvider;

	public constructor(recipeService: RecipeProvider) {
		this.recipeService = recipeService;
	}

	public register(server: McpServer): void {
		server.registerTool(
			UpdateRecipeTool.toolName,
			{
				title: "Update Fitatu Recipe",
				description:
					"Partially updates and confirms an owned active recipe identified by a raw recipeId. The same create limits apply. Pass preparation instructions as steps with one step per array item so Fitatu displays separate step fields. Omitted fields, including steps and mealSchema, are preserved; null clears nullable time fields, and [] clears lists. Raw public mealSchema values returned by get_recipe are not necessarily accepted mutation inputs. Tag categories must be RECIPE_TAG_USERS_TYPE or already present on this recipe. Fitatu may replace the identity; always use the returned recipeId. Returns { status, previousRecipeId, recipeId, identityChanged, details, warnings }; details.measures contains measureId values accepted by add_meal_items.",
				inputSchema: recipeUpdateInputSchema,
				outputSchema: {
					status: recipeMutationStatusSchema,
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
						.describe("Non-fatal write warnings; currently empty for validated recipe updates."),
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
							status: result.status,
							previousRecipeId: result.previousRecipeId,
							recipeId: result.recipeId,
							identityChanged: result.identityChanged,
							details: toRecipeDetailsForMcp(result.details),
							warnings: toRecipeWarningsForMcp(result.warnings),
						},
						{ keepEmptyArrayKeys: RECIPE_EMPTY_ARRAY_KEYS },
					);
				} catch (error) {
					return ToolErrorResult.create(UpdateRecipeTool.toolName, "Unable to update Fitatu recipe.", error);
				}
			},
		);
	}
}
