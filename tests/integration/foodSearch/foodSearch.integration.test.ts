import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { describe, expect, it } from "vitest";
import { FitatuClientError } from "../../../src/api/fitatuApiClientBase/FitatuClientError.ts";
import { FITATU_CLIENT_OPERATIONS } from "../../../src/api/fitatuApiClientBase/FitatuClientOperations.ts";
import { FoodSearchClient } from "../../../src/api/foodSearch/FoodSearchClient.ts";
import type { FoodSearchItem } from "../../../src/api/foodSearch/FoodSearchItem.ts";
import type { FoodSearchResult } from "../../../src/api/foodSearch/FoodSearchResult.ts";
import type { FoodSearchSource } from "../../../src/api/foodSearch/FoodSearchSource.ts";
import { FoodSearchService, type FoodSearchProvider } from "../../../src/services/foodSearch/FoodSearchService.ts";
import { SearchFoodTool } from "../../../src/tools/searchFood/SearchFoodTool.ts";

const foodSearchClient = new FoodSearchClient();
const foodSearchService = new FoodSearchService(foodSearchClient);
const DEFAULT_DATE = "2026-06-15";
const PUBLIC_SOURCE: readonly FoodSearchSource[] = ["public"];

describe.sequential("Fitatu food search integration", () => {
	it("searches a stable public product query", async () => {
		const result = await foodSearchService.search({
			queries: ["banan"],
			date: DEFAULT_DATE,
			locale: "pl_PL",
			limit: 5,
			includePublicFood: true,
			includeUserFood: false,
			includeDetails: true,
			detailsLimit: 2,
		});

		expectSearchResult(result, {
			queries: ["banan"],
			expectedSources: PUBLIC_SOURCE,
		});
		expect(result.publicItems.length).toBeGreaterThan(0);
		expect(result.userItems).toEqual([]);
	});

	it("searches multiple product queries at once", async () => {
		const queries = ["banan", "jogurt", "chleb"];

		const result = await foodSearchService.search({
			queries,
			date: DEFAULT_DATE,
			locale: "pl_PL",
			limit: 4,
			includePublicFood: true,
			includeUserFood: false,
			includeDetails: true,
			detailsLimit: 1,
		});

		expectSearchResult(result, {
			queries,
			expectedSources: PUBLIC_SOURCE,
		});
		expect(result.publicItems.length).toBeGreaterThan(0);
		expect(new Set(result.publicItems.map((item) => item.queryIndex)).size).toBeGreaterThan(1);
	});

	it("searches meal ingredient queries from an agent food lookup response", async () => {
		const queries = [
			"pomidory koktajlowe",
			"cebula czerwona",
			"oliwa z oliwek",
			"bułka śniadaniowa",
			"ser cheddar plaster",
			"kiełbasa z piersi kurczaka Morliny",
		];

		const result = await foodSearchService.search({
			queries,
			date: DEFAULT_DATE,
			locale: "pl_PL",
			limit: 5,
			includePublicFood: true,
			includeUserFood: true,
			includeDetails: false,
			detailsLimit: 0,
		});

		expectSearchResult(result, {
			queries,
			expectedSources: ["public", "user"],
		});
		expect(result.publicItems.length + result.userItems.length).toBeGreaterThan(0);
		expect(new Set([...result.publicItems, ...result.userItems].map((item) => item.queryIndex)).size).toBe(
			queries.length,
		);
	});

	it("returns an empty successful response for a non-existing product query", async () => {
		const query = "000000000000000000000000000000";

		const result = await foodSearchService.search({
			queries: [query],
			date: DEFAULT_DATE,
			locale: "pl_PL",
			limit: 5,
			includePublicFood: true,
			includeUserFood: false,
			includeDetails: false,
			detailsLimit: 0,
		});

		expectSearchResult(result, {
			queries: [query],
			expectedSources: PUBLIC_SOURCE,
		});
		expect(result.count).toBe(0);
		expect(result.publicItems).toHaveLength(0);
		expect(result.userItems).toHaveLength(0);
	});

	it("handles a strange query without throwing", async () => {
		const query = "  żÓŁĆ ??? banan ###  ";

		const result = await foodSearchService.search({
			queries: [query],
			date: DEFAULT_DATE,
			locale: "pl_PL",
			limit: 3,
			includePublicFood: true,
			includeUserFood: false,
			includeDetails: false,
			detailsLimit: 0,
		});

		expectSearchResult(result, {
			queries: ["żÓŁĆ ??? banan ###"],
			expectedSources: PUBLIC_SOURCE,
		});
	});

	it("honors limit, locale, and disabled details parameters", async () => {
		const result = await foodSearchService.search({
			queries: ["mleko"],
			date: DEFAULT_DATE,
			locale: "pl_PL",
			limit: 2,
			includePublicFood: true,
			includeUserFood: false,
			includeDetails: false,
			detailsLimit: 0,
		});

		expectSearchResult(result, {
			queries: ["mleko"],
			expectedSources: PUBLIC_SOURCE,
		});
		expect(result.publicItems.length).toBeLessThanOrEqual(2);
		expect(result.publicItems.every((item) => item.measures.length === 0)).toBe(true);
	});

	it("searches only the public catalog when user food is disabled", async () => {
		const result = await foodSearchService.search({
			queries: ["jablko"],
			date: DEFAULT_DATE,
			locale: "pl_PL",
			limit: 5,
			includePublicFood: true,
			includeUserFood: false,
			includeDetails: true,
			detailsLimit: 1,
		});

		expectSearchResult(result, {
			queries: ["jablko"],
			expectedSources: PUBLIC_SOURCE,
		});
		expect(result.publicItems.length).toBeGreaterThan(0);
		expect(result.userItems).toEqual([]);
	});

	it("returns a structured MCP error when all requested food search requests fail", async () => {
		const publicError = await FitatuClientError.http({
			operation: FITATU_CLIENT_OPERATIONS.foodSearch,
			message: "Fitatu public food search failed",
			method: "GET",
			endpointTemplate: "/search/new/food",
			response: new Response('{"message":"temporary outage","code":"temporarily_unavailable"}', {
				status: 503,
				statusText: "Service Unavailable",
			}),
		});
		const userError = await FitatuClientError.http({
			operation: FITATU_CLIENT_OPERATIONS.foodSearch,
			message: "Fitatu user food search failed",
			method: "GET",
			endpointTemplate: "/search/food/user/:userId",
			response: new Response('{"message":"temporary outage","code":"temporarily_unavailable"}', {
				status: 503,
				statusText: "Service Unavailable",
			}),
		});
		const clientError = userError.withAttempts([publicError.failure], "All Fitatu food search requests failed");
		const fakeFoodSearchService = {
			search: async () => {
				throw clientError;
			},
		} as FoodSearchProvider;
		const tool = new SearchFoodTool(fakeFoodSearchService);
		const handler = registerToolForTest(tool);

		const result = await handler({ queries: ["pomidory koktajlowe"] });
		const expectedError = {
			status: "error",
			toolName: "search_food",
			error: {
				source: "fitatuApi",
				name: "FitatuClientError",
				message: "All Fitatu food search requests failed",
				operation: "food.search",
				failure: userError.failure,
				attempts: [publicError.failure],
			},
		};

		expect(result.isError).toBe(true);
		expect(result.structuredContent).toBeUndefined();
		expect(result.content).toEqual([
			{
				type: "text",
				text: JSON.stringify(expectedError, null, 2),
			},
		]);
	});
});

