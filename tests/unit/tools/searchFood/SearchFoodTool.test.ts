import { describe, expect, it } from "vitest";
import { FoodNutrition } from "../../../../src/api/foodSearch/FoodNutrition.ts";
import type { FoodSearchOptions } from "../../../../src/api/foodSearch/FoodSearchOptions.ts";
import { FoodSearchItem } from "../../../../src/api/foodSearch/FoodSearchItem.ts";
import { FoodSearchResult } from "../../../../src/api/foodSearch/FoodSearchResult.ts";
import { FoodSearchWarningDetail } from "../../../../src/api/foodSearch/FoodSearchWarningDetail.ts";
import { NormalizedFoodSearchItem } from "../../../../src/api/foodSearch/NormalizedFoodSearchItem.ts";
import { FitatuClientError } from "../../../../src/api/fitatuApiClientBase/FitatuClientError.ts";
import { FITATU_CLIENT_OPERATIONS } from "../../../../src/api/fitatuApiClientBase/FitatuClientOperations.ts";
import type { FoodSearchProvider } from "../../../../src/services/foodSearch/FoodSearchService.ts";
import { SearchFoodTool } from "../../../../src/tools/searchFood/SearchFoodTool.ts";
import { getTextContent, parseTextContent, registerToolForTest } from "../../support/mcpToolTestDouble.ts";

describe("SearchFoodTool", () => {
	it("validates defaults, delegates the search, and returns grouped structured content", async () => {
		const service = new FakeFoodSearchService();
		const registered = await registerToolForTest(new SearchFoodTool(service));

		const result = await registered.invoke({ queries: ["jogurt naturalny"], date: "2026-07-14" });

		expect(registered.name).toBe("search_food");
		expect(registered.config.annotations).toMatchObject({ readOnlyHint: true, idempotentHint: true });
		expect(registered.config.description).toContain("does not infer brand or retailer aliases");
		expect(registered.config.description).toContain("separate userItems and publicItems");
		expect(registered.config.description).toContain("does not merge or deduplicate");
		expect(JSON.stringify(registered.config.inputSchema)).toContain("submit plausible query variants together");
		expect(service.requests).toEqual([
			{
				queries: ["jogurt naturalny"],
				date: "2026-07-14",
				locale: "pl_PL",
				limit: 5,
				includeUserFood: true,
				includePublicFood: true,
				includeDetails: false,
				detailsLimit: 3,
			},
		]);
		expect(result).toEqual({
			content: [
				{
					type: "text",
					text: JSON.stringify(
						{
							queryCount: 1,
							resultCount: 0,
							results: [
								{ queryIndex: 0, query: "jogurt naturalny", count: 0, userItems: [], publicItems: [] },
							],
						},
						null,
						2,
					),
				},
			],
			structuredContent: {
				queryCount: 1,
				resultCount: 0,
				results: [{ queryIndex: 0, query: "jogurt naturalny", count: 0, userItems: [], publicItems: [] }],
			},
		});
	});

	it("rejects invalid input before calling the service", async () => {
		const service = new FakeFoodSearchService();
		const registered = await registerToolForTest(new SearchFoodTool(service));

		const result = await registered.invoke({ queries: [] });

		expect(result.isError).toBe(true);
		expect(service.requests).toHaveLength(0);
	});

	it.each([
		{ queries: ["   "] },
		{ queries: ["jogurt"], locale: "   " },
		{ queries: ["jogurt"], includeUserFood: false, includePublicFood: false },
	])("rejects semantically empty search input %# before calling the service", async (input) => {
		const service = new FakeFoodSearchService();
		const registered = await registerToolForTest(new SearchFoodTool(service));

		const result = await registered.invoke(input);

		expect(result.isError).toBe(true);
		expect(service.requests).toHaveLength(0);
	});

	it("trims search queries and locale at the MCP boundary", async () => {
		const service = new FakeFoodSearchService();
		const registered = await registerToolForTest(new SearchFoodTool(service));

		await registered.invoke({ queries: ["  jogurt  "], locale: "  pl_PL  " });

		expect(service.requests[0]).toMatchObject({ queries: ["jogurt"], locale: "pl_PL" });
	});

	it("redacts unexpected service errors", async () => {
		const service = new FakeFoodSearchService(new Error("secret upstream response"));
		const registered = await registerToolForTest(new SearchFoodTool(service));

		const result = await registered.invoke({ queries: ["jogurt"] });

		expect(result.isError).toBe(true);
		expect(parseTextContent(result)).toEqual({
			status: "error",
			toolName: "search_food",
			error: {
				source: "internal",
				name: "Error",
				message: "Unable to search Fitatu food.",
			},
		});
		expect(result.structuredContent).toBeUndefined();
		expect(getTextContent(result)).not.toContain("secret upstream response");
	});

	it("publishes recipe candidates with raw recipe ids and no generic food id", async () => {
		const service = new FakeFoodSearchService(undefined, true);
		const registered = await registerToolForTest(new SearchFoodTool(service));

		const result = await registered.invoke({ queries: ["test recipe"] });

		expect(parseTextContent(result)).toMatchObject({
			results: [
				{
					userItems: [
						{
							recipeId: "100",
						},
					],
				},
			],
		});
		expect(JSON.stringify(parseTextContent(result))).not.toContain('"productId"');
		expect(JSON.stringify(parseTextContent(result))).not.toContain('"foodId"');
		expect(JSON.stringify(parseTextContent(result))).not.toContain('"foodType"');
	});

	it("publishes product candidates with productId and no generic food id", async () => {
		const service = new FakeFoodSearchService(undefined, false, true);
		service.warnings.push("Public catalog was temporarily unavailable.");
		service.warningDetails.push(
			new FoodSearchWarningDetail(
				"Public catalog was temporarily unavailable.",
				FitatuClientError.transport({
					operation: FITATU_CLIENT_OPERATIONS.foodSearch,
					message: "Fitatu public food search request failed",
					method: "GET",
					endpointTemplate: "/search/new/food",
					error: new TypeError("network failure"),
				}),
				undefined,
				"public",
				"sensitive-food-id",
			),
		);
		const registered = await registerToolForTest(new SearchFoodTool(service));

		const result = await registered.invoke({ queries: ["test product"] });
		const payload = JSON.stringify(parseTextContent(result));

		expect(parseTextContent(result)).toMatchObject({
			results: [{ publicItems: [{ productId: "200" }] }],
			warningDetails: [
				{
					message: "Public catalog was temporarily unavailable.",
					clientError: {
						name: "FitatuClientError",
						message: "Fitatu public food search request failed",
						operation: "food.search",
						failure: {
							kind: "transport",
							method: "GET",
							endpointTemplate: "/search/new/food",
							errorName: "TypeError",
						},
						attempts: [],
					},
				},
			],
		});
		expect(payload).not.toContain('"recipeId"');
		expect(payload).not.toContain('"foodId"');
		expect(payload).not.toContain('"foodType"');
	});

	it("omits non-reusable custom candidates and reports a warning", async () => {
		const service = new FakeFoodSearchService(undefined, false, false, true);
		const registered = await registerToolForTest(new SearchFoodTool(service));

		const result = await registered.invoke({ queries: ["quick add"] });
		const payload = JSON.stringify(parseTextContent(result));

		expect(parseTextContent(result)).toMatchObject({
			resultCount: 0,
			results: [{ count: 0, userItems: [], publicItems: [] }],
			warnings: [expect.stringContaining("CUSTOM_ITEM")],
		});
		expect(payload).not.toContain('"foodId"');
	});
});

