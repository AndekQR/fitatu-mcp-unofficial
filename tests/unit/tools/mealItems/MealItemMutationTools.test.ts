import { describe, expect, it } from "vitest";
import type { AddMealItemsOptions } from "../../../../src/api/dayPlan/AddMealItemsOptions.ts";
import type { MealItemMutationResult } from "../../../../src/api/dayPlan/MealItemMutationResult.ts";
import type { DayPlanClient } from "../../../../src/api/dayPlan/DayPlanClient.ts";
import type { MoveMealItemOptions } from "../../../../src/api/dayPlan/MoveMealItemOptions.ts";
import type { RemoveMealItemsOptions } from "../../../../src/api/dayPlan/RemoveMealItemsOptions.ts";
import type { UpdateMealItemOptions } from "../../../../src/api/dayPlan/UpdateMealItemOptions.ts";
import type { RecipeDetails } from "../../../../src/api/recipes/RecipeDetails.ts";
import {
	MealItemMutationService,
	type MealItemMutationProvider,
} from "../../../../src/services/dayPlan/MealItemMutationService.ts";
import { AddMealItemsTool } from "../../../../src/tools/addMealItems/AddMealItemsTool.ts";
import { MoveMealItemTool } from "../../../../src/tools/mealItems/MoveMealItemTool.ts";
import { RemoveMealItemsTool } from "../../../../src/tools/mealItems/RemoveMealItemsTool.ts";
import { UpdateMealItemTool } from "../../../../src/tools/mealItems/UpdateMealItemTool.ts";
import { getTextContent, parseTextContent, registerToolForTest } from "../../support/mcpToolTestDouble.ts";

type TestedMealItemMutationProvider = Pick<
	MealItemMutationProvider,
	"addMealItems" | "updateMealItem" | "removeMealItems" | "moveMealItem"
>;

const REMOVE_ITEM_ID_1 = "11111111-1111-4111-8111-111111111111";
const REMOVE_ITEM_ID_2 = "22222222-2222-4222-8222-222222222222";

