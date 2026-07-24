import { describe, expect, it } from "vitest";
import type { RecipeCreateResult } from "../../../../src/api/recipes/RecipeCreateResult.ts";
import type { RecipeDeleteResult } from "../../../../src/api/recipes/RecipeDeleteResult.ts";
import type { RecipeDetails } from "../../../../src/api/recipes/RecipeDetails.ts";
import type { RecipeReplaceResult } from "../../../../src/api/recipes/RecipeReplaceResult.ts";
import type { RecipeSearchOptions } from "../../../../src/api/recipes/RecipeSearchOptions.ts";
import type { RecipeSearchResult } from "../../../../src/api/recipes/RecipeSearchResult.ts";
import type { RecipeUpdateInput } from "../../../../src/api/recipes/RecipeUpdateInput.ts";
import type { RecipeWriteInput } from "../../../../src/api/recipes/RecipeWriteInput.ts";
import { RecipeError } from "../../../../src/api/recipes/RecipeError.ts";
import type { RecipeProvider } from "../../../../src/services/recipes/RecipeService.ts";
import { CreateRecipeTool } from "../../../../src/tools/recipes/CreateRecipeTool.ts";
import { DeleteRecipeTool } from "../../../../src/tools/recipes/DeleteRecipeTool.ts";
import { GetRecipeTool } from "../../../../src/tools/recipes/GetRecipeTool.ts";
import { SearchRecipesTool } from "../../../../src/tools/recipes/SearchRecipesTool.ts";
import { UpdateRecipeTool } from "../../../../src/tools/recipes/UpdateRecipeTool.ts";
import { getTextContent, parseTextContent, registerToolForTest } from "../../support/mcpToolTestDouble.ts";

describe("Recipe MCP tools", () => {
	it("create_recipe applies safe defaults and returns canonical recipe details", async () => {
		const service = new RecordingRecipeService();
		const registered = await registerToolForTest(new CreateRecipeTool(service));

		const result = await registered.invoke({
			name: "Test recipe",
			ingredients: [{ itemId: "10", measureId: "2", measureQuantity: 1 }],
			servings: 2,
		});

		expect(registered.name).toBe("create_recipe");
		expect(registered.config.annotations).toMatchObject({
			readOnlyHint: false,
			destructiveHint: false,
			idempotentHint: false,
		});
		expect(service.createInputs[0]).toEqual({
			name: "Test recipe",
			ingredients: [{ itemId: "10", measureId: "2", measureQuantity: 1, type: "PRODUCT" }],
			tags: [],
			servings: 2,
			shared: false,
			description: null,
			cookingTimeMinutes: null,
			preparationTimeMinutes: null,
			mealSchema: [],
		});
		expect(parseTextContent(result)).toMatchObject({ recipeId: "100", details: { name: "Test recipe" } });
	});

	it("get_recipe publishes a read-only contract", async () => {
		const service = new RecordingRecipeService();
		const registered = await registerToolForTest(new GetRecipeTool(service));
		const result = await registered.invoke({ recipeId: "100" });

		expect(registered.config.annotations).toMatchObject({ readOnlyHint: true, idempotentHint: true });
		expect(service.getIds).toEqual(["100"]);
		expect(parseTextContent(result)).toMatchObject({ recipeId: "100", name: "Test recipe" });
	});

	it("search_recipes supports listing with an omitted query", async () => {
		const service = new RecordingRecipeService();
		const registered = await registerToolForTest(new SearchRecipesTool(service));
		const result = await registered.invoke({ scope: "mine", page: 1, limit: 10 });

		expect(service.searchInputs).toEqual([{ scope: "mine", page: 1, limit: 10 }]);
		expect(parseTextContent(result)).toEqual({
			query: "",
			scope: "mine",
			page: 1,
			limit: 10,
			count: 1,
			items: [{ recipeId: "100", name: "Test recipe", source: "mine", energyKcal: 100 }],
		});
	});

	it("update_recipe forwards only fields selected by the caller", async () => {
		const service = new RecordingRecipeService();
		const registered = await registerToolForTest(new UpdateRecipeTool(service));
		const result = await registered.invoke({ recipeId: "100", name: "Changed", servings: 3 });

		expect(registered.config.annotations).toMatchObject({ destructiveHint: true, idempotentHint: false });
		expect(service.updateInputs).toEqual([{ recipeId: "100", input: { name: "Changed", servings: 3 } }]);
		expect(parseTextContent(result)).toMatchObject({
			previousRecipeId: "100",
			recipeId: "200",
			identityChanged: true,
		});
	});

	it("delete_recipe requires exact-name confirmation and is marked destructive", async () => {
		const service = new RecordingRecipeService();
		const registered = await registerToolForTest(new DeleteRecipeTool(service));
		const result = await registered.invoke({ recipeId: "100", expectedName: "Test recipe" });

		expect(registered.config.annotations).toMatchObject({ destructiveHint: true, idempotentHint: false });
		expect(service.deleteInputs).toEqual([{ recipeId: "100", expectedName: "Test recipe" }]);
		expect(parseTextContent(result)).toEqual({ recipeId: "100", name: "Test recipe", deleted: true });
	});

	it.each([
		["empty ingredients", { name: "Test", ingredients: [], servings: 2 }],
		[
			"invalid servings",
			{
				name: "Test",
				ingredients: [{ itemId: "10", measureId: "2", measureQuantity: 1 }],
				servings: 0,
			},
		],
		[
			"invalid tag",
			{
				name: "Test",
				ingredients: [{ itemId: "10", measureId: "2", measureQuantity: 1 }],
				servings: 2,
				tags: [{ name: "", category: "RECIPE_TAG_USERS_TYPE", translation: "tag" }],
			},
		],
	])("create_recipe rejects %s at the MCP boundary", async (_name, input) => {
		const service = new RecordingRecipeService();
		const registered = await registerToolForTest(new CreateRecipeTool(service));

		const result = await registered.invoke(input);

		expect(result.isError).toBe(true);
		expect(service.createInputs).toHaveLength(0);
	});

	it("update_recipe rejects an empty patch", async () => {
		const service = new RecordingRecipeService();
		const registered = await registerToolForTest(new UpdateRecipeTool(service));

		const result = await registered.invoke({ recipeId: "100" });

		expect(result.isError).toBe(true);
		expect(service.updateInputs).toHaveLength(0);
	});

	it.each([
		["invalid servings", { servings: 0 }],
		["empty ingredients", { ingredients: [] }],
		["invalid tag", { tags: [{ name: "", category: "RECIPE_TAG_USERS_TYPE", translation: "tag" }] }],
		["invalid cooking time", { cookingTimeMinutes: -1 }],
	])("update_recipe rejects %s at the MCP boundary", async (_name, patch) => {
		const service = new RecordingRecipeService();
		const registered = await registerToolForTest(new UpdateRecipeTool(service));

		const result = await registered.invoke({ recipeId: "100", ...patch });

		expect(result.isError).toBe(true);
		expect(service.updateInputs).toHaveLength(0);
	});

	it("redacts unexpected recipe service errors", async () => {
		const service = new RecordingRecipeService(new Error("Bearer secret-token"));
		const registered = await registerToolForTest(new GetRecipeTool(service));

		const result = await registered.invoke({ recipeId: "100" });

		expect(result.isError).toBe(true);
		expect(getTextContent(result)).not.toContain("secret-token");
		expect(parseTextContent(result)).toMatchObject({
			status: "error",
			toolName: "get_recipe",
			message: "Unable to get Fitatu recipe.",
		});
	});

	it("redacts user ids and upstream messages from known recipe errors", async () => {
		const service = new RecordingRecipeService(
			new RecipeError("Fitatu recipe details request failed", {
				statusCode: 400,
				fitatuApiError: {
					statusCode: 400,
					statusText: "Bad Request",
					method: "GET",
					path: "/recipes-and-user-action/100/sensitive-user-id",
					upstreamMessage: "Account daniel@example.com failed",
					upstreamCode: "bad_recipe",
					responseSnippet: '{"email":"daniel@example.com"}',
				},
			}),
		);
		const registered = await registerToolForTest(new GetRecipeTool(service));

		const result = await registered.invoke({ recipeId: "100" });
		const text = getTextContent(result);

		expect(text).not.toContain("sensitive-user-id");
		expect(text).not.toContain("daniel@example.com");
		expect(parseTextContent(result)).toMatchObject({
			fitatuApiError: {
				path: "/recipes-and-user-action/100/:userId",
				upstreamMessage: null,
				responseSnippet: null,
			},
		});
	});
});

