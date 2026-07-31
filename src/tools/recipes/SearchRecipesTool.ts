import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { RecipeSearchItem } from "../../api/recipes/RecipeSearchItem.ts";
import { RecipeSearchOptions } from "../../api/recipes/RecipeSearchOptions.ts";
import { DetailedRecipeSearchItem } from "../../services/recipes/DetailedRecipeSearchItem.ts";
import type { RecipeProvider } from "../../services/recipes/RecipeService.ts";
import { ToolErrorResult } from "../shared/ToolErrorResult.ts";
import { FitatuClientErrorPublic } from "../shared/FitatuClientErrorPublic.ts";
import {
	FITATU_CLIENT_ERROR_EMPTY_ARRAY_KEYS,
	FITATU_CLIENT_ERROR_NULL_KEYS,
	fitatuClientErrorOutputSchema,
} from "../shared/FitatuClientErrorOutputSchema.ts";
import { createTextResult } from "../shared/ToolResult.ts";
import { rawRecipeIdSchema } from "../shared/ToolSchemas.ts";
import { RECIPE_EMPTY_ARRAY_KEYS, recipeDetailsOutputShape, toRecipeDetailsForMcp } from "./RecipeToolSupport.ts";

const searchItemSummaryShape = {
	recipeId: rawRecipeIdSchema.describe(
		"Raw recipe id to pass to get_recipe, update_recipe, delete_recipe, or add_meal_items.",
	),
	name: z.string().describe("Recipe display name."),
	source: z
		.enum(["mine", "public"])
		.describe('Catalog containing this result: "mine" for the authenticated user or "public" for Fitatu.'),
	energyKcal: z.number().optional().describe("Energy in kilocalories, when the search response provides it."),
};

const searchItemSummaryOutputSchema = z
	.object({
		...searchItemSummaryShape,
	})
	.strict()
	.describe("Recipe search result summary returned when additional details were not requested or were unavailable.");

const detailedSearchItemOutputSchema = z
	.object({
		source: searchItemSummaryShape.source,
		energyKcal: searchItemSummaryShape.energyKcal,
		...recipeDetailsOutputShape,
	})
	.strict()
	.describe(
		"Recipe search result with canonical details and measures included at the top level after includeDetails=true.",
	);

const searchItemOutputSchema = z.union([searchItemSummaryOutputSchema, detailedSearchItemOutputSchema]);

const sourceUnavailableWarningOutputSchema = z.object({
	code: z.literal("RECIPE_SOURCE_UNAVAILABLE"),
	source: z.enum(["mine", "public"]),
	message: z.string(),
	clientError: fitatuClientErrorOutputSchema,
});

const detailsUnavailableWarningOutputSchema = z.object({
	code: z.literal("RECIPE_DETAILS_UNAVAILABLE"),
	source: z.enum(["mine", "public"]),
	recipeId: rawRecipeIdSchema,
	message: z.string(),
	clientError: fitatuClientErrorOutputSchema,
});

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
					"Searches active recipes by a trimmed, case-insensitive name substring and returns raw recipeId values. Set includeDetails=true to include additional recipe information and available measures. These details can be useful when adding a selected recipe to a day plan. Empty or whitespace-only query lists recipes. scope=all combines catalogs and returns partial results with warnings when one catalog or individual recipe details are unavailable. Returns { query, scope, page, limit, count, items, warnings }.",
				inputSchema: z
					.object({
						query: z
							.string()
							.trim()
							.optional()
							.describe(
								"Optional case-insensitive substring matched against recipe names. Omit or use an empty string to list recipes.",
							),
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
						includeDetails: z
							.boolean()
							.default(false)
							.optional()
							.describe(
								"Whether to include canonical recipe details and available measures. These details can be useful when adding a selected recipe to a day plan. Defaults to false.",
							),
					})
					.strict(),
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
						.describe(
							"Deduplicated recipes on this page. With includeDetails=true, successful detail lookups add canonical fields and measures at the top level.",
						),
					warnings: z
						.array(z.union([sourceUnavailableWarningOutputSchema, detailsUnavailableWarningOutputSchema]))
						.describe(
							"Non-fatal source or recipe-detail failures; empty when every requested operation succeeded.",
						),
				},
				annotations: {
					title: "Search Fitatu Recipes",
					readOnlyHint: true,
					destructiveHint: false,
					idempotentHint: true,
					openWorldHint: true,
				},
			},
			async ({ query, scope, page, limit, includeDetails }) => {
				try {
					const result = await this.recipeService.searchRecipes(
						new RecipeSearchOptions(query, scope, page, limit, includeDetails),
					);
					return createTextResult(
						{
							...result,
							items: result.items.map(toSearchItemForMcp),
							warnings: result.warnings.map((warning) => ({
								...warning,
								clientError: new FitatuClientErrorPublic(warning.clientError),
							})),
						},
						{
							keepEmptyArrayKeys: [...RECIPE_EMPTY_ARRAY_KEYS, ...FITATU_CLIENT_ERROR_EMPTY_ARRAY_KEYS],
							keepNullKeys: FITATU_CLIENT_ERROR_NULL_KEYS,
						},
					);
				} catch (error) {
					return ToolErrorResult.create(this.name, "Unable to search Fitatu recipes.", error);
				}
			},
		);
	}
}

function toSearchItemForMcp(item: RecipeSearchItem) {
	if (!(item instanceof DetailedRecipeSearchItem)) {
		return {
			recipeId: item.recipeId,
			name: item.name,
			source: item.source,
			energyKcal: item.energyKcal ?? undefined,
		};
	}

	return {
		source: item.source,
		energyKcal: item.energyKcal ?? undefined,
		...toRecipeDetailsForMcp(item.details),
	};
}