const successCases = [
	{
		name: "add_meal_items",
		createTool: (service: TestedMealItemMutationProvider) => new AddMealItemsTool(service),
		input: {
			date: "2026-07-14",
			mealKey: "breakfast",
			items: [
				{
					foodId: "food-1",
					foodType: "PRODUCT",
					measureId: "measure-1",
					measureQuantity: 2,
					eaten: false,
				},
			],
		},
		expectedCall: {
			operation: "add",
			options: {
				date: "2026-07-14",
				mealKey: "breakfast",
				items: [
					{
						foodId: "food-1",
						foodType: "PRODUCT",
						measureId: "measure-1",
						measureQuantity: 2,
						ingredientsServing: undefined,
						eaten: false,
					},
				],
			},
		},
		result: createMutationResult({
			operation: "add",
			message: "Accepted 1 item for breakfast",
			targetDate: "2026-07-14",
			mealKey: "breakfast",
			itemId: "new-item-1",
			provisionalItemIds: ["new-item-1"],
		}),
		expectedStructuredContent: {
			status: "accepted",
			operation: "add",
			message: "Accepted 1 item for breakfast",
			targetDate: "2026-07-14",
			mealKey: "breakfast",
			operationCount: 1,
			acceptedItems: [
				{
					index: 0,
					itemId: "new-item-1",
					productId: "food-1",
					foodType: "PRODUCT",
					mealKey: "breakfast",
				},
			],
			provisionalItemIds: ["new-item-1"],
			itemIdChanged: false,
		},
		destructiveHint: false,
	},
	{
		name: "update_meal_item",
		createTool: (service: TestedMealItemMutationProvider) => new UpdateMealItemTool(service),
		input: {
			date: "2026-07-14",
			mealKey: "breakfast",
			itemId: "item-1",
			measureQuantity: 1.5,
			eaten: true,
		},
		expectedCall: {
			operation: "update",
			options: {
				date: "2026-07-14",
				mealKey: "breakfast",
				itemId: "item-1",
				measureQuantity: 1.5,
				measureId: undefined,
				eaten: true,
			},
		},
		result: createMutationResult({
			operation: "update",
			message: "Accepted update for item-1",
			targetDate: "2026-07-14",
			mealKey: "breakfast",
			itemId: "item-1",
			updatedItemIds: ["item-1"],
		}),
		expectedStructuredContent: {
			status: "accepted",
			operation: "update",
			message: "Accepted update for item-1",
			targetDate: "2026-07-14",
			mealKey: "breakfast",
			operationCount: 1,
			acceptedItems: [
				{
					index: 0,
					itemId: "item-1",
					productId: "food-1",
					foodType: "PRODUCT",
					mealKey: "breakfast",
				},
			],
			updatedItemIds: ["item-1"],
			itemIdChanged: false,
		},
		destructiveHint: false,
	},
	{
		name: "remove_meal_items",
		createTool: (service: TestedMealItemMutationProvider) => new RemoveMealItemsTool(service),
		input: { date: "2026-07-14", itemIds: [REMOVE_ITEM_ID_1, REMOVE_ITEM_ID_2] },
		expectedCall: {
			operation: "remove",
			options: { date: "2026-07-14", itemIds: [REMOVE_ITEM_ID_1, REMOVE_ITEM_ID_2] },
		},
		result: createMutationResult({
			operation: "remove",
			message: "Accepted removal of item-1",
			targetDate: "2026-07-14",
			mealKey: "breakfast",
			itemId: "item-1",
			deletedItemIds: ["item-1"],
		}),
		expectedStructuredContent: {
			status: "accepted",
			operation: "remove",
			message: "Accepted removal of item-1",
			targetDate: "2026-07-14",
			mealKey: "breakfast",
			operationCount: 1,
			acceptedItems: [
				{
					index: 0,
					itemId: "item-1",
					productId: "food-1",
					foodType: "PRODUCT",
					mealKey: "breakfast",
				},
			],
			deletedItemIds: ["item-1"],
			itemIdChanged: false,
		},
		destructiveHint: true,
	},
	{
		name: "move_meal_item",
		createTool: (service: TestedMealItemMutationProvider) => new MoveMealItemTool(service),
		input: {
			fromDate: "2026-07-14",
			fromMealKey: "breakfast",
			itemId: "item-1",
			toDate: "2026-07-15",
			toMealKey: "lunch",
		},
		expectedCall: {
			operation: "move",
			options: {
				fromDate: "2026-07-14",
				fromMealKey: "breakfast",
				itemId: "item-1",
				toDate: "2026-07-15",
				toMealKey: "lunch",
			},
		},
		result: createMutationResult({
			operation: "move",
			message: "Accepted move to lunch",
			targetDate: "2026-07-14",
			mealKey: "breakfast",
			itemId: "new-item-2",
			oldItemId: "item-1",
			newItemId: "new-item-2",
		}),
		expectedStructuredContent: {
			status: "accepted",
			operation: "move",
			message: "Accepted move to lunch",
			targetDate: "2026-07-14",
			mealKey: "breakfast",
			operationCount: 1,
			acceptedItems: [
				{
					index: 0,
					itemId: "new-item-2",
					productId: "food-1",
					foodType: "PRODUCT",
					mealKey: "breakfast",
				},
			],
			oldItemId: "item-1",
			newItemId: "new-item-2",
			itemIdChanged: true,
		},
		destructiveHint: false,
	},
] as const;

const invalidInputCases = [
	{
		name: "add_meal_items",
		createTool: (service: TestedMealItemMutationProvider) => new AddMealItemsTool(service),
		input: { date: "2026-07-14", mealKey: "breakfast", items: [] },
	},
	{
		name: "add_meal_items",
		createTool: (service: TestedMealItemMutationProvider) => new AddMealItemsTool(service),
		input: {
			date: "2026-07-14",
			mealKey: "breakfast",
			items: [{ foodId: "100", foodType: "RECIPE", measureId: "39" }],
		},
	},
	{
		name: "update_meal_item",
		createTool: (service: TestedMealItemMutationProvider) => new UpdateMealItemTool(service),
		input: { date: "14-07-2026", mealKey: "breakfast", itemId: "item-1", eaten: true },
	},
	{
		name: "remove_meal_items",
		createTool: (service: TestedMealItemMutationProvider) => new RemoveMealItemsTool(service),
		input: { date: "2026-07-14", itemIds: [] },
	},
	{
		name: "move_meal_item",
		createTool: (service: TestedMealItemMutationProvider) => new MoveMealItemTool(service),
		input: { fromDate: "14-07-2026", fromMealKey: "breakfast", itemId: "item-1", toMealKey: "lunch" },
	},
] as const;

