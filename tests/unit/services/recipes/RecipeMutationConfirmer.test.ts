import { describe, expect, it } from "vitest";
import { FitatuClientError } from "../../../../src/api/fitatuApiClientBase/FitatuClientError.ts";
import { FITATU_CLIENT_OPERATIONS } from "../../../../src/api/fitatuApiClientBase/FitatuClientOperations.ts";
import { RecipeDetails } from "../../../../src/api/recipes/RecipeDetails.ts";
import { RecipeIngredientInput } from "../../../../src/api/recipes/RecipeIngredientInput.ts";
import { RecipeTag } from "../../../../src/api/recipes/RecipeTag.ts";
import { RecipeWriteInput } from "../../../../src/api/recipes/RecipeWriteInput.ts";
import { BoundedPoller } from "../../../../src/shared/BoundedPoller.ts";
import { RecipeMutationConfirmer } from "../../../../src/services/recipes/RecipeMutationConfirmer.ts";
import { SERVICE_ERROR_CODES } from "../../../../src/services/ServiceErrorCode.ts";
import { CreateRecipeTool } from "../../../../src/tools/recipes/CreateRecipeTool.ts";
import { GetRecipeTool } from "../../../../src/tools/recipes/GetRecipeTool.ts";

describe("RecipeMutationConfirmer", () => {
	it("waits through an initial 404 and returns the created recipe only when all written fields match", async () => {
		const notFound = await FitatuClientError.http({
			operation: FITATU_CLIENT_OPERATIONS.recipesGet,
			message: "recipe not found",
			method: "GET",
			endpointTemplate: "/recipes-and-user-action/:recipeId/:userId",
			response: new Response(null, { status: 404 }),
		});
		const expected = recipeInput();
		const responses: Array<RecipeDetails | Error> = [notFound, recipeDetails()];
		let reads = 0;
		const confirmer = new RecipeMutationConfirmer(
			{
				getRecipe: async () => {
					const response = responses[Math.min(reads++, responses.length - 1)]!;
					if (response instanceof Error) {
						throw response;
					}
					return response;
				},
			},
			new BoundedPoller({ intervalMs: 1, timeoutMs: 50 }),
		);

		await expect(confirmer.confirmCreated("200", expected)).resolves.toMatchObject({
			recipeId: "200",
			name: "Dinner",
			servings: 2,
		});
		expect(reads).toBe(2);
	});

	it("confirms replacement only when the new recipe matches and the previous identity is deleted", async () => {
		let previousReads = 0;
		const confirmer = new RecipeMutationConfirmer(
			{
				getRecipe: async (recipeId) => {
					if (String(recipeId) === "200") {
						return recipeDetails();
					}
					previousReads += 1;
					return recipeDetails({
						id: 100,
						name: "Old",
						deleted: previousReads >= 2,
						editable: previousReads < 2,
					});
				},
			},
			new BoundedPoller({ intervalMs: 1, timeoutMs: 50 }),
		);

		await expect(confirmer.confirmReplaced("100", "200", recipeInput())).resolves.toMatchObject({
			recipeId: "200",
		});
		expect(previousReads).toBe(2);
	});

	it("confirms an in-place replacement without requiring a deletion read", async () => {
		let reads = 0;
		const confirmer = new RecipeMutationConfirmer(
			{
				getRecipe: async () => {
					reads += 1;
					return recipeDetails();
				},
			},
			new BoundedPoller({ intervalMs: 1, timeoutMs: 50 }),
		);

		await expect(confirmer.confirmReplaced("200", "200", recipeInput())).resolves.toMatchObject({
			recipeId: "200",
		});
		expect(reads).toBe(1);
	});

	it("confirms deletion when the recipe becomes deleted", async () => {
		let reads = 0;
		const confirmer = new RecipeMutationConfirmer(
			{
				getRecipe: async () => {
					reads += 1;
					return recipeDetails({ deleted: reads >= 2, editable: reads < 2 });
				},
			},
			new BoundedPoller({ intervalMs: 1, timeoutMs: 50 }),
		);

		await expect(confirmer.confirmDeleted("200")).resolves.toBeUndefined();
		expect(reads).toBe(2);
	});

	it("treats a missing recipe as a confirmed deletion", async () => {
		const notFound = await FitatuClientError.http({
			operation: FITATU_CLIENT_OPERATIONS.recipesGet,
			message: "recipe not found",
			method: "GET",
			endpointTemplate: "/recipes-and-user-action/:recipeId/:userId",
			response: new Response(null, { status: 404 }),
		});
		const confirmer = new RecipeMutationConfirmer(
			{ getRecipe: async () => Promise.reject(notFound) },
			new BoundedPoller({ intervalMs: 1, timeoutMs: 50 }),
		);

		await expect(confirmer.confirmDeleted("200")).resolves.toBeUndefined();
	});

	it("reports HTTP 410 as a terminal confirmation read failure", async () => {
		const gone = await FitatuClientError.http({
			operation: FITATU_CLIENT_OPERATIONS.recipesGet,
			message: "recipe gone",
			method: "GET",
			endpointTemplate: "/recipes-and-user-action/:recipeId/:userId",
			response: new Response(null, { status: 410 }),
		});
		const confirmer = new RecipeMutationConfirmer(
			{ getRecipe: async () => Promise.reject(gone) },
			new BoundedPoller({ intervalMs: 1, timeoutMs: 10 }),
		);

		await expect(confirmer.confirmDeleted("200")).rejects.toMatchObject({
			kind: "unconfirmed",
			code: SERVICE_ERROR_CODES.mutationConfirmationReadFailed,
		});
	});

	it("reports a confirmation timeout with the public timeout code", async () => {
		const confirmer = new RecipeMutationConfirmer(
			{ getRecipe: async () => recipeDetails({ name: "Not the submitted recipe" }) },
			new BoundedPoller({ intervalMs: 1, timeoutMs: 5 }),
		);

		await expect(confirmer.confirmCreated("200", recipeInput())).rejects.toMatchObject({
			kind: "unconfirmed",
			code: SERVICE_ERROR_CODES.mutationConfirmationTimeout,
			message: expect.stringContaining(
				`${CreateRecipeTool.toolName}, but its effect could not be confirmed within 60 seconds`,
			),
		});
		await expect(confirmer.confirmCreated("200", recipeInput())).rejects.toMatchObject({
			message: expect.stringContaining(`with ${GetRecipeTool.toolName}`),
		});
	});

	it.each([408, 425, 429, 500])("retries a transient HTTP %s confirmation read", async (statusCode) => {
		const transient = await FitatuClientError.http({
			operation: FITATU_CLIENT_OPERATIONS.recipesGet,
			message: "temporary recipe read failure",
			method: "GET",
			endpointTemplate: "/recipes-and-user-action/:recipeId/:userId",
			response: new Response(null, { status: statusCode }),
		});
		let reads = 0;
		const confirmer = new RecipeMutationConfirmer(
			{
				getRecipe: async () => {
					reads += 1;
					if (reads === 1) {
						throw transient;
					}
					return recipeDetails();
				},
			},
			new BoundedPoller({ intervalMs: 1, timeoutMs: 50 }),
		);

		await expect(confirmer.confirmCreated("200", recipeInput())).resolves.toMatchObject({
			recipeId: "200",
		});
		expect(reads).toBe(2);
	});

	it("retries a transient transport confirmation read", async () => {
		const transient = FitatuClientError.transport({
			operation: FITATU_CLIENT_OPERATIONS.recipesGet,
			message: "temporary transport failure",
			method: "GET",
			endpointTemplate: "/recipes-and-user-action/:recipeId/:userId",
			error: new TypeError("fetch failed"),
		});
		let reads = 0;
		const confirmer = new RecipeMutationConfirmer(
			{
				getRecipe: async () => {
					reads += 1;
					if (reads === 1) {
						throw transient;
					}
					return recipeDetails();
				},
			},
			new BoundedPoller({ intervalMs: 1, timeoutMs: 50 }),
		);

		await expect(confirmer.confirmCreated("200", recipeInput())).resolves.toMatchObject({
			recipeId: "200",
		});
		expect(reads).toBe(2);
	});

	it("stops immediately on an invalid recipe response", async () => {
		let reads = 0;
		const invalidResponse = FitatuClientError.invalidResponse({
			operation: FITATU_CLIENT_OPERATIONS.recipesGet,
			message: "invalid recipe response",
			method: "GET",
			endpointTemplate: "/recipes-and-user-action/:recipeId/:userId",
		});
		const confirmer = new RecipeMutationConfirmer(
			{
				getRecipe: async () => {
					reads += 1;
					throw invalidResponse;
				},
			},
			new BoundedPoller({ intervalMs: 1, timeoutMs: 50 }),
		);

		await expect(confirmer.confirmCreated("200", recipeInput())).rejects.toMatchObject({
			kind: "unconfirmed",
			code: SERVICE_ERROR_CODES.mutationConfirmationReadFailed,
		});
		expect(reads).toBe(1);
	});
});

function recipeInput(): RecipeWriteInput {
	return new RecipeWriteInput(
		"Dinner",
		[new RecipeIngredientInput("10", "2", 1.777)],
		[new RecipeTag("Own", "RECIPE_TAG_USERS_TYPE", "Own")],
		2,
		false,
		"1. Mix",
		20,
		null,
		["breakfast"],
	);
}

function recipeDetails(overrides: Record<string, unknown> = {}): RecipeDetails {
	return RecipeDetails.fromApiResponse({
		id: 200,
		userId: "test-user",
		name: "Dinner",
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
		categories: [{ id: "generated" }],
		tags: [{ name: "own", category: "RECIPE_TAG_USERS_TYPE", translation: "own" }],
		items: [
			{
				itemId: 10,
				productId: 10,
				type: "PRODUCT",
				measureId: 2,
				measureQuantity: "1.78",
				name: "Ingredient",
			},
		],
		...overrides,
	});
}
