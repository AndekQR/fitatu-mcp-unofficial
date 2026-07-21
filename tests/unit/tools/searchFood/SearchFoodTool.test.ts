import { describe, expect, it } from "vitest";
import type { FoodSearchOptions } from "../../../../src/api/foodSearch/FoodSearchOptions.ts";
import type { FoodSearchResult } from "../../../../src/api/foodSearch/FoodSearchResult.ts";
import type { FoodSearchProvider } from "../../../../src/services/foodSearch/FoodSearchService.ts";
import { SearchFoodTool } from "../../../../src/tools/searchFood/SearchFoodTool.ts";
import { getTextContent, parseTextContent, registerToolForTest } from "../../support/mcpToolTestDouble.ts";

describe("SearchFoodTool", () => {
	it("validates defaults, delegates the search, and returns grouped structured content", async () => {
		const service = new FakeFoodSearchService();
		const registered = await registerToolForTest(new SearchFoodTool(service));

		const result = await registered.invoke({ queries: ["jogurt naturalny"] });

		expect(registered.name).toBe("search_food");
		expect(registered.config.annotations).toMatchObject({ readOnlyHint: true, idempotentHint: true });
		expect(service.requests).toEqual([
			{
				queries: ["jogurt naturalny"],
				locale: "pl_PL",
				limit: 3,
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
							results: [{ queryIndex: 0, query: "jogurt naturalny", count: 0, items: [] }],
						},
						null,
						2,
					),
				},
			],
			structuredContent: {
				queryCount: 1,
				resultCount: 0,
				results: [{ queryIndex: 0, query: "jogurt naturalny", count: 0, items: [] }],
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

	it("redacts unexpected service errors", async () => {
		const service = new FakeFoodSearchService(new Error("secret upstream response"));
		const registered = await registerToolForTest(new SearchFoodTool(service));

		const result = await registered.invoke({ queries: ["jogurt"] });

		expect(result.isError).toBe(true);
		expect(parseTextContent(result)).toEqual({
			status: "error",
			toolName: "search_food",
			errorName: "Error",
			message: "Unable to search Fitatu food.",
		});
		expect(result.structuredContent).toBeUndefined();
		expect(getTextContent(result)).not.toContain("secret upstream response");
	});
});

class FakeFoodSearchService implements FoodSearchProvider {
	public readonly requests: FoodSearchOptions[] = [];

	public constructor(private readonly error?: Error) {}

	public async search(options: FoodSearchOptions): Promise<FoodSearchResult> {
		this.requests.push(options);
		if (this.error) {
			throw this.error;
		}

		return {
			date: "2026-07-14",
			queries: options.queries,
			queryCount: options.queries.length,
			count: 0,
			items: [],
			warnings: [],
			warningDetails: [],
		};
	}
}
