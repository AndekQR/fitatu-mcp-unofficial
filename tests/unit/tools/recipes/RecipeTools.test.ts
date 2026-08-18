import { describe, expect, it } from "vitest";
import { RecipeCreateResult } from "../../../../src/api/recipes/RecipeCreateResult.ts";
import { RecipeDeleteResult } from "../../../../src/api/recipes/RecipeDeleteResult.ts";
import { RecipeDetails } from "../../../../src/api/recipes/RecipeDetails.ts";
import { RecipeReplaceResult } from "../../../../src/api/recipes/RecipeReplaceResult.ts";
import { RecipeSearchItem } from "../../../../src/api/recipes/RecipeSearchItem.ts";
import type { RecipeSearchOptions } from "../../../../src/api/recipes/RecipeSearchOptions.ts";
import { RecipeSearchResult } from "../../../../src/api/recipes/RecipeSearchResult.ts";
import { RecipeSearchWarning } from "../../../../src/api/recipes/RecipeSearchWarning.ts";
import type { RecipeUpdateInput } from "../../../../src/api/recipes/RecipeUpdateInput.ts";
import type { RecipeWriteInput } from "../../../../src/api/recipes/RecipeWriteInput.ts";
import { FitatuClientError } from "../../../../src/api/fitatuApiClientBase/FitatuClientError.ts";
import { FITATU_CLIENT_OPERATIONS } from "../../../../src/api/fitatuApiClientBase/FitatuClientOperations.ts";
import type { RecipeProvider } from "../../../../src/services/recipes/RecipeService.ts";
import { DetailedRecipeSearchItem } from "../../../../src/services/recipes/DetailedRecipeSearchItem.ts";
import { RecipeDetailsUnavailableWarning } from "../../../../src/services/recipes/RecipeDetailsUnavailableWarning.ts";
import { RecipeServiceCreateResult } from "../../../../src/services/recipes/RecipeServiceCreateResult.ts";
import { RecipeServiceDeleteResult } from "../../../../src/services/recipes/RecipeServiceDeleteResult.ts";
import { RecipeServiceDetails } from "../../../../src/services/recipes/RecipeServiceDetails.ts";
import { RecipeServiceReplaceResult } from "../../../../src/services/recipes/RecipeServiceReplaceResult.ts";
import type { RecipeWarning } from "../../../../src/services/recipes/RecipeWarning.ts";
import { MutationConfirmationContext } from "../../../../src/services/MutationConfirmationContext.ts";
import { MutationConfirmationError } from "../../../../src/services/MutationConfirmationError.ts";
import { SERVICE_ERROR_CODES } from "../../../../src/services/ServiceErrorCode.ts";
import { CreateRecipeTool } from "../../../../src/tools/recipes/CreateRecipeTool.ts";
import { DeleteRecipeTool } from "../../../../src/tools/recipes/DeleteRecipeTool.ts";
import { GetRecipeTool } from "../../../../src/tools/recipes/GetRecipeTool.ts";
import { SearchRecipesTool } from "../../../../src/tools/recipes/SearchRecipesTool.ts";
import { UpdateRecipeTool } from "../../../../src/tools/recipes/UpdateRecipeTool.ts";
import { getTextContent, parseTextContent, registerToolForTest } from "../../support/mcpToolTestDouble.ts";

