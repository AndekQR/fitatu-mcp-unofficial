import { describe, expect, it } from "vitest";
import { RecipeClient } from "../../../../src/api/recipes/RecipeClient.ts";
import { FitatuUserProfile } from "../../../../src/api/users/FitatuUserProfile.ts";
import { createAuthClientStub } from "../../support/authTestDouble.ts";
import { createFetchStub, createJsonResponse } from "../../support/httpTestDouble.ts";

const authClient = createAuthClientStub({ userId: "test-user" });
const userClient = {
	getCurrentUser: async () =>
		FitatuUserProfile.fromApiResponse({
			id: "test-user",
			locale: "en_GB",
			searchLocale: "pl_PL",
		}),
	clearUserCache: () => undefined,
};

describe("RecipeClient", () => {
	it("gets a recipe with user-specific details and maps values per serving", async () => {
		const fetchStub = createFetchStub(
			createJsonResponse({
				id: 159081309,
				userId: "test-user",
				name: "Test dish",
				serving: 2,
				energy: 1785,
				protein: 47,
				fat: 8,
				carbohydrate: 370.5,
				weight: 761.5,
				editable: true,
				deleted: false,
				shared: false,
				recipeDescription: "1. Mix",
				cookingTime: 20,
				preparationTime: null,
				mealSchema: ["breakfast"],
				categories: [],
				tags: [{ name: "owntag1", category: "RECIPE_TAG_USERS_TYPE", translation: "owntag1" }],
				items: [
					{
						itemId: 31940613,
						productId: 31940613,
						recipeId: null,
						name: "Maka poznanska",
						type: "PRODUCT",
						measureId: 2,
						measureQuantity: "1.00",
						measureName: "package",
						measureWeight: "1000.00",
					},
				],
			}),
		);
		const client = new RecipeClient({
			baseUrl: "https://fitatu.test/api",
			fetchFn: fetchStub.fetchFn,
			authClient,
			userClient,
		});

		const recipe = await client.getRecipe("159081309");

		expect(fetchStub.calls[0]?.input).toBe("https://fitatu.test/api/recipes-and-user-action/159081309/test-user");
		expect(recipe).toEqual({
			recipeId: "159081309",
			userId: "test-user",
			name: "Test dish",
			servings: 2,
			shared: false,
			editable: true,
			deleted: false,
			description: "1. Mix",
			cookingTimeMinutes: 20,
			preparationTimeMinutes: null,
			mealSchema: ["breakfast"],
			tags: [{ name: "owntag1", category: "RECIPE_TAG_USERS_TYPE", translation: "owntag1" }],
			ingredients: [
				{
					itemId: "31940613",
					productId: "31940613",
					recipeId: null,
					name: "Maka poznanska",
					type: "PRODUCT",
					measureId: "2",
					measureQuantity: 1,
					measureName: "package",
					measureWeightG: 1000,
				},
			],
			nutritionPerServing: {
				energyKcal: 1785,
				proteinG: 47,
				fatG: 8,
				carbohydrateG: 370.5,
			},
			weightPerServingG: 761.5,
			categories: [],
		});
	});

	it("classifies a missing recipe as non-retryable", async () => {
		const fetchStub = createFetchStub(createJsonResponse({ message: "missing" }, { status: 404 }));
		const client = createClient(fetchStub);

		await expect(client.getRecipe("999")).rejects.toMatchObject({
			name: "RecipeError",
			code: "RECIPE_NOT_FOUND",
			retryable: false,
			statusCode: 404,
		});
	});

	it("creates a private recipe and returns canonical details from read-after-write", async () => {
		const fetchStub = createFetchStub(
			createJsonResponse(
				{
					id: 159081309,
					name: "Test dish",
					energy: 3570,
					fat: 16,
					protein: 94,
					carbohydrate: 741,
				},
				{ status: 201 },
			),
			createJsonResponse(recipeResponse({ id: 159081309, name: "Test dish" })),
		);
		const client = createClient(fetchStub);

		const result = await client.createRecipe({
			name: "Test dish",
			ingredients: [
				{ itemId: "31940613", measureId: "2", measureQuantity: 1, type: "PRODUCT" },
				{ itemId: "118121685", measureId: "2", measureQuantity: 1, type: "PRODUCT" },
			],
			tags: [{ name: "ownTag1", category: "RECIPE_TAG_USERS_TYPE", translation: "ownTag1" }],
			servings: 2,
			shared: false,
			description: "1. Mix",
			cookingTimeMinutes: 20,
			preparationTimeMinutes: null,
			mealSchema: ["breakfast"],
		});

		expect(fetchStub.calls[0]?.input).toBe("https://fitatu.test/api/recipes");
		expect(fetchStub.calls[0]?.init?.method).toBe("POST");
		expect(JSON.parse(String(fetchStub.calls[0]?.init?.body))).toEqual({
			name: "Test dish",
			items: [
				{ itemId: 31940613, measureId: 2, measureQuantity: 1, type: "PRODUCT" },
				{ itemId: 118121685, measureId: 2, measureQuantity: 1, type: "PRODUCT" },
			],
			tags: [{ name: "ownTag1", category: "RECIPE_TAG_USERS_TYPE", translation: "ownTag1" }],
			serving: "2",
			shared: false,
			recipeDescription: "1. Mix",
			cookingTime: 20,
			preparationTime: null,
			mealSchema: ["breakfast"],
			categories: null,
		});
		expect(result.recipeId).toBe("159081309");
		expect(result.details.nutritionPerServing.energyKcal).toBe(100);
	});

	it("replaces a recipe and reports the changed identity returned by Fitatu", async () => {
		const fetchStub = createFetchStub(
			createJsonResponse({ id: 159083724, name: "Test dish 2 edit" }, { status: 201 }),
			createJsonResponse(recipeResponse({ id: 159083724, name: "Test dish 2 edit" })),
		);
		const client = createClient(fetchStub);

		const result = await client.replaceRecipe("159083658", {
			name: "Test dish 2 edit",
			ingredients: [{ itemId: "24882535", measureId: "1", measureQuantity: 20, type: "PRODUCT" }],
			tags: [],
			servings: 2,
			shared: false,
			description: "1. posyp cukrem",
			cookingTimeMinutes: 2,
			preparationTimeMinutes: null,
			mealSchema: [],
			categories: null,
		});

		expect(fetchStub.calls[0]?.input).toBe("https://fitatu.test/api/recipes/159083658");
		expect(fetchStub.calls[0]?.init?.method).toBe("PUT");
		expect(result).toMatchObject({
			previousRecipeId: "159083658",
			recipeId: "159083724",
			identityChanged: true,
		});
	});

	it("deletes a recipe and accepts Fitatu's empty-array response", async () => {
		const fetchStub = createFetchStub(createJsonResponse([]));
		const client = createClient(fetchStub);

		await expect(client.deleteRecipe("159081309")).resolves.toEqual({ recipeId: "159081309" });
		expect(fetchStub.calls[0]?.input).toBe("https://fitatu.test/api/recipes/159081309");
		expect(fetchStub.calls[0]?.init?.method).toBe("DELETE");
	});

	it("searches the user's catalog and keeps only recipes", async () => {
		const fetchStub = createFetchStub(
			createJsonResponse([
				{ foodId: 11, name: "Test recipe", type: "RECIPE", energy: 120 },
				{ foodId: 22, name: "Test product", type: "PRODUCT", energy: 50 },
			]),
		);
		const client = createClient(fetchStub);

		const result = await client.searchRecipes({ query: "Test", scope: "mine", page: 1, limit: 10 });

		expect(fetchStub.calls[0]?.input).toContain("/search/food/user/test-user?phrase=Test&page=1&limit=10");
		expect(result.items).toEqual([
			{
				recipeId: "11",
				name: "Test recipe",
				source: "mine",
				energyKcal: 120,
			},
		]);
	});

	it("returns no owned recipes when Fitatu ignores a query that matches no names", async () => {
		const fetchStub = createFetchStub(
			createJsonResponse([
				{ foodId: 11, name: "Wanted recipe", type: "RECIPE" },
				{ foodId: 22, name: "Unrelated recipe", type: "RECIPE" },
			]),
		);
		const client = createClient(fetchStub);

		const result = await client.searchRecipes({
			query: "ZZZ_NO_SUCH_RECIPE_9F3B1",
			scope: "mine",
			page: 1,
			limit: 20,
		});

		expect(result).toMatchObject({ count: 0, items: [] });
	});

	it("continues through owned catalog pages until it fills the requested filtered page", async () => {
		const fetchStub = createFetchStub(
			createJsonResponse([{ foodId: 11, name: "Unrelated recipe", type: "RECIPE" }]),
			createJsonResponse([{ foodId: 22, name: "ŻÓŁTY Omlet Domowy", type: "RECIPE" }]),
		);
		const client = createClient(fetchStub);

		const result = await client.searchRecipes({
			query: "omlet dom",
			scope: "mine",
			page: 1,
			limit: 1,
		});

		expect(result.items).toEqual([
			{ recipeId: "22", name: "ŻÓŁTY Omlet Domowy", source: "mine", energyKcal: null },
		]);
		expect(fetchStub.calls).toHaveLength(2);
		expect(fetchStub.calls[1]?.input).toContain("page=2");
	});

	it("uses the authenticated user's search locale for case-insensitive name matching", async () => {
		const fetchStub = createFetchStub(createJsonResponse([{ foodId: 11, name: "IRMAK TARIFI", type: "RECIPE" }]));
		const turkishUserClient = {
			getCurrentUser: async () =>
				FitatuUserProfile.fromApiResponse({
					id: "test-user",
					locale: "tr_TR",
					searchLocale: "tr_TR",
				}),
			clearUserCache: () => undefined,
		};
		const client = new RecipeClient({
			baseUrl: "https://fitatu.test/api",
			fetchFn: fetchStub.fetchFn,
			authClient,
			userClient: turkishUserClient,
		});

		const result = await client.searchRecipes({
			query: "ırmak",
			scope: "mine",
			page: 1,
			limit: 20,
		});

		expect(result.items).toEqual([{ recipeId: "11", name: "IRMAK TARIFI", source: "mine", energyKcal: null }]);
	});

	it("paginates after filtering instead of paginating the unfiltered catalog", async () => {
		const fetchStub = createFetchStub(
			createJsonResponse([{ foodId: 11, name: "Target one", type: "RECIPE" }]),
			createJsonResponse([{ foodId: 22, name: "Unrelated", type: "RECIPE" }]),
			createJsonResponse([{ foodId: 33, name: "Target two", type: "RECIPE" }]),
		);
		const client = createClient(fetchStub);

		const result = await client.searchRecipes({
			query: "target",
			scope: "mine",
			page: 2,
			limit: 1,
		});

		expect(result.items).toEqual([{ recipeId: "33", name: "Target two", source: "mine", energyKcal: null }]);
	});

	it("stops safely when Fitatu repeats a full catalog page", async () => {
		const repeatedPage = [{ foodId: 11, name: "Unrelated", type: "RECIPE" }];
		const fetchStub = createFetchStub(createJsonResponse(repeatedPage), createJsonResponse(repeatedPage));
		const client = createClient(fetchStub);

		const result = await client.searchRecipes({
			query: "missing",
			scope: "mine",
			page: 1,
			limit: 1,
		});

		expect(result).toMatchObject({ count: 0, items: [] });
		expect(fetchStub.calls).toHaveLength(2);
	});

	it("retries canonical read when a newly created recipe is briefly unavailable", async () => {
		const fetchStub = createFetchStub(
			createJsonResponse({ id: 159081309, name: "Test dish" }, { status: 201 }),
			createJsonResponse({ message: "not ready" }, { status: 404 }),
			createJsonResponse(recipeResponse({ id: 159081309, name: "Test dish" })),
		);
		const client = createClient(fetchStub);

		const result = await client.createRecipe(validWriteInput());

		expect(result.recipeId).toBe("159081309");
		expect(fetchStub.calls).toHaveLength(3);
	});

	it("applies one total limit and deduplicates ids when searching all catalogs", async () => {
		const fetchStub = createFetchStub(
			createJsonResponse([{ foodId: 11, name: "Mine recipe", type: "RECIPE" }]),
			createJsonResponse([
				{ foodId: 11, name: "Public duplicate recipe", type: "RECIPE" },
				{ foodId: 22, name: "Public other recipe", type: "RECIPE" },
			]),
		);
		const client = createClient(fetchStub);

		const result = await client.searchRecipes({ query: "recipe", scope: "all", page: 1, limit: 1 });

		expect(result.count).toBe(1);
		expect(result.items).toEqual([{ recipeId: "11", name: "Mine recipe", source: "mine", energyKcal: null }]);
		expect(fetchStub.calls[1]?.input).toContain("locale=pl_PL");
	});

	it("filters both catalogs when searching all recipes", async () => {
		const fetchStub = createFetchStub(
			createJsonResponse([{ foodId: 11, name: "Mine", type: "RECIPE" }]),
			createJsonResponse([{ foodId: 22, name: "Public", type: "RECIPE" }]),
		);
		const client = createClient(fetchStub);

		const result = await client.searchRecipes({
			query: "ZZZ_NO_SUCH_RECIPE_9F3B1",
			scope: "all",
			page: 1,
			limit: 20,
		});

		expect(result).toMatchObject({ count: 0, items: [] });
	});

	it("paginates the combined catalog without starving public recipes", async () => {
		const fetchStub = createFetchStub(
			createJsonResponse([{ foodId: 11, name: "Mine 1", type: "RECIPE" }]),
			createJsonResponse([{ foodId: 21, name: "Public 1", type: "RECIPE" }]),
			createJsonResponse([{ foodId: 12, name: "Mine 2", type: "RECIPE" }]),
			createJsonResponse([{ foodId: 22, name: "Public 2", type: "RECIPE" }]),
		);
		const client = createClient(fetchStub);

		const result = await client.searchRecipes({ scope: "all", page: 2, limit: 1 });

		expect(result.items).toEqual([{ recipeId: "21", name: "Public 1", source: "public", energyKcal: null }]);
		expect(fetchStub.calls).toHaveLength(4);
	});

	it.each([
		["empty ingredients", { ...validWriteInput(), ingredients: [] }, "RecipeError"],
		["invalid servings", { ...validWriteInput(), servings: 0 }, "Error"],
		[
			"invalid tag",
			{
				...validWriteInput(),
				tags: [{ name: "", category: "RECIPE_TAG_USERS_TYPE", translation: "tag" }],
			},
			"Error",
		],
	])("rejects %s before making a Fitatu request", async (_name, input, errorName) => {
		const fetchStub = createFetchStub();
		const client = createClient(fetchStub);

		await expect(client.createRecipe(input)).rejects.toMatchObject({ name: errorName });
		expect(fetchStub.calls).toHaveLength(0);
	});
});

function createClient(fetchStub: ReturnType<typeof createFetchStub>): RecipeClient {
	return new RecipeClient({
		baseUrl: "https://fitatu.test/api",
		fetchFn: fetchStub.fetchFn,
		authClient,
		userClient,
	});
}

function recipeResponse(options: { readonly id: number; readonly name: string }): Record<string, unknown> {
	return {
		id: options.id,
		userId: "test-user",
		name: options.name,
		serving: 2,
		energy: 100,
		protein: 10,
		fat: 5,
		carbohydrate: 12,
		editable: true,
		deleted: false,
		shared: false,
		recipeDescription: "1. Mix",
		cookingTime: 20,
		preparationTime: null,
		mealSchema: ["breakfast"],
		categories: [],
		tags: [],
		items: [],
	};
}

function validWriteInput() {
	return {
		name: "Test dish",
		ingredients: [{ itemId: "10", measureId: "2", measureQuantity: 1, type: "PRODUCT" as const }],
		tags: [{ name: "tag", category: "RECIPE_TAG_USERS_TYPE", translation: "tag" }],
		servings: 2,
		shared: false,
		description: null,
		cookingTimeMinutes: null,
		preparationTimeMinutes: null,
		mealSchema: [],
	};
}
