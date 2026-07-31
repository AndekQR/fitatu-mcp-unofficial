import { describe, expect, it } from "vitest";
import { RecipeClient } from "../../../../src/api/recipes/RecipeClient.ts";
import { FitatuUserProfile } from "../../../../src/api/users/FitatuUserProfile.ts";
import { DetailedRecipeSearchItem } from "../../../../src/services/recipes/DetailedRecipeSearchItem.ts";
import { RecipeService } from "../../../../src/services/recipes/RecipeService.ts";
import { RecipeServiceDeleteResult } from "../../../../src/services/recipes/RecipeServiceDeleteResult.ts";
import { ServiceError } from "../../../../src/services/ServiceError.ts";
import { SERVICE_ERROR_CODES } from "../../../../src/services/ServiceErrorCode.ts";
import { createAuthClientStub } from "../../support/authTestDouble.ts";
import { createFetchStub, createJsonResponse } from "../../support/httpTestDouble.ts";

const authClient = createAuthClientStub({ userId: "test-user" });
const userClient = {
	getCurrentUser: async () => FitatuUserProfile.fromApiResponse({ id: "test-user", locale: "en_GB" }),
	clearUserCache: () => undefined,
};

describe("RecipeService", () => {
	it("keeps recipe search summaries compact when details are not requested", async () => {
		const fetchStub = createFetchStub(
			createJsonResponse([{ foodId: 100, name: "Summary name", type: "RECIPE", energy: 100 }]),
		);
		const service = createService(fetchStub);

		const result = await service.searchRecipes({
			query: "Summary",
			scope: "mine",
			page: 1,
			limit: 10,
			includeDetails: false,
		});

		expect(result.items).toEqual([
			{
				recipeId: "100",
				name: "Summary name",
				source: "mine",
				energyKcal: 100,
			},
		]);
		expect(fetchStub.calls).toHaveLength(1);
	});

	it("enriches recipe search results with canonical details and measures", async () => {
		const fetchStub = createFetchStub(
			createJsonResponse([{ foodId: 100, name: "Summary name", type: "RECIPE", energy: 90 }]),
			createJsonResponse(recipeResponse({ id: 101, name: "Canonical name", servings: 3 })),
		);
		const service = createService(fetchStub);

		const result = await service.searchRecipes({
			query: "Summary",
			scope: "mine",
			page: 1,
			limit: 10,
			includeDetails: true,
		});

		const [item] = result.items;
		expect(item).toBeInstanceOf(DetailedRecipeSearchItem);
		expect(item).toMatchObject({
			recipeId: "100",
			name: "Summary name",
			source: "mine",
			energyKcal: 90,
		});
		expect((item as DetailedRecipeSearchItem).details).toMatchObject({
			recipeId: "101",
			name: "Canonical name",
			servings: 3,
			measures: [
				{ measureId: "1", measureName: "g" },
				{ measureId: "39", measureName: "portion" },
			],
		});
		expect(result.warnings).toEqual([]);
		expect(fetchStub.calls).toHaveLength(2);
	});

	it("keeps recipe summaries and warns when one details request fails", async () => {
		const fetchStub = createFetchStub(
			createJsonResponse([{ foodId: 100, name: "Summary name", type: "RECIPE", energy: 90 }]),
			createJsonResponse({ message: "temporarily unavailable" }, { status: 503 }),
		);
		const service = createService(fetchStub);

		const result = await service.searchRecipes({
			query: "Summary",
			scope: "mine",
			page: 1,
			limit: 10,
			includeDetails: true,
		});

		expect(result.items).toEqual([
			{
				recipeId: "100",
				name: "Summary name",
				source: "mine",
				energyKcal: 90,
			},
		]);
		expect(result.warnings).toMatchObject([
			{
				code: "RECIPE_DETAILS_UNAVAILABLE",
				source: "mine",
				recipeId: "100",
				clientError: {
					name: "FitatuClientError",
					failure: { kind: "http", statusCode: 503 },
				},
			},
		]);
	});

	it("rejects create when the same product and measure occur more than once", async () => {
		const fetchStub = createFetchStub();
		const service = createService(fetchStub);

		await expect(
			service.createRecipe({
				name: "Duplicate ingredients",
				ingredients: [
					{ itemId: "10", measureId: "2", measureQuantity: 1, type: "PRODUCT" },
					{ itemId: "10", measureId: "2", measureQuantity: 2, type: "PRODUCT" },
				],
				tags: [],
				servings: 2,
				shared: false,
				description: null,
				cookingTimeMinutes: null,
				preparationTimeMinutes: null,
				mealSchema: [],
			}),
		).rejects.toThrow("Ingredient productId 10 with measureId 2 at ingredients[1] duplicates ingredients[0].");
		expect(fetchStub.calls).toHaveLength(0);
	});

	it("rejects update when the same product and measure occur more than once", async () => {
		const fetchStub = createFetchStub();
		const service = createService(fetchStub);

		await expect(
			service.updateRecipe("100", {
				name: "Updated",
				ingredients: [
					{ itemId: "10", measureId: "2", measureQuantity: 1, type: "PRODUCT" },
					{ itemId: "10", measureId: "2", measureQuantity: 3, type: "PRODUCT" },
				],
			}),
		).rejects.toThrow("Ingredient productId 10 with measureId 2 at ingredients[1] duplicates ingredients[0].");
		expect(fetchStub.calls).toHaveLength(0);
	});

	it("updates only selected fields while preserving the current recipe payload", async () => {
		const fetchStub = createFetchStub(
			createJsonResponse(recipeResponse()),
			createJsonResponse({ id: 200, name: "Changed" }, { status: 201 }),
			createJsonResponse(recipeResponse({ id: 200, name: "Changed", servings: 3 })),
			createJsonResponse({ ...recipeResponse({ id: 100 }), deleted: true, editable: false }),
		);
		const service = createService(fetchStub);

		const result = await service.updateRecipe("100", { name: "Changed", servings: 3 });

		expect(JSON.parse(String(fetchStub.calls[1]?.init?.body))).toEqual({
			name: "Changed",
			items: [{ itemId: 10, measureId: 2, measureQuantity: 1, type: "PRODUCT" }],
			tags: [{ name: "own", category: "RECIPE_TAG_USERS_TYPE", translation: "own" }],
			serving: "3",
			shared: false,
			recipeDescription: "1. Mix",
			cookingTime: 20,
			preparationTime: null,
			mealSchema: ["breakfast"],
			categories: [{ id: "preserved" }],
		});
		expect(result).toMatchObject({
			previousRecipeId: "100",
			recipeId: "200",
			identityChanged: true,
			details: {
				measures: [
					{ measureId: "1", measureName: "g" },
					{ measureId: "39", measureName: "portion" },
				],
			},
		});
	});

	it("blocks updates to recipes not owned by the authenticated user", async () => {
		const fetchStub = createFetchStub(createJsonResponse(recipeResponse({ userId: 999 })));
		const service = createService(fetchStub);

		await expect(service.updateRecipe("100", { name: "Changed" })).rejects.toEqual(
			new ServiceError(
				"Recipe 100 is not owned by the authenticated user",
				"forbidden",
				SERVICE_ERROR_CODES.recipeNotOwned,
			),
		);
		expect(fetchStub.calls).toHaveLength(1);
	});

	it("requires the current exact name before deleting an owned recipe", async () => {
		const fetchStub = createFetchStub(
			createJsonResponse(recipeResponse()),
			createJsonResponse([]),
			createJsonResponse({ ...recipeResponse(), deleted: true }),
		);
		const service = createService(fetchStub);

		const result = await service.deleteRecipe("100", "Original");

		expect(result).toBeInstanceOf(RecipeServiceDeleteResult);
		expect(result).toEqual({
			status: "accepted",
			recipeId: "100",
			name: "Original",
			deleted: true,
		});
		expect(fetchStub.calls[1]?.init?.method).toBe("DELETE");
		expect(fetchStub.calls[2]?.init?.method).toBe("GET");
	});

	it("does not delete when the expected name differs", async () => {
		const fetchStub = createFetchStub(createJsonResponse(recipeResponse()));
		const service = createService(fetchStub);

		await expect(service.deleteRecipe("100", "Wrong")).rejects.toEqual(
			new ServiceError(
				"expectedName did not match the current recipe name",
				"conflict",
				SERVICE_ERROR_CODES.recipeNameMismatch,
			),
		);
		expect(fetchStub.calls).toHaveLength(1);
	});

	it.each([
		["update", (service: RecipeService) => service.updateRecipe("100", { name: "Changed" })],
		["delete", (service: RecipeService) => service.deleteRecipe("100", "Original")],
	])("blocks %s for a non-editable recipe", async (_operation, action) => {
		const fetchStub = createFetchStub(createJsonResponse(recipeResponse({ editable: false })));
		const service = createService(fetchStub);

		await expect(action(service)).rejects.toEqual(
			new ServiceError("Recipe 100 is not editable", "conflict", SERVICE_ERROR_CODES.recipeNotEditable),
		);
		expect(fetchStub.calls).toHaveLength(1);
	});

	it("blocks deletion of a recipe owned by another user", async () => {
		const fetchStub = createFetchStub(createJsonResponse(recipeResponse({ userId: 999 })));
		const service = createService(fetchStub);

		await expect(service.deleteRecipe("100", "Original")).rejects.toEqual(
			new ServiceError(
				"Recipe 100 is not owned by the authenticated user",
				"forbidden",
				SERVICE_ERROR_CODES.recipeNotOwned,
			),
		);
		expect(fetchStub.calls).toHaveLength(1);
	});

	it("rejects an ingredient measure that does not belong to its product before writing", async () => {
		const fetchStub = createFetchStub();
		const service = createService(fetchStub, {
			getAvailableMeasureIds: async () => new Set(["1"]),
		});

		await expect(
			service.createRecipe({
				name: "Invalid measure",
				ingredients: [{ itemId: "10", measureId: "2", measureQuantity: 1, type: "PRODUCT" }],
				tags: [],
				servings: 2,
				shared: false,
				description: null,
				cookingTimeMinutes: null,
				preparationTimeMinutes: null,
				mealSchema: [],
			}),
		).rejects.toThrow("Measure at ingredients[0].measureId does not belong to the selected ingredient product.");
		expect(fetchStub.calls).toHaveLength(0);
	});

	it("rejects unsupported tag categories before writing", async () => {
		const fetchStub = createFetchStub();
		const service = createService(fetchStub);

		await expect(
			service.createRecipe({
				name: "Invalid tag",
				ingredients: [{ itemId: "10", measureId: "2", measureQuantity: 1, type: "PRODUCT" }],
				tags: [{ name: "x", category: "INVALID_CATEGORY", translation: "x" }],
				servings: 2,
				shared: false,
				description: null,
				cookingTimeMinutes: null,
				preparationTimeMinutes: null,
				mealSchema: [],
			}),
		).rejects.toThrow(
			"Unsupported tags[0].category. Use RECIPE_TAG_USERS_TYPE for a custom tag or preserve a category returned by get_recipe.",
		);
		expect(fetchStub.calls).toHaveLength(0);
	});
});

