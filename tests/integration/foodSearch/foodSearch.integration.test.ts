import { describe, expect, it } from "vitest";
import { FoodSearchClient } from "../../../src/api/foodSearch/FoodSearchClient.ts";
import type {
	FoodSearchItem,
	FoodSearchResult,
	FoodSearchSource,
} from "../../../src/api/foodSearch/FoodSearchResult.ts";

const foodSearchClient = FoodSearchClient.getInstance();
const DEFAULT_DATE = "2026-06-15";
const PUBLIC_SOURCE: readonly FoodSearchSource[] = ["public"];

describe.sequential("Fitatu food search integration", () => {
	it("searches a stable public product query", async () => {
		const result = await foodSearchClient.search({
			query: "banan",
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
		expect(result.items.length).toBeGreaterThan(0);
		expect(result.items.some((item) => item.matchScore > 0)).toBe(true);
	});

	it("searches multiple product queries at once", async () => {
		const queries = ["banan", "jogurt", "chleb"];

		const result = await foodSearchClient.search({
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
		expect(result.items.length).toBeGreaterThan(0);
		expect(new Set(result.items.map((item) => item.queryIndex)).size).toBeGreaterThan(1);
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

		const result = await foodSearchClient.search({
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
		expect(result.items.length).toBeGreaterThan(0);
		expect(new Set(result.items.map((item) => item.queryIndex)).size).toBe(queries.length);
	});

	it("returns an empty successful response for a non-existing product query", async () => {
		const query = "000000000000000000000000000000";

		const result = await foodSearchClient.search({
			query,
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
		expect(result.items).toHaveLength(0);
	});

	it("handles a strange query without throwing", async () => {
		const query = "  żÓŁĆ ??? banan ###  ";

		const result = await foodSearchClient.search({
			query,
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
		const result = await foodSearchClient.search({
			query: "mleko",
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
		expect(result.items.length).toBeLessThanOrEqual(2);
		expect(result.items.every((item) => item.measures.length === 0)).toBe(true);
	});

	it("searches only the public catalog when user food is disabled", async () => {
		const result = await foodSearchClient.search({
			query: "jablko",
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
		expect(result.items.length).toBeGreaterThan(0);
		expect(result.items.every((item) => item.source === "public")).toBe(true);
	});
});

function expectSearchResult(
	result: FoodSearchResult,
	options: {
		readonly queries: readonly string[];
		readonly expectedSources: readonly FoodSearchSource[];
	},
): void {
	expect(result.status).toBe("ok");
	expect(result.date).toBe(DEFAULT_DATE);
	expect(result.query).toBe(options.queries.length === 1 ? options.queries[0] : null);
	expect(result.queries).toEqual(options.queries);
	expect(result.queryCount).toBe(options.queries.length);
	expect(result.count).toBe(result.items.length);
	expect(result.message).toBe("Food search completed");
	expect(Array.isArray(result.warnings)).toBe(true);
	expect(result.warnings.filter(isSearchRequestFailureWarning)).toHaveLength(0);

	result.items.forEach((item, index) => {
		expectSearchItem(item, index, options.queries, options.expectedSources);
	});
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
	expect(item.matchScore).toEqual(expect.any(Number));
	expect(Array.isArray(item.measures)).toBe(true);
}

function isSearchRequestFailureWarning(warning: string): boolean {
	return warning.includes("public search failed") || warning.includes("user search failed");
}
