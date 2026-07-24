import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { RecipeProvider } from "../../services/recipes/RecipeService.ts";
import { createToolErrorResult } from "../shared/ToolErrorResult.ts";
import { createTextResult } from "../shared/ToolResult.ts";
import { RECIPE_EMPTY_ARRAY_KEYS } from "./RecipeToolSupport.ts";

const searchItemOutputSchema = z
	.object({
		recipeId: z
			.string()
			.regex(/^[1-9]\d*$/)
			.describe("Canonical Fitatu recipe id to pass to get_recipe, update_recipe, or delete_recipe."),
		name: z.string().describe("Recipe display name."),
		source: z
			.enum(["mine", "public"])
			.describe('Catalog containing this result: "mine" for the authenticated user or "public" for Fitatu.'),
		energyKcal: z.number().optional().describe("Energy in kilocalories, when the search response provides it."),
	})
	.describe("Recipe search result summary.");

export class SearchRecipesTool {
	public readonly name = "search_recipes";
	private readonly recipeService: RecipeProvider;

	public constructor(recipeService: RecipeProvider) {
		this.recipeService = recipeService;
	}

	public register(server: McpServer): void {
		server.registerTool(
			this.name,
			{
				title: "Search Fitatu Recipes",
				description:
					"Searches recipes by name in the authenticated user's catalog, Fitatu's public catalog, or both. Omit query to list recipes. Results are paginated from page 1; scope=all interleaves and deduplicates owned and public results.",
				inputSchema: {
					query: z
						.string()
						.trim()
						.optional()
						.describe("Optional recipe-name search phrase. Omit or use an empty string to list recipes."),
					scope: z
						.enum(["mine", "public", "all"])
						.default("mine")
						.optional()
						.describe(
							'Catalog scope: "mine" searches owned recipes, "public" searches Fitatu, and "all" combines both. Defaults to "mine".',
						),
					page: z
						.number()
						.int()
						.positive()
						.default(1)
						.optional()
						.describe("One-based result page number. Defaults to 1."),
					limit: z
						.number()
						.int()
						.min(1)
						.max(50)
						.default(20)
						.optional()
						.describe("Maximum recipes returned on this page, from 1 to 50. Defaults to 20."),
				},
				outputSchema: {
					query: z.string().describe("Normalized search phrase used for the request; empty when listing."),
					scope: z.enum(["mine", "public", "all"]).describe("Catalog scope used for this result page."),
					page: z.number().int().positive().describe("One-based page number returned."),
					limit: z
						.number()
						.int()
						.min(1)
						.max(50)
						.describe("Maximum number of recipes requested for this page."),
					count: z
						.number()
						.int()
						.nonnegative()
						.max(50)
						.describe(
							"Number of recipes in items on this page, not the total number of matching recipes. Always equals items.length.",
						),
					items: z
						.array(searchItemOutputSchema)
						.max(50)
						.describe("Deduplicated recipe summaries on this page; empty when no recipes match."),
				},
				annotations: {
					title: "Search Fitatu Recipes",
					readOnlyHint: true,
					destructiveHint: false,
					idempotentHint: true,
					openWorldHint: true,
				},
			},
			async ({ query, scope, page, limit }) => {
				try {
					const result = await this.recipeService.searchRecipes({
						...(query !== undefined ? { query } : {}),
						scope,
						page,
						limit,
					});
					return createTextResult(result, { keepEmptyArrayKeys: RECIPE_EMPTY_ARRAY_KEYS });
				} catch (error) {
					return createToolErrorResult(this.name, "Unable to search Fitatu recipes.", error);
				}
			},
		);
	}
}