function createService(
	fetchStub: ReturnType<typeof createFetchStub>,
	foodMeasureProvider?: {
		getAvailableMeasureIds(
			foodId: string | number,
			foodType: "PRODUCT" | "RECIPE" | "CUSTOM_ITEM",
		): Promise<ReadonlySet<string>>;
		getAvailableMeasures?(
			foodId: string | number,
			foodType: "PRODUCT" | "RECIPE" | "CUSTOM_ITEM",
		): Promise<
			readonly {
				readonly measureId: string | null;
				readonly measureName: string | null;
				readonly weightG: number | null;
				readonly unit: string | null;
				readonly energyKcal: number | null;
			}[]
		>;
	},
): RecipeService {
	return new RecipeService(
		new RecipeClient({
			baseUrl: "https://fitatu.test/api",
			fetchFn: fetchStub.fetchFn,
			authClient,
			userClient,
		}),
		{
			getAvailableMeasureIds: foodMeasureProvider?.getAvailableMeasureIds ?? (async () => new Set(["2"])),
			getAvailableMeasures:
				foodMeasureProvider?.getAvailableMeasures ??
				(async () => [
					{
						measureId: "1",
						measureName: "g",
						weightG: 1,
						unit: null,
						energyKcal: 0.5,
					},
					{
						measureId: "39",
						measureName: "portion",
						weightG: 200,
						unit: null,
						energyKcal: 100,
					},
				]),
		},
	);
}

function recipeResponse(
	overrides: {
		readonly id?: number;
		readonly userId?: number;
		readonly name?: string;
		readonly servings?: number;
		readonly editable?: boolean;
	} = {},
): Record<string, unknown> {
	return {
		id: overrides.id ?? 100,
		userId: overrides.userId ?? "test-user",
		name: overrides.name ?? "Original",
		serving: overrides.servings ?? 2,
		energy: 100,
		protein: 10,
		fat: 5,
		carbohydrate: 12,
		editable: overrides.editable ?? true,
		deleted: false,
		shared: false,
		recipeDescription: "1. Mix",
		cookingTime: 20,
		preparationTime: null,
		mealSchema: ["breakfast"],
		categories: [{ id: "preserved" }],
		tags: [{ name: "own", category: "RECIPE_TAG_USERS_TYPE", translation: "own" }],
		items: [
			{
				itemId: 10,
				productId: 10,
				type: "PRODUCT",
				measureId: 2,
				measureQuantity: "1.00",
				name: "Ingredient",
			},
		],
	};
}