const errorCases = [
	{
		name: "add_meal_items",
		createTool: (service: TestedMealItemMutationProvider) => new AddMealItemsTool(service),
		input: successCases[0].input,
		fallbackMessage: "Unable to add Fitatu meal items.",
	},
	{
		name: "update_meal_item",
		createTool: (service: TestedMealItemMutationProvider) => new UpdateMealItemTool(service),
		input: successCases[1].input,
		fallbackMessage: "Unable to update Fitatu meal item.",
	},
	{
		name: "remove_meal_items",
		createTool: (service: TestedMealItemMutationProvider) => new RemoveMealItemsTool(service),
		input: successCases[2].input,
		fallbackMessage: "Unable to remove Fitatu meal items.",
	},
	{
		name: "move_meal_item",
		createTool: (service: TestedMealItemMutationProvider) => new MoveMealItemTool(service),
		input: successCases[3].input,
		fallbackMessage: "Unable to move Fitatu meal item.",
	},
] as const;

describe("meal item mutation tools", () => {
	it.each(successCases)("$name delegates validated input and returns accepted content", async (testCase) => {
		const service = new FakeMealItemMutationService(testCase.result);
		const registered = await registerToolForTest(testCase.createTool(service));

		const result = await registered.invoke(testCase.input);

		expect(service.calls).toEqual([testCase.expectedCall]);
		expect(registered.config.annotations).toMatchObject({
			readOnlyHint: false,
			destructiveHint: testCase.destructiveHint,
			idempotentHint: false,
		});
		expect(result.structuredContent).toEqual(testCase.expectedStructuredContent);
		expect(result.content).toEqual([
			{ type: "text", text: JSON.stringify(testCase.expectedStructuredContent, null, 2) },
		]);
	});

	it("rejects a deleted recipe before delegating the day-plan write", async () => {
		const calls: AddMealItemsOptions[] = [];
		const service = new MealItemMutationService(
			{
				addMealItems: async (options: AddMealItemsOptions) => {
					calls.push(options);
					return successCases[0].result;
				},
			} as unknown as DayPlanClient,
			{ getAvailableMeasureIds: async () => new Set(["39"]) },
			{ getRecipe: async () => recipeDetails({ deleted: true }) },
		);

		await expect(
			service.addMealItems({
				date: "2026-07-14",
				mealKey: "lunch",
				items: [{ foodId: "100", foodType: "RECIPE", measureId: "39" }],
			}),
		).rejects.toThrow("Deleted recipe at items[0].foodId cannot be added to a day plan.");
		expect(calls).toEqual([]);
	});

	it("rejects a mismatched food measure before delegating the day-plan write", async () => {
		const calls: AddMealItemsOptions[] = [];
		const service = new MealItemMutationService(
			{
				addMealItems: async (options: AddMealItemsOptions) => {
					calls.push(options);
					return successCases[0].result;
				},
			} as unknown as DayPlanClient,
			{ getAvailableMeasureIds: async () => new Set(["1"]) },
			{ getRecipe: async () => recipeDetails() },
		);

		await expect(
			service.addMealItems({
				date: "2026-07-14",
				mealKey: "lunch",
				items: [{ foodId: "100", foodType: "PRODUCT", measureId: "999" }],
			}),
		).rejects.toThrow("Measure at items[0].measureId does not belong to the selected food.");
		expect(calls).toEqual([]);
	});

	it.each(invalidInputCases)("$name rejects invalid input before delegation", async (testCase) => {
		const service = new FakeMealItemMutationService(successCases[0].result);
		const registered = await registerToolForTest(testCase.createTool(service));

		const result = await registered.invoke(testCase.input);

		expect(result.isError).toBe(true);
		expect(service.calls).toHaveLength(0);
	});

	it.each(errorCases)("$name redacts unexpected service errors", async (testCase) => {
		const service = new FakeMealItemMutationService(
			successCases[0].result,
			new Error(`secret ${testCase.name} response`),
		);
		const registered = await registerToolForTest(testCase.createTool(service));

		const result = await registered.invoke(testCase.input);

		expect(result.isError).toBe(true);
		expect(parseTextContent(result)).toEqual({
			status: "error",
			toolName: testCase.name,
			errorName: "Error",
			message: testCase.fallbackMessage,
		});
		expect(result.structuredContent).toBeUndefined();
		expect(getTextContent(result)).not.toContain(`secret ${testCase.name} response`);
	});
});

