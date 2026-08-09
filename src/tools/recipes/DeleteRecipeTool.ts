import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { RecipeProvider } from "../../services/recipes/RecipeService.ts";
import { ToolErrorResult } from "../shared/ToolErrorResult.ts";
import { createTextResult } from "../shared/ToolResult.ts";
import { rawRecipeIdSchema } from "../shared/ToolSchemas.ts";
import { recipeIdInputSchema, recipeMutationStatusSchema } from "./RecipeToolSupport.ts";

export class DeleteRecipeTool {
	public static readonly toolName = "delete_recipe";
	private readonly recipeService: RecipeProvider;

	public constructor(recipeService: RecipeProvider) {
		this.recipeService = recipeService;
	}

	public register(server: McpServer): void {
		server.registerTool(
			DeleteRecipeTool.toolName,
			{
				title: "Delete Fitatu Recipe",
				description:
					"Soft-deletes and confirms deletion of an owned active recipe definition identified by a raw recipeId after exact-name confirmation. It disappears from recipe searches, but existing day-plan entries remain historical snapshots and must be removed separately with remove_meal_items mealKey and itemId targets. Returns { status, recipeId, name, deleted }.",
				inputSchema: z
					.object({
						recipeId: recipeIdInputSchema,
						expectedName: z
							.string()
							.min(1)
							.describe(
								"Exact, case-sensitive current recipe name used as a destructive-action confirmation. Obtain it from get_recipe and do not trim or normalize it.",
							),
					})
					.strict(),
				outputSchema: {
					status: recipeMutationStatusSchema,
					recipeId: rawRecipeIdSchema.describe("Canonical id of the recipe that was deleted."),
					name: z.string().describe("Exact name of the recipe that was deleted."),
					deleted: z.literal(true).describe("Confirmation that the recipe is observably deleted in Fitatu."),
				},
				annotations: {
					title: "Delete Fitatu Recipe",
					readOnlyHint: false,
					destructiveHint: true,
					idempotentHint: false,
					openWorldHint: true,
				},
			},
			async ({ recipeId, expectedName }) => {
				try {
					const result = await this.recipeService.deleteRecipe(recipeId, expectedName);
					return createTextResult({ ...result, recipeId: result.recipeId });
				} catch (error) {
					return ToolErrorResult.create(DeleteRecipeTool.toolName, "Unable to delete Fitatu recipe.", error);
				}
			},
		);
	}
}
