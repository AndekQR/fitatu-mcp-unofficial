import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { RecipeProvider } from "../../services/recipes/RecipeService.ts";
import { createToolErrorResult } from "../shared/ToolErrorResult.ts";
import { createTextResult } from "../shared/ToolResult.ts";
import { recipeIdInputSchema } from "./RecipeToolSupport.ts";
import { RecipeIdMapper } from "./RecipeIdMapper.ts";

export class DeleteRecipeTool {
	public readonly name = "delete_recipe";
	private readonly recipeService: RecipeProvider;

	public constructor(recipeService: RecipeProvider) {
		this.recipeService = recipeService;
	}

	public register(server: McpServer): void {
		server.registerTool(
			this.name,
			{
				title: "Delete Fitatu Recipe",
				description:
					"Soft-deletes an owned active recipe definition identified by recipe:<digits> after exact-name confirmation. It disappears from recipe searches, but existing day-plan entries remain historical snapshots and must be removed separately with remove_meal_items itemIds.",
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
					recipeId: z
						.string()
						.regex(RecipeIdMapper.mcpPattern)
						.describe("Canonical id of the recipe that was deleted."),
					name: z.string().describe("Exact name of the recipe that was deleted."),
					deleted: z.literal(true).describe("Confirmation that Fitatu accepted the deletion."),
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
					const result = await this.recipeService.deleteRecipe(RecipeIdMapper.fromMcp(recipeId), expectedName);
					return createTextResult({ ...result, recipeId: RecipeIdMapper.toMcp(result.recipeId) });
				} catch (error) {
					return createToolErrorResult(this.name, "Unable to delete Fitatu recipe.", error);
				}
			},
		);
	}
}