type MutationCall =
	| { readonly operation: "add"; readonly options: AddMealItemsOptions }
	| { readonly operation: "update"; readonly options: UpdateMealItemOptions }
	| { readonly operation: "remove"; readonly options: RemoveMealItemsOptions }
	| { readonly operation: "move"; readonly options: MoveMealItemOptions };

class FakeMealItemMutationService {
	public readonly calls: MutationCall[] = [];

	public constructor(
		private readonly result: MealItemMutationResult,
		private readonly error?: Error,
	) {}

	public async addMealItems(options: AddMealItemsOptions): Promise<MealItemMutationResult> {
		return this.record({ operation: "add", options });
	}

	public async updateMealItem(options: UpdateMealItemOptions): Promise<MealItemMutationResult> {
		return this.record({ operation: "update", options });
	}

	public async removeMealItems(options: RemoveMealItemsOptions): Promise<MealItemMutationResult> {
		return this.record({ operation: "remove", options });
	}

	public async moveMealItem(options: MoveMealItemOptions): Promise<MealItemMutationResult> {
		return this.record({ operation: "move", options });
	}

	private async record(call: MutationCall): Promise<MealItemMutationResult> {
		this.calls.push(call);
		if (this.error) {
			throw this.error;
		}

		return this.result;
	}
}

function recipeDetails(overrides: Partial<RecipeDetails> = {}): RecipeDetails {
	return {
		recipeId: "100",
		userId: "test-user",
		name: "Test recipe",
		servings: 1,
		shared: false,
		editable: true,
		deleted: false,
		description: null,
		cookingTimeMinutes: null,
		preparationTimeMinutes: null,
		mealSchema: [],
		tags: [],
		ingredients: [],
		nutritionPerServing: {
			energyKcal: null,
			proteinG: null,
			fatG: null,
			carbohydrateG: null,
		},
		weightPerServingG: null,
		categories: null,
		...overrides,
	};
}

function createMutationResult(options: {
	readonly operation: MealItemMutationResult["operation"];
	readonly message: string;
	readonly targetDate: string;
	readonly mealKey: string;
	readonly itemId: string;
	readonly provisionalItemIds?: readonly string[];
	readonly updatedItemIds?: readonly string[];
	readonly deletedItemIds?: readonly string[];
	readonly oldItemId?: string;
	readonly newItemId?: string;
}): MealItemMutationResult {
	return {
		status: "accepted",
		operation: options.operation,
		message: options.message,
		targetDate: options.targetDate,
		mealKey: options.mealKey,
		operationCount: 1,
		acceptedItems: [
			{
				index: 0,
				itemId: options.itemId,
				productId: "food-1",
				recipeId: null,
				foodType: "PRODUCT",
				mealKey: options.mealKey,
			},
		],
		provisionalItemIds: options.provisionalItemIds ?? [],
		updatedItemIds: options.updatedItemIds ?? [],
		deletedItemIds: options.deletedItemIds ?? [],
		oldItemId: options.oldItemId ?? null,
		newItemId: options.newItemId ?? null,
		itemIdChanged: Boolean(options.oldItemId && options.newItemId && options.oldItemId !== options.newItemId),
	};
}