function expectSearchResult(
	result: FoodSearchResult,
	options: {
		readonly queries: readonly string[];
		readonly expectedSources: readonly FoodSearchSource[];
	},
): void {
	expect(result.date).toBe(DEFAULT_DATE);
	expect(result.queries).toEqual(options.queries);
	expect(result.queryCount).toBe(options.queries.length);
	expect(result.count).toBe(result.userItems.length + result.publicItems.length);
	expect(Array.isArray(result.warnings)).toBe(true);
	expect(Array.isArray(result.warningDetails)).toBe(true);
	expect(result.warnings.filter(isSearchRequestFailureWarning)).toHaveLength(0);

	result.userItems.forEach((item, index) => {
		expectSearchItem(item, index, options.queries, ["user"]);
	});
	result.publicItems.forEach((item, index) => {
		expectSearchItem(item, index, options.queries, ["public"]);
	});
	expect(result.userItems.every(({ source }) => source === "user")).toBe(true);
	expect(result.publicItems.every(({ source }) => source === "public")).toBe(true);
	expect(
		[...result.userItems, ...result.publicItems].every(({ source }) => options.expectedSources.includes(source)),
	).toBe(true);
}

function expectSearchItem(
	item: FoodSearchItem,
	index: number,
	queries: readonly string[],
	expectedSources: readonly FoodSearchSource[],
): void {
	expect(item.index).toBe(index);
	expect(item.queryIndex).toBeGreaterThanOrEqual(0);
	expect(item.queryIndex).toBeLessThan(queries.length);
	expect(item.query).toBe(queries[item.queryIndex]);
	expect(expectedSources).toContain(item.source);
	expect(item.foodId).toEqual(expect.any(String));
	expect(item.productId).toBe(item.foodId);
	expect(item.displayName).toEqual(expect.any(String));
	expect(item.displayName.length).toBeGreaterThan(0);
	expect(Array.isArray(item.measures)).toBe(true);
}

function isSearchRequestFailureWarning(warning: string): boolean {
	return warning.includes("public search failed") || warning.includes("user search failed");
}

function registerToolForTest(
	tool: SearchFoodTool,
): (input: { readonly queries: readonly string[] }) => Promise<CallToolResult> {
	let handler: ((input: { readonly queries: readonly string[] }) => Promise<CallToolResult>) | undefined;
	const server = {
		registerTool: (
			_name: string,
			_config: unknown,
			callback: (input: { readonly queries: readonly string[] }) => Promise<CallToolResult>,
		) => {
			handler = callback;
		},
	} as unknown as McpServer;

	tool.register(server);

	if (!handler) {
		throw new Error("SearchFoodTool did not register a handler");
	}

	return handler;
}
