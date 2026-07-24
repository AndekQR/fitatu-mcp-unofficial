import { describe, expect, it } from "vitest";
import { RecipeClient } from "../../../../src/api/recipes/RecipeClient.ts";
import { RecipeError } from "../../../../src/api/recipes/RecipeError.ts";
import { FitatuUserProfile } from "../../../../src/api/users/FitatuUserProfile.ts";
import { RecipeService } from "../../../../src/services/recipes/RecipeService.ts";
import { createAuthClientStub } from "../../support/authTestDouble.ts";
import { createFetchStub, createJsonResponse } from "../../support/httpTestDouble.ts";

const authClient = createAuthClientStub({ userId: "test-user" });
const userClient = {
	getCurrentUser: async () => FitatuUserProfile.fromApiResponse({ id: "test-user", locale: "en_GB" }),
	clearUserCache: () => undefined,
};

describe("RecipeService", () => {
	it("updates only selected fields while preserving the current recipe payload", async () => {
		const fetchStub = createFetchStub(
			createJsonResponse(recipeResponse()),
			createJsonResponse({ id: 200, name: "Changed" }, { status: 201 }),
			createJsonResponse(recipeResponse({ id: 200, name: "Changed", servings: 3 })),
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
		});
	});

	it("blocks updates to recipes not owned by the authenticated user", async () => {
		const fetchStub = createFetchStub(createJsonResponse(recipeResponse({ userId: 999 })));
		const service = createService(fetchStub);

		await expect(service.updateRecipe("100", { name: "Changed" })).rejects.toEqual(
			new RecipeError("Recipe 100 is not owned by the authenticated user"),
		);
		expect(fetchStub.calls).toHaveLength(1);
	});

	it("requires the current exact name before deleting an owned recipe", async () => {
		const fetchStub = createFetchStub(createJsonResponse(recipeResponse()), createJsonResponse([]));
		const service = createService(fetchStub);

		await expect(service.deleteRecipe("100", "Original")).resolves.toEqual({
			recipeId: "100",
			name: "Original",
			deleted: true,
		});
		expect(fetchStub.calls[1]?.init?.method).toBe("DELETE");
	});

	it("does not delete when the expected name differs", async () => {
		const fetchStub = createFetchStub(createJsonResponse(recipeResponse()));
		const service = createService(fetchStub);

		await expect(service.deleteRecipe("100", "Wrong")).rejects.toEqual(
			new RecipeError("Recipe name confirmation did not match"),
		);
		expect(fetchStub.calls).toHaveLength(1);
	});

	it.each([
		["update", (service: RecipeService) => service.updateRecipe("100", { name: "Changed" })],
		["delete", (service: RecipeService) => service.deleteRecipe("100", "Original")],
	])("blocks %s for a non-editable recipe", async (_operation, action) => {
		const fetchStub = createFetchStub(createJsonResponse(recipeResponse({ editable: false })));
		const service = createService(fetchStub);

		await expect(action(service)).rejects.toEqual(new RecipeError("Recipe 100 is not editable"));
		expect(fetchStub.calls).toHaveLength(1);
	});

	it("blocks deletion of a recipe owned by another user", async () => {
		const fetchStub = createFetchStub(createJsonResponse(recipeResponse({ userId: 999 })));
		const service = createService(fetchStub);

		await expect(service.deleteRecipe("100", "Original")).rejects.toEqual(
			new RecipeError("Recipe 100 is not owned by the authenticated user"),
		);
		expect(fetchStub.calls).toHaveLength(1);
	});
});

function createService(fetchStub: ReturnType<typeof createFetchStub>): RecipeService {
	return new RecipeService(
		new RecipeClient({
			baseUrl: "https://fitatu.test/api",
			fetchFn: fetchStub.fetchFn,
			authClient,
			userClient,
		}),
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
