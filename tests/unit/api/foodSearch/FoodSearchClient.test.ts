import { describe, expect, it } from "vitest";
import { FoodSearchClient } from "../../../../src/api/foodSearch/FoodSearchClient.ts";
import { FavouriteFoodsRequest } from "../../../../src/api/foodSearch/FavouriteFoodsRequest.ts";
import { FoodSearchApiResponse } from "../../../../src/api/foodSearch/FoodSearchApiResponse.ts";
import { PublicFoodSearchRequest } from "../../../../src/api/foodSearch/PublicFoodSearchRequest.ts";
import { FoodSearchService } from "../../../../src/services/foodSearch/FoodSearchService.ts";
import { FitatuUserProfile } from "../../../../src/api/users/FitatuUserProfile.ts";
import { createAuthClientStub } from "../../support/authTestDouble.ts";
import { createFetchStub, createJsonResponse } from "../../support/httpTestDouble.ts";

const authClient = createAuthClientStub({ userId: "user-1" });

const userClient = {
	getCurrentUser: async () => FitatuUserProfile.fromApiResponse({ id: "user-1", locale: "pl_PL" }),
	clearUserCache: () => undefined,
};

describe("FoodSearchClient.searchPublicFoodByBarcode", () => {
	it("constructs the public barcode search request from the current user locale", async () => {
		const fetchStub = createFetchStub(createJsonResponse([]));
		const client = new FoodSearchClient({
			baseUrl: "https://fitatu.test/api",
			fetchFn: fetchStub.fetchFn,
			authClient,
			userClient,
		});

		await client.searchPublicFoodByBarcode("5902057001748", 10);

		expect(fetchStub.calls).toHaveLength(1);
		expect(fetchStub.calls[0]?.input).toBe(
			"https://fitatu.test/api/search/new/food?phrase=5902057001748&page=1&locale=pl_PL&limit=10&hasFilters=false&accessType=FREE&accessType=PREMIUM",
		);
	});
});

describe("FoodSearchClient.getFavouriteFoods", () => {
	function createClient(fetchFn: typeof fetch): FoodSearchClient {
		return new FoodSearchClient({ baseUrl: "https://fitatu.test/api", fetchFn, authClient, userClient });
	}

	it("requests the user's favourite foods with paging and an optional phrase", async () => {
		const fetchStub = createFetchStub(createJsonResponse([]));

		await createClient(fetchStub.fetchFn).getFavouriteFoods(new FavouriteFoodsRequest("user-1", 20, "jogurt"));

		expect(fetchStub.calls).toHaveLength(1);
		expect(fetchStub.calls[0]?.input).toBe(
			"https://fitatu.test/api/users/user-1/favorite/foods?page=1&limit=20&phrase=jogurt",
		);
		expect(fetchStub.calls[0]?.init?.method).toBe("GET");
		expect(fetchStub.calls[0]?.init?.headers).toMatchObject({ accept: "application/json; version=v3" });
	});

	it("omits the phrase query parameter when no phrase is given", async () => {
		const fetchStub = createFetchStub(createJsonResponse([]));

		await createClient(fetchStub.fetchFn).getFavouriteFoods(new FavouriteFoodsRequest("user-1", 50));

		expect(fetchStub.calls[0]?.input).toBe("https://fitatu.test/api/users/user-1/favorite/foods?page=1&limit=50");
	});

	it("retries with the plain JSON accept header after an HTTP failure", async () => {
		const fetchStub = createFetchStub(
			createJsonResponse({ message: "unsupported" }, { status: 406 }),
			createJsonResponse([]),
		);

		await createClient(fetchStub.fetchFn).getFavouriteFoods(new FavouriteFoodsRequest("user-1", 5));

		expect(fetchStub.calls).toHaveLength(2);
		expect(fetchStub.calls[1]?.init?.headers).toMatchObject({ accept: "application/json" });
	});

	it("surfaces a typed client error when every attempt fails", async () => {
		const fetchStub = createFetchStub(
			createJsonResponse({ message: "down" }, { status: 503 }),
			createJsonResponse({ message: "down" }, { status: 503 }),
		);

		await expect(
			createClient(fetchStub.fetchFn).getFavouriteFoods(new FavouriteFoodsRequest("user-1", 5)),
		).rejects.toMatchObject({
			name: "FitatuClientError",
			operation: "food.favourites.get",
			failure: { kind: "http", statusCode: 503 },
		});
	});
});