describe("Recipe MCP tools", () => {
	it("retains canonical API receipts when enriching recipe mutation results", () => {
		const created = new RecipeCreateResult("100");
		const createResult = new RecipeServiceCreateResult(created, details(), []);
		const replaced = new RecipeReplaceResult(new RecipeCreateResult("200"), "100", true);
		const replaceResult = new RecipeServiceReplaceResult(replaced, details({ recipeId: "200" }), []);

		expect(createResult.created).toBe(created);
		expect(createResult.recipeId).toBe("100");
		expect(replaceResult.replaced).toBe(replaced);
		expect(replaceResult.recipeId).toBe("200");
	});

	it.each([
		{
			name: "timeout",
			error: MutationConfirmationError.timeout(
				new MutationConfirmationContext(CreateRecipeTool.toolName, GetRecipeTool.toolName),
			),
			code: SERVICE_ERROR_CODES.mutationConfirmationTimeout,
			messagePattern: /accepted.*could not be confirmed.*do not retry automatically/i,
		},
		{
			name: "terminal read failure",
			error: MutationConfirmationError.readFailed(
				new MutationConfirmationContext(CreateRecipeTool.toolName, GetRecipeTool.toolName),
			),
			code: SERVICE_ERROR_CODES.mutationConfirmationReadFailed,
			messagePattern: /accepted.*confirmation read failed.*do not retry automatically/i,
		},
	])("maps a recipe $name to a safe public unconfirmed error", async (testCase) => {
		const registered = await registerToolForTest(new CreateRecipeTool(new RecordingRecipeService(testCase.error)));

		const result = await registered.invoke({
			name: "Test recipe",
			ingredients: [{ productId: "10", measureId: "2", measureQuantity: 1 }],
			servings: 2,
		});

		expect(result.isError).toBe(true);
		expect(parseTextContent(result)).toEqual({
			status: "error",
			toolName: "create_recipe",
			error: {
				source: "service",
				name: "MutationConfirmationError",
				message: expect.stringMatching(testCase.messagePattern),
				kind: "unconfirmed",
				code: testCase.code,
			},
		});
		expect(result.structuredContent).toBeUndefined();
	});

	it("create_recipe applies safe defaults and returns canonical recipe details", async () => {
		const service = new RecordingRecipeService();
		const registered = await registerToolForTest(new CreateRecipeTool(service));

		const result = await registered.invoke({
			name: "Test recipe",
			ingredients: [{ productId: "10", measureId: "2", measureQuantity: 1 }],
			servings: 2,
			steps: ["Mix the ingredients", "Cook until ready"],
		});

		expect(registered.name).toBe("create_recipe");
		expect(registered.config.annotations).toMatchObject({
			readOnlyHint: false,
			destructiveHint: false,
			idempotentHint: false,
		});
		expect(registered.config.description).toContain("Returns { status, recipeId, details, warnings }");
		expect(registered.config.outputSchema).toMatchObject({ type: "object" });
		expect(registered.config.outputSchema?.required).toEqual(
			expect.arrayContaining(["status", "recipeId", "details", "warnings"]),
		);
		const serializedInputSchema = JSON.stringify(registered.config.inputSchema);
		expect(serializedInputSchema).toContain("results[].userItems[].productId");
		expect(serializedInputSchema).toContain("results[].publicItems[].productId");
		expect(serializedInputSchema).not.toContain("results[].items[]");
		expect(serializedInputSchema).toContain("Fitatu may normalize custom tag text to lowercase");
		expect(service.createInputs[0]).toEqual({
			name: "Test recipe",
			ingredients: [{ itemId: "10", measureId: "2", measureQuantity: 1, type: "PRODUCT" }],
			tags: [],
			servings: 2,
			shared: false,
			description: "1. Mix the ingredients\n2. Cook until ready",
			cookingTimeMinutes: null,
			preparationTimeMinutes: null,
			mealSchema: [],
		});
		expect(parseTextContent(result)).toMatchObject({
			recipeId: "100",
			details: {
				name: "Test recipe",
				measures: [
					{ measureId: "1", measureName: "g" },
					{ measureId: "39", measureName: "portion" },
				],
			},
			warnings: [],
		});
		expect(result.structuredContent).toMatchObject({
			recipeId: "100",
			details: { name: "Test recipe" },
			warnings: [],
		});
	});

	it("create_recipe publishes non-fatal duplicate ingredient warnings", async () => {
		const service = new RecordingRecipeService();
		service.writeWarnings.push({
			code: "DUPLICATE_INGREDIENT_SELECTION",
			message: "Ingredient itemId 10 with measureId 2 appears more than once.",
			itemId: "10",
			measureId: "2",
			indexes: [0, 1],
		});
		const registered = await registerToolForTest(new CreateRecipeTool(service));

		const result = await registered.invoke({
			name: "Test recipe",
			ingredients: [
				{ productId: "10", measureId: "2", measureQuantity: 1 },
				{ productId: "10", measureId: "2", measureQuantity: 2 },
			],
			servings: 2,
		});

		expect(parseTextContent(result)).toMatchObject({
			warnings: [
				{
					code: "DUPLICATE_INGREDIENT_SELECTION",
					productId: "10",
					measureId: "2",
					indexes: [0, 1],
				},
			],
		});
	});

	it("get_recipe publishes a read-only contract", async () => {
		const service = new RecordingRecipeService();
		service.detailsValue = details({ description: "1. Prepare\n2. Serve" });
		const registered = await registerToolForTest(new GetRecipeTool(service));
		const result = await registered.invoke({ recipeId: "100" });
		const payload = parseTextContent(result) as Record<string, unknown>;

		expect(registered.config.annotations).toMatchObject({ readOnlyHint: true, idempotentHint: true });
		expect(registered.config.description).toContain("Returns canonical recipe details");
		expect(registered.config.outputSchema?.required).toEqual(
			expect.arrayContaining(["recipeId", "name", "editable", "deleted", "mealSchema", "measures"]),
		);
		expect(service.getIds).toEqual(["100"]);
		expect(payload).toMatchObject({
			recipeId: "100",
			name: "Test recipe",
			steps: ["Prepare", "Serve"],
			measures: [
				{ measureId: "1", measureName: "g" },
				{ measureId: "39", measureName: "portion" },
			],
		});
		expect(payload).not.toHaveProperty("description");
		expect(result.structuredContent).toMatchObject({
			recipeId: "100",
			name: "Test recipe",
			steps: ["Prepare", "Serve"],
		});
		expect(result.structuredContent).not.toHaveProperty("description");
	});

	it("get_recipe preserves catalog meal schema values that are not mutation inputs", async () => {
		const service = new RecordingRecipeService();
		service.detailsValue = details({ mealSchema: ["breakfast", "dinner"] });
		const registered = await registerToolForTest(new GetRecipeTool(service));

		const result = await registered.invoke({ recipeId: "100" });

		expect(parseTextContent(result)).toMatchObject({ mealSchema: ["breakfast", "dinner"] });
		expect(JSON.stringify(registered.config.outputSchema)).toContain(
			"not the accepted input enum for recipe mutations",
		);
	});

	it("get_recipe accepts and trims any non-empty raw recipe id supported by the client", async () => {
		const service = new RecordingRecipeService();
		const registered = await registerToolForTest(new GetRecipeTool(service));

		const result = await registered.invoke({ recipeId: "  recipe:100  " });

		expect(result.isError).not.toBe(true);
		expect(service.getIds).toEqual(["recipe:100"]);
	});

	it("get_recipe omits nutritionPerServing when Fitatu provides no nutrient values", async () => {
		const service = new RecordingRecipeService();
		service.detailsValue = details({}, false);
		const registered = await registerToolForTest(new GetRecipeTool(service));

		const result = await registered.invoke({ recipeId: "100" });

		expect(result.isError).not.toBe(true);
		expect(parseTextContent(result)).not.toHaveProperty("nutritionPerServing");
		expect(registered.config.outputSchema?.required).not.toContain("nutritionPerServing");
	});

	it("search_recipes supports listing with an omitted query", async () => {
		const service = new RecordingRecipeService();
		const clientError = await FitatuClientError.http({
			operation: FITATU_CLIENT_OPERATIONS.recipesSearch,
			message: "Fitatu public recipe search failed",
			method: "GET",
			endpointTemplate: "/search/new/food",
			response: new Response(null, { status: 503, statusText: "Service Unavailable" }),
		});
		service.searchWarnings.push({
			code: "RECIPE_SOURCE_UNAVAILABLE",
			source: "public",
			message: "public recipe catalog was unavailable; results are partial.",
			clientError,
		});
		const registered = await registerToolForTest(new SearchRecipesTool(service));
		const result = await registered.invoke({ scope: "mine", page: 1, limit: 10 });

		expect(registered.config.description).toContain(
			"Returns { query, scope, page, limit, count, items, warnings }",
		);
		expect(registered.config.outputSchema?.required).toEqual(
			expect.arrayContaining(["query", "scope", "page", "limit", "count", "items", "warnings"]),
		);
		expect(JSON.stringify(registered.config.inputSchema)).toContain(
			"These details can be useful when adding a selected recipe to a day plan",
		);
		expect(service.searchInputs).toEqual([{ scope: "mine", page: 1, limit: 10, includeDetails: false }]);
		expect(parseTextContent(result)).toEqual({
			query: "",
			scope: "mine",
			page: 1,
			limit: 10,
			count: 1,
			items: [{ recipeId: "100", name: "Test recipe", source: "mine", energyKcal: 100 }],
			warnings: [
				{
					code: "RECIPE_SOURCE_UNAVAILABLE",
					source: "public",
					message: "public recipe catalog was unavailable; results are partial.",
					clientError: {
						name: "FitatuClientError",
						message: "Fitatu public recipe search failed",
						operation: "recipes.search",
						failure: {
							kind: "http",
							method: "GET",
							endpointTemplate: "/search/new/food",
							statusCode: 503,
							statusText: "Service Unavailable",
							upstreamMessage: null,
							upstreamCode: null,
							responseSnippet: null,
						},
						attempts: [],
					},
				},
			],
		});
		expect(result.structuredContent).toMatchObject({ count: 1, items: [{ recipeId: "100" }] });
	});

	it("search_recipes publishes canonical details and measures at the item top level", async () => {
		const service = new RecordingRecipeService();
		service.detailsValue = details({ recipeId: "101", name: "Canonical recipe", servings: 3 });
		const registered = await registerToolForTest(new SearchRecipesTool(service));

		const result = await registered.invoke({
			query: "recipe",
			scope: "mine",
			page: 1,
			limit: 10,
			includeDetails: true,
		});
		const payload = parseTextContent(result) as Record<string, unknown>;

		expect(service.searchInputs).toEqual([
			{
				query: "recipe",
				scope: "mine",
				page: 1,
				limit: 10,
				includeDetails: true,
			},
		]);
		expect(payload).toMatchObject({
			items: [
				{
					recipeId: "101",
					name: "Canonical recipe",
					source: "mine",
					energyKcal: 100,
					servings: 3,
					nutritionPerServing: { energyKcal: 100 },
					measures: [
						{ measureId: "1", measureName: "g" },
						{ measureId: "39", measureName: "portion" },
					],
				},
			],
		});
		expect(JSON.stringify(payload)).not.toContain('"details"');
		expect(JSON.stringify(payload)).not.toContain('"categories"');
		expect(JSON.stringify(registered.config.outputSchema)).toContain("RECIPE_DETAILS_UNAVAILABLE");
	});

	it("search_recipes publishes safe warnings for unavailable recipe details", async () => {
		const service = new RecordingRecipeService();
		service.searchWarnings.push(
			new RecipeDetailsUnavailableWarning(
				new RecipeSearchWarning(
					"RECIPE_DETAILS_UNAVAILABLE",
					"mine",
					"Details were unavailable.",
					await recipeApiError(503, "Service Unavailable"),
				),
				"100",
			),
		);
		const registered = await registerToolForTest(new SearchRecipesTool(service));

		const result = await registered.invoke({ query: "recipe", includeDetails: true });

		expect(parseTextContent(result)).toMatchObject({
			warnings: [
				{
					code: "RECIPE_DETAILS_UNAVAILABLE",
					source: "mine",
					recipeId: "100",
					clientError: {
						name: "FitatuClientError",
						failure: { kind: "http", statusCode: 503 },
					},
				},
			],
		});
	});

	it("search_recipes returns a concise SDK validation error for an invalid query type", async () => {
		const service = new RecordingRecipeService();
		const registered = await registerToolForTest(new SearchRecipesTool(service));

		const result = await registered.invoke({ query: null });
		const text = getTextContent(result);

		expect(result.isError).toBe(true);
		expect(text).toContain('"query"');
		expect(text).toContain("expected string");
		expect(text).not.toContain('"inputSchema"');
		expect(text.length).toBeLessThan(1_000);
		expect(service.searchInputs).toHaveLength(0);
	});

	it("update_recipe forwards only fields selected by the caller", async () => {
		const service = new RecordingRecipeService();
		const registered = await registerToolForTest(new UpdateRecipeTool(service));
		const result = await registered.invoke({
			recipeId: "100",
			name: "Changed",
			servings: 3,
			steps: ["Prepare", "Serve"],
		});

		expect(registered.config.annotations).toMatchObject({ destructiveHint: true, idempotentHint: false });
		expect(registered.config.description).toContain(
			"Returns { status, previousRecipeId, recipeId, identityChanged, details, warnings }",
		);
		expect(registered.config.outputSchema?.required).toEqual(
			expect.arrayContaining([
				"status",
				"previousRecipeId",
				"recipeId",
				"identityChanged",
				"details",
				"warnings",
			]),
		);
		expect(service.updateInputs).toEqual([
			{
				recipeId: "100",
				input: { name: "Changed", servings: 3, description: "1. Prepare\n2. Serve" },
			},
		]);
		expect(parseTextContent(result)).toMatchObject({
			previousRecipeId: "100",
			recipeId: "200",
			identityChanged: true,
			details: {
				measures: [
					{ measureId: "1", measureName: "g" },
					{ measureId: "39", measureName: "portion" },
				],
			},
			warnings: [],
		});
		expect(result.structuredContent).toMatchObject({
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
		expect(registered.config.description).toContain("Returns { status, recipeId, name, deleted }");
		expect(registered.config.outputSchema?.required).toEqual(
			expect.arrayContaining(["status", "recipeId", "name", "deleted"]),
		);
		expect(service.deleteInputs).toEqual([{ recipeId: "100", expectedName: "Test recipe" }]);
		expect(parseTextContent(result)).toEqual({
			status: "accepted",
			recipeId: "100",
			name: "Test recipe",
			deleted: true,
		});
		expect(result.structuredContent).toEqual({
			status: "accepted",
			recipeId: "100",
			name: "Test recipe",
			deleted: true,
		});
	});

	it.each([
		["empty ingredients", { name: "Test", ingredients: [], servings: 2 }],
		[
			"invalid servings",
			{
				name: "Test",
				ingredients: [{ productId: "10", measureId: "2", measureQuantity: 1 }],
				servings: 0,
			},
		],
		[
			"invalid tag",
			{
				name: "Test",
				ingredients: [{ productId: "10", measureId: "2", measureQuantity: 1 }],
				servings: 2,
				tags: [{ name: "", category: "RECIPE_TAG_USERS_TYPE", translation: "tag" }],
			},
		],
		[
			"catalog-only meal key",
			{
				name: "Test",
				ingredients: [{ productId: "10", measureId: "2", measureQuantity: 1 }],
				servings: 2,
				mealSchema: ["dinner"],
			},
		],
		[
			"unknown field",
			{
				name: "Test",
				ingredients: [{ productId: "10", measureId: "2", measureQuantity: 1 }],
				servings: 2,
				unexpected: true,
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
		["catalog-only meal key", { mealSchema: ["dinner"] }],
		["unknown field", { name: "Changed", unexpected: true }],
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
			error: {
				source: "internal",
				name: "Error",
				message: "Unable to get Fitatu recipe.",
			},
		});
	});

	it("redacts user ids and upstream messages from known recipe errors", async () => {
		const service = new RecordingRecipeService(
			await FitatuClientError.http({
				operation: FITATU_CLIENT_OPERATIONS.recipesGet,
				message: "Fitatu recipe details request failed",
				method: "GET",
				endpointTemplate: "/recipes-and-user-action/:recipeId/:userId",
				response: new Response(
					JSON.stringify({ message: "Account daniel@example.com failed", email: "daniel@example.com" }),
					{ status: 400, statusText: "Bad Request" },
				),
			}),
		);
		const registered = await registerToolForTest(new GetRecipeTool(service));

		const result = await registered.invoke({ recipeId: "100" });
		const text = getTextContent(result);

		expect(text).not.toContain("sensitive-user-id");
		expect(text).not.toContain("daniel@example.com");
		expect(parseTextContent(result)).toMatchObject({
			error: {
				source: "fitatuApi",
				operation: "recipes.get",
				failure: {
					endpointTemplate: "/recipes-and-user-action/:recipeId/:userId",
				},
			},
		});
	});

	it("maps missing recipe messages consistently without adding wrapper fields", async () => {
		const missing = await recipeApiError(404, "Not Found");
		const cases = [
			{
				tool: new GetRecipeTool(new RecordingRecipeService(missing)),
				input: { recipeId: "999" },
			},
			{
				tool: new UpdateRecipeTool(new RecordingRecipeService(missing)),
				input: { recipeId: "999", name: "Missing" },
			},
			{
				tool: new DeleteRecipeTool(new RecordingRecipeService(missing)),
				input: { recipeId: "999", expectedName: "Missing" },
			},
		];

		for (const testCase of cases) {
			const registered = await registerToolForTest(testCase.tool);
			const result = await registered.invoke(testCase.input);
			const payload = parseTextContent(result) as Record<string, unknown>;

			expect(result.isError).toBe(true);
			expect(payload).toMatchObject({
				error: {
					source: "fitatuApi",
					message: "Fitatu recipe request failed",
					failure: { kind: "http", statusCode: 404 },
				},
			});
			expect(payload).not.toHaveProperty("code");
			expect(payload).not.toHaveProperty("field");
			expect(payload).not.toHaveProperty("retryable");
			expect(payload).not.toHaveProperty("parameter");
		}
	});

	it("maps a recipe search timeout to an actionable message without changing the wrapper", async () => {
		const service = new RecordingRecipeService(await recipeApiError(504, "Gateway Timeout"));
		const registered = await registerToolForTest(new SearchRecipesTool(service));

		const result = await registered.invoke({ query: "naleśniki", scope: "public" });
		const payload = parseTextContent(result) as Record<string, unknown>;

		expect(result.isError).toBe(true);
		expect(payload).toMatchObject({
			error: {
				source: "fitatuApi",
				message: "Fitatu recipe request failed",
				failure: { kind: "http", statusCode: 504 },
			},
		});
		expect(payload).not.toHaveProperty("code");
		expect(payload).not.toHaveProperty("field");
		expect(payload).not.toHaveProperty("retryable");
		expect(payload).not.toHaveProperty("parameter");
	});
});

class RecordingRecipeService implements RecipeProvider {
	public readonly createInputs: RecipeWriteInput[] = [];
	public readonly getIds: (string | number)[] = [];
	public readonly searchInputs: RecipeSearchOptions[] = [];
	public readonly updateInputs: { recipeId: string | number; input: RecipeUpdateInput }[] = [];
	public readonly deleteInputs: { recipeId: string | number; expectedName: string }[] = [];
	public readonly writeWarnings: RecipeWarning[] = [];
	public readonly searchWarnings: RecipeSearchResult["warnings"][number][] = [];
	public detailsValue: RecipeServiceDetails = details();

	public constructor(private readonly error?: Error) {}

	public async createRecipe(input: RecipeWriteInput): Promise<RecipeServiceCreateResult> {
		this.throwWhenConfigured();
		this.createInputs.push(input);
		return new RecipeServiceCreateResult(new RecipeCreateResult("100"), details(), [...this.writeWarnings]);
	}

	public async getRecipe(recipeId: string | number): Promise<RecipeServiceDetails> {
		this.throwWhenConfigured();
		this.getIds.push(recipeId);
		return this.detailsValue;
	}

	public async searchRecipes(options: RecipeSearchOptions = {}): Promise<RecipeSearchResult> {
		this.throwWhenConfigured();
		this.searchInputs.push(options);
		const summary = new RecipeSearchItem("100", "Test recipe", "mine", 100);
		const item = options.includeDetails ? new DetailedRecipeSearchItem(summary, this.detailsValue) : summary;
		return new RecipeSearchResult(
			options.query ?? "",
			options.scope ?? "mine",
			options.page ?? 1,
			options.limit ?? 20,
			[item],
			[...this.searchWarnings],
		);
	}

	public async updateRecipe(
		recipeId: string | number,
		input: RecipeUpdateInput,
	): Promise<RecipeServiceReplaceResult> {
		this.throwWhenConfigured();
		this.updateInputs.push({ recipeId, input });
		return new RecipeServiceReplaceResult(
			new RecipeReplaceResult(new RecipeCreateResult("200"), String(recipeId), true),
			details({ recipeId: "200", name: "Changed", servings: 3 }),
			[...this.writeWarnings],
		);
	}

	public async deleteRecipe(recipeId: string | number, expectedName: string): Promise<RecipeServiceDeleteResult> {
		this.throwWhenConfigured();
		this.deleteInputs.push({ recipeId, expectedName });
		return new RecipeServiceDeleteResult(new RecipeDeleteResult(String(recipeId)), expectedName);
	}

	private throwWhenConfigured(): void {
		if (this.error) {
			throw this.error;
		}
	}
}

function details(overrides: Partial<RecipeDetails> = {}, includeNutrition = true): RecipeServiceDetails {
	const recipe = RecipeDetails.fromApiResponse({
		id: overrides.recipeId ?? "100",
		userId: overrides.userId ?? "test-user",
		name: overrides.name ?? "Test recipe",
		serving: overrides.servings ?? 2,
		shared: overrides.shared ?? false,
		editable: overrides.editable ?? true,
		deleted: overrides.deleted ?? false,
		recipeDescription: overrides.description ?? null,
		cookingTime: overrides.cookingTimeMinutes ?? null,
		preparationTime: overrides.preparationTimeMinutes ?? null,
		mealSchema: overrides.mealSchema ?? [],
		tags: [],
		items: [],
		...(includeNutrition ? { energy: 100, protein: 10, fat: 5, carbohydrate: 12 } : {}),
		weight: overrides.weightPerServingG ?? null,
		categories: overrides.categories ?? null,
	});
	return new RecipeServiceDetails(recipe, [
		{ measureId: "1", measureName: "g", weightG: 1, unit: null, energyKcal: 0.5 },
		{ measureId: "39", measureName: "portion", weightG: 200, unit: null, energyKcal: 100 },
	]);
}

function recipeApiError(statusCode: number, statusText: string): Promise<FitatuClientError> {
	return FitatuClientError.http({
		operation: FITATU_CLIENT_OPERATIONS.recipesGet,
		message: "Fitatu recipe request failed",
		method: "GET",
		endpointTemplate: "/recipes-and-user-action/:recipeId/:userId",
		response: new Response(null, { status: statusCode, statusText }),
	});
}
