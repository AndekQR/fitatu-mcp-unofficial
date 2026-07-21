import { describe, expect, it } from "vitest";
import { FoodSearchClient } from "../../../../src/api/foodSearch/FoodSearchClient.ts";
import { FitatuUserProfile } from "../../../../src/api/users/FitatuUserProfile.ts";
import { createAuthClientStub } from "../../support/authTestDouble.ts";
import { createFetchStub, createJsonResponse } from "../../support/httpTestDouble.ts";

const authClient = createAuthClientStub({ userId: "user-1" });

const userClient = {
	getCurrentUser: async () => FitatuUserProfile.fromApiResponse({ id: "user-1", locale: "pl_PL" }),
	clearUserCache: () => undefined,
};

describe("FoodSearchClient.search", () => {
	it("searches the selected source and maps Fitatu rows to stable food results", async () => {
		const fetchStub = createFetchStub(
			createJsonResponse({
				items: [
					{
						id: "food-1",
						name: "Jogurt naturalny",
						producer: "Testowa mleczarnia",
						energy: 61,
						protein: 4.3,
						measure: { id: "measure-1", name: "opakowanie", quantity: 1, weight: 180, energy: 109.8 },
					},
				],
			}),
		);
		const client = new FoodSearchClient({
			baseUrl: "https://fitatu.test/api",
			fetchFn: fetchStub.fetchFn,
			authClient,
			userClient,
		});

		const result = await client.search({
			queries: [" jogurt naturalny "],
			date: "2026-07-13",
			limit: 5,
			includePublicFood: true,
			includeUserFood: false,
		});

		expect(fetchStub.calls).toHaveLength(1);
		expect(fetchStub.calls[0]?.input).toBe(
			"https://fitatu.test/api/search/new/food?phrase=jogurt+naturalny&page=1&locale=pl_PL&limit=5&accessType=FREE&accessType=PREMIUM",
		);
		expect(fetchStub.calls[0]?.init?.headers).toMatchObject({ accept: "application/json; version=v3" });
		expect(result).toMatchObject({
			date: "2026-07-13",
			queries: ["jogurt naturalny"],
			queryCount: 1,
			count: 1,
			warnings: [],
		});
		expect(result.items[0]).toMatchObject({
			index: 0,
			queryIndex: 0,
			query: "jogurt naturalny",
			source: "public",
			foodId: "food-1",
			productId: "food-1",
			name: "Jogurt naturalny",
			displayName: "Jogurt naturalny - 1 opakowanie, 180 g, 109.8 kcal",
			brand: "Testowa mleczarnia",
			measureId: "measure-1",
			measureName: "opakowanie",
			measureQuantity: 1,
			weightG: 180,
			kcal: 109.8,
			matchScore: 1,
		});
		expect(result.items[0]?.nutritionPer100g).toMatchObject({ energyKcal: 61, proteinG: 4.3 });
	});

	it("keeps successful results and reports a warning when another source fails", async () => {
		const fetchStub = createFetchStub(
			createJsonResponse({ message: "temporary failure" }, { status: 503 }),
			createJsonResponse({ message: "temporary failure" }, { status: 503 }),
			createJsonResponse([{ id: "user-food-1", name: "Domowa granola" }]),
		);
		const client = new FoodSearchClient({
			baseUrl: "https://fitatu.test/api",
			fetchFn: fetchStub.fetchFn,
			authClient,
			userClient,
		});

		const result = await client.search({
			queries: ["granola"],
			date: "2026-07-13",
			includeDetails: false,
		});

		expect(result.items).toHaveLength(1);
		expect(result.items[0]).toMatchObject({ source: "user", foodId: "user-food-1", name: "Domowa granola" });
		expect(result.warnings).toHaveLength(1);
		expect(result.warnings[0]).toContain("public search failed for query='granola'");
		expect(result.warningDetails[0]).toMatchObject({ query: "granola", source: "public" });
	});

	it("preserves query order and deduplicates repeated rows within each query", async () => {
		const repeatedRow = { id: "food-1", name: "Jogurt" };
		const fetchStub = createFetchStub(
			createJsonResponse({ items: [repeatedRow, repeatedRow] }),
			createJsonResponse({ items: [repeatedRow, repeatedRow] }),
		);
		const client = new FoodSearchClient({
			baseUrl: "https://fitatu.test/api",
			fetchFn: fetchStub.fetchFn,
			authClient,
			userClient,
		});

		const result = await client.search({
			queries: ["jogurt", "jogurt naturalny"],
			includePublicFood: true,
			includeUserFood: false,
		});

		expect(result.queries).toEqual(["jogurt", "jogurt naturalny"]);
		expect(result.items).toHaveLength(2);
		expect(
			result.items.map((item) => ({ queryIndex: item.queryIndex, query: item.query, foodId: item.foodId })),
		).toEqual([
			{ queryIndex: 0, query: "jogurt", foodId: "food-1" },
			{ queryIndex: 1, query: "jogurt naturalny", foodId: "food-1" },
		]);
	});

	it("fails safely when every enabled source variant fails", async () => {
		const unavailable = () => createJsonResponse({ message: "temporary failure" }, { status: 503 });
		const fetchStub = createFetchStub(unavailable(), unavailable(), unavailable(), unavailable());
		const client = new FoodSearchClient({
			baseUrl: "https://fitatu.test/api",
			fetchFn: fetchStub.fetchFn,
			authClient,
			userClient,
		});

		await expect(client.search({ queries: ["granola"] })).rejects.toMatchObject({
			name: "FoodSearchError",
			message: "All Fitatu food search requests failed",
			statusCode: 503,
		});
		expect(fetchStub.calls).toHaveLength(4);
	});

	it("treats malformed successful JSON as a failed search boundary", async () => {
		const fetchStub = createFetchStub(
			new Response("not-json", { status: 200, headers: { "content-type": "application/json" } }),
		);
		const client = new FoodSearchClient({
			baseUrl: "https://fitatu.test/api",
			fetchFn: fetchStub.fetchFn,
			authClient,
			userClient,
		});

		await expect(
			client.search({ queries: ["granola"], includePublicFood: true, includeUserFood: false }),
		).rejects.toMatchObject({
			name: "FoodSearchError",
			message: "All Fitatu food search requests failed",
		});
	});
});