describe("FoodSearchService.getFavouriteFoods", () => {
	function createService(fetchFn: typeof fetch): FoodSearchService {
		return new FoodSearchService(
			new FoodSearchClient({ baseUrl: "https://fitatu.test/api", fetchFn, authClient, userClient }),
		);
	}

	const favouriteRows = [
		{ id: "food-1", name: "Jogurt naturalny", measure: { id: "m1", name: "opakowanie", quantity: 1, weight: 180 } },
		{ id: "food-1", name: "Jogurt naturalny", measure: { id: "m1", name: "opakowanie", quantity: 1, weight: 180 } },
		{ id: "food-2", name: "Kasza gryczana", measure: { id: "m2", name: "g", quantity: 100, weight: 100 } },
	];

	it("maps favourites to deduplicated user-source items using the current user id", async () => {
		const fetchStub = createFetchStub(createJsonResponse({ items: favouriteRows }));

		const result = await createService(fetchStub.fetchFn).getFavouriteFoods("  jogurt  ", 10);

		expect(fetchStub.calls[0]?.input).toBe(
			"https://fitatu.test/api/users/user-1/favorite/foods?page=1&limit=10&phrase=jogurt",
		);
		expect(result.publicItems).toEqual([]);
		expect(result.userItems.map((item) => [item.source, item.productId])).toEqual([
			["user", "food-1"],
			["user", "food-2"],
		]);
	});

	it("treats a blank phrase as no filter and applies the default limit", async () => {
		const fetchStub = createFetchStub(createJsonResponse({ items: [] }));

		await createService(fetchStub.fetchFn).getFavouriteFoods("   ");

		expect(fetchStub.calls[0]?.input).toBe("https://fitatu.test/api/users/user-1/favorite/foods?page=1&limit=50");
	});

	it("truncates the result to the requested limit", async () => {
		const fetchStub = createFetchStub(createJsonResponse({ items: favouriteRows }));

		const result = await createService(fetchStub.fetchFn).getFavouriteFoods(undefined, 1);

		expect(result.userItems).toHaveLength(1);
	});

	it.each([0, 201, 1.5])("rejects limit %s before any HTTP request", async (limit) => {
		const fetchStub = createFetchStub();

		await expect(createService(fetchStub.fetchFn).getFavouriteFoods(undefined, limit)).rejects.toMatchObject({
			name: "FitatuClientError",
			operation: "food.favourites.get",
			message: "limit must be between 1 and 200",
		});
		expect(fetchStub.calls).toHaveLength(0);
	});

	it("propagates upstream failures instead of returning an empty list", async () => {
		const fetchFn: typeof fetch = async () => createJsonResponse({ message: "down" }, { status: 503 });

		await expect(createService(fetchFn).getFavouriteFoods()).rejects.toMatchObject({
			name: "FitatuClientError",
			failure: { kind: "http", statusCode: 503 },
		});
	});
});