class RecordingRecipeService implements RecipeProvider {
	public readonly createInputs: RecipeWriteInput[] = [];
	public readonly getIds: (string | number)[] = [];
	public readonly searchInputs: RecipeSearchOptions[] = [];
	public readonly updateInputs: { recipeId: string | number; input: RecipeUpdateInput }[] = [];
	public readonly deleteInputs: { recipeId: string | number; expectedName: string }[] = [];

	public constructor(private readonly error?: Error) {}

	public async createRecipe(input: RecipeWriteInput): Promise<RecipeCreateResult> {
		this.throwWhenConfigured();
		this.createInputs.push(input);
		return { recipeId: "100", details: details() };
	}

	public async getRecipe(recipeId: string | number): Promise<RecipeDetails> {
		this.throwWhenConfigured();
		this.getIds.push(recipeId);
		return details();
	}

	public async searchRecipes(options: RecipeSearchOptions = {}): Promise<RecipeSearchResult> {
		this.throwWhenConfigured();
		this.searchInputs.push(options);
		return {
			query: options.query ?? "",
			scope: options.scope ?? "mine",
			page: options.page ?? 1,
			limit: options.limit ?? 20,
			count: 1,
			items: [{ recipeId: "100", name: "Test recipe", source: "mine", energyKcal: 100 }],
		};
	}

	public async updateRecipe(recipeId: string | number, input: RecipeUpdateInput): Promise<RecipeReplaceResult> {
		this.throwWhenConfigured();
		this.updateInputs.push({ recipeId, input });
		return {
			previousRecipeId: String(recipeId),
			recipeId: "200",
			identityChanged: true,
			details: details({ recipeId: "200", name: "Changed", servings: 3 }),
		};
	}

	public async deleteRecipe(recipeId: string | number, expectedName: string): Promise<RecipeDeleteResult> {
		this.throwWhenConfigured();
		this.deleteInputs.push({ recipeId, expectedName });
		return { recipeId: String(recipeId), name: expectedName, deleted: true };
	}

	private throwWhenConfigured(): void {
		if (this.error) {
			throw this.error;
		}
	}
}

function details(overrides: Partial<RecipeDetails> = {}): RecipeDetails {
	return {
		recipeId: "100",
		userId: "test-user",
		name: "Test recipe",
		servings: 2,
		shared: false,
		editable: true,
		deleted: false,
		description: null,
		cookingTimeMinutes: null,
		preparationTimeMinutes: null,
		mealSchema: [],
		tags: [],
		ingredients: [],
		nutritionPerServing: { energyKcal: 100, proteinG: 10, fatG: 5, carbohydrateG: 12 },
		weightPerServingG: null,
		categories: null,
		...overrides,
	};
}
