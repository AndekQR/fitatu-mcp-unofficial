import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { RecipeProvider } from "../../services/recipes/RecipeService.ts";
import { createToolErrorResult } from "../shared/ToolErrorResult.ts";
import { createTextResult } from "../shared/ToolResult.ts";
import { recipeIdInputSchema } from "./RecipeToolSupport.ts";

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
					"Permanently deletes an owned editable Fitatu recipe. expectedName must exactly match the current recipe name.",
				inputSchema: {
					recipeId: recipeIdInputSchema,
					expectedName: z
						.string()
						.min(1)
						.describe(
							"Exact, case-sensitive current recipe name used as a destructive-action confirmation. Obtain it from get_recipe and do not trim or normalize it.",
						),
				},
				outputSchema: {
					recipeId: z
						.string()
						.regex(/^[1-9]\d*$/)
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
					return createTextResult(await this.recipeService.deleteRecipe(recipeId, expectedName));
				} catch (error) {
					return createToolErrorResult(this.name, "Unable to delete Fitatu recipe.", error);
				}
			},
		);
	}
}