describe("FoodSearchService.search", () => {
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
		const client = new FoodSearchService(
			new FoodSearchClient({
				baseUrl: "https://fitatu.test/api",
				fetchFn: fetchStub.fetchFn,
				authClient,
				userClient,
			}),
		);

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
		expect(result.publicItems[0]).toMatchObject({
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
		});
		expect(result.publicItems[0]?.nutritionPer100g).toMatchObject({ energyKcal: 61, proteinG: 4.3 });
		expect(result.userItems).toEqual([]);
	});

	it("keeps successful results and reports a warning when another source fails", async () => {
		const calls: string[] = [];
		const fetchFn: typeof fetch = async (input) => {
			const url = String(input);
			calls.push(url);
			return url.includes("/search/food/user/")
				? createJsonResponse([{ id: "user-food-1", name: "Domowa granola" }])
				: createJsonResponse({ message: "temporary failure" }, { status: 503 });
		};
		const client = new FoodSearchService(
			new FoodSearchClient({
				baseUrl: "https://fitatu.test/api",
				fetchFn,
				authClient,
				userClient,
			}),
		);

		const result = await client.search({
			queries: ["granola"],
			date: "2026-07-13",
			includeDetails: false,
		});

		expect(result.userItems).toHaveLength(1);
		expect(result.userItems[0]).toMatchObject({ source: "user", foodId: "user-food-1", name: "Domowa granola" });
		expect(result.publicItems).toEqual([]);
		expect(result.warnings).toHaveLength(1);
		expect(result.warnings[0]).toContain("public search failed for query='granola'");
		expect(result.warningDetails[0]).toMatchObject({
			query: "granola",
			source: "public",
			clientError: {
				name: "FitatuClientError",
				operation: "food.search",
				failure: { kind: "http", statusCode: 503 },
				attempts: [{ kind: "http", statusCode: 503 }],
			},
		});
		expect(calls).toHaveLength(3);
	});

	it("filters unrelated user results without filtering or deduplicating the public source", async () => {
		const fetchFn: typeof fetch = async (input) => {
			const url = String(input);
			return url.includes("/search/food/user/")
				? createJsonResponse([
						{ id: "shared", name: "Jabłko domowe" },
						{ id: "user-only", name: "Jablko pieczone" },
						{ id: "user-unrelated", name: "Szarlotka" },
					])
				: createJsonResponse([
						{ id: "public-first", name: "Public first" },
						{ id: "shared", name: "Public shared" },
						{ id: "public-last", name: "Public last" },
					]);
		};
		const client = new FoodSearchService(
			new FoodSearchClient({
				baseUrl: "https://fitatu.test/api",
				fetchFn,
				authClient,
				userClient,
			}),
		);

		const result = await client.search({ queries: ["jablko"], date: "2026-07-13" });

		expect(result.userItems.map(({ source, foodId, name }) => ({ source, foodId, name }))).toEqual([
			{ source: "user", foodId: "shared", name: "Jabłko domowe" },
			{ source: "user", foodId: "user-only", name: "Jablko pieczone" },
		]);
		expect(result.publicItems.map(({ source, foodId, name }) => ({ source, foodId, name }))).toEqual([
			{ source: "public", foodId: "public-first", name: "Public first" },
			{ source: "public", foodId: "shared", name: "Public shared" },
			{ source: "public", foodId: "public-last", name: "Public last" },
		]);
	});

	it("starts user and public searches without waiting for either source", async () => {
		let releasePublic: (() => void) | undefined;
		let markPublicStarted: (() => void) | undefined;
		const publicStarted = new Promise<void>((resolve) => {
			markPublicStarted = resolve;
		});
		const publicRelease = new Promise<void>((resolve) => {
			releasePublic = resolve;
		});
		const calls: string[] = [];
		const fetchFn: typeof fetch = async (input) => {
			const url = String(input);
			calls.push(url);
			if (url.includes("/search/new/food")) {
				markPublicStarted?.();
				await publicRelease;
			}
			return createJsonResponse([]);
		};
		const client = new FoodSearchService(
			new FoodSearchClient({
				baseUrl: "https://fitatu.test/api",
				fetchFn,
				authClient,
				userClient,
			}),
		);

		const search = client.search({ queries: ["skyr"], date: "2026-07-13" });
		await publicStarted;
		await new Promise<void>((resolve) => setImmediate(resolve));
		const callsBeforePublicCompleted = calls.length;
		releasePublic?.();
		await search;

		expect(callsBeforePublicCompleted).toBe(2);
	});

	it("preserves query order and deduplicates repeated rows within each query", async () => {
		const repeatedRow = { id: "food-1", name: "Jogurt" };
		const fetchStub = createFetchStub(
			createJsonResponse({ items: [repeatedRow, repeatedRow] }),
			createJsonResponse({ items: [repeatedRow, repeatedRow] }),
		);
		const client = new FoodSearchService(
			new FoodSearchClient({
				baseUrl: "https://fitatu.test/api",
				fetchFn: fetchStub.fetchFn,
				authClient,
				userClient,
			}),
		);

		const result = await client.search({
			queries: ["jogurt", "jogurt naturalny"],
			includePublicFood: true,
			includeUserFood: false,
		});

		expect(result.queries).toEqual(["jogurt", "jogurt naturalny"]);
		expect(result.publicItems).toHaveLength(2);
		expect(
			result.publicItems.map((item) => ({ queryIndex: item.queryIndex, query: item.query, foodId: item.foodId })),
		).toEqual([
			{ queryIndex: 0, query: "jogurt", foodId: "food-1" },
			{ queryIndex: 1, query: "jogurt naturalny", foodId: "food-1" },
		]);
	});

	it("fails safely when every enabled source variant fails", async () => {
		const unavailable = () => createJsonResponse({ message: "temporary failure" }, { status: 503 });
		const fetchStub = createFetchStub(unavailable(), unavailable(), unavailable(), unavailable());
		const client = new FoodSearchService(
			new FoodSearchClient({
				baseUrl: "https://fitatu.test/api",
				fetchFn: fetchStub.fetchFn,
				authClient,
				userClient,
			}),
		);

		await expect(client.search({ queries: ["granola"] })).rejects.toMatchObject({
			name: "FitatuClientError",
			message: "All Fitatu food search requests failed",
			operation: "food.search",
			failure: { kind: "http", statusCode: 503 },
			attempts: [
				{ kind: "http", statusCode: 503 },
				{ kind: "http", statusCode: 503 },
				{ kind: "http", statusCode: 503 },
			],
		});
		expect(fetchStub.calls).toHaveLength(4);
	});

	it("maps malformed successful JSON to an invalid response error", async () => {
		const fetchStub = createFetchStub(
			new Response("not-json", { status: 200, headers: { "content-type": "application/json" } }),
		);
		const client = new FoodSearchService(
			new FoodSearchClient({
				baseUrl: "https://fitatu.test/api",
				fetchFn: fetchStub.fetchFn,
				authClient,
				userClient,
			}),
		);

		await expect(
			client.search({ queries: ["granola"], includePublicFood: true, includeUserFood: false }),
		).rejects.toMatchObject({
			name: "FitatuClientError",
			message: "All Fitatu food search requests failed",
			operation: "food.search",
			failure: {
				kind: "invalidResponse",
				method: "GET",
				endpointTemplate: "/search/new/food",
			},
			attempts: [],
		});
	});

	it("returns the Fitatu search payload as concrete API models", async () => {
		const upstreamPayload = [
			{ id: "food-1", name: "Completely unrelated" },
			{ id: "food-2", name: "Granola" },
		];
		const fetchStub = createFetchStub(createJsonResponse(upstreamPayload));
		const client = new FoodSearchClient({
			baseUrl: "https://fitatu.test/api",
			fetchFn: fetchStub.fetchFn,
			authClient,
			userClient,
		});

		const result = await client.searchPublicFood(
			new PublicFoodSearchRequest("deleted exact recipe name", "pl_PL", 5),
		);

		expect(result).toBeInstanceOf(FoodSearchApiResponse);
		expect(result.items).toMatchObject(upstreamPayload.map(({ id, ...item }) => ({ foodId: id, ...item })));
	});

	it("reads available measures from a type-specific details endpoint", async () => {
		const fetchStub = createFetchStub(
			createJsonResponse({
				measures: [
					{ id: 1, name: "g", weight: 1, energy: 1.25 },
					{ id: 39, name: "portion", weight: 200, energy: 250 },
				],
				simpleMeasures: [{ measureId: 39, weight: 300, energy: 375 }],
			}),
			createJsonResponse({
				measures: [
					{ id: 1, name: "g" },
					{ id: 39, name: "portion" },
				],
			}),
		);
		const client = new FoodSearchService(
			new FoodSearchClient({
				baseUrl: "https://fitatu.test/api",
				fetchFn: fetchStub.fetchFn,
				authClient,
				userClient,
			}),
		);

		await expect(client.getAvailableMeasures("100", "RECIPE")).resolves.toEqual([
			{ measureId: "1", measureName: "g", weightG: 1, unit: null, energyKcal: 1.25 },
			{ measureId: "39", measureName: "portion", weightG: 200, unit: null, energyKcal: 250 },
		]);
		await expect(client.getAvailableMeasureIds("100", "RECIPE")).resolves.toEqual(new Set(["1", "39"]));
		expect(fetchStub.calls[0]?.input).toBe("https://fitatu.test/api/recipes/100");
	});
});