class FakeFoodSearchService implements FoodSearchProvider {
	public readonly requests: FoodSearchOptions[] = [];
	public readonly warnings: string[] = [];
	public readonly warningDetails: FoodSearchWarningDetail[] = [];

	public constructor(
		private readonly error?: Error,
		private readonly includeRecipe = false,
		private readonly includeProduct = false,
		private readonly includeCustom = false,
	) {}

	public async search(options: FoodSearchOptions): Promise<FoodSearchResult> {
		this.requests.push(options);
		if (this.error) {
			throw this.error;
		}

		const query = options.queries[0] ?? "";
		const items = this.includeRecipe
			? [foodItem(query, "user", "100", "RECIPE", "Test recipe", "39", 100, false)]
			: this.includeProduct
				? [foodItem(query, "public", "200", "PRODUCT", "Test product", "1", 200, true)]
				: this.includeCustom
					? [foodItem(query, "user", "custom-1", "CUSTOM_ITEM", "Quick add", "1", 100, false)]
					: [];
		return new FoodSearchResult(
			"2026-07-14",
			options.queries,
			items.filter(({ source }) => source === "user"),
			items.filter(({ source }) => source === "public"),
			[...this.warnings],
			[...this.warningDetails],
		);
	}
}

function foodItem(
	query: string,
	source: "public" | "user",
	foodId: string,
	foodType: "PRODUCT" | "RECIPE" | "CUSTOM_ITEM",
	name: string,
	measureId: string,
	kcal: number,
	verified: boolean,
): FoodSearchItem {
	const item = new NormalizedFoodSearchItem(
		source,
		foodId,
		foodType,
		name,
		null,
		measureId,
		"portion",
		1,
		100,
		kcal,
		emptyNutrition(),
		emptyNutrition(),
		verified,
		null,
		[],
	);
	return new FoodSearchItem(item, 0, 0, query, name);
}

function emptyNutrition(): FoodNutrition {
	return new FoodNutrition(null, null, null, null, null, null, null, null);
}
