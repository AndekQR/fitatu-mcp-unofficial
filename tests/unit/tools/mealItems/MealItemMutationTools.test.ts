import { describe, expect, it } from "vitest";
import type { AddMealItemsOptions } from "../../../../src/api/dayPlan/AddMealItemsOptions.ts";
import { DayRevisions } from "../../../../src/api/dayPlan/DayRevisions.ts";
import type { MealItemMutationResult } from "../../../../src/api/dayPlan/MealItemMutationResult.ts";
import type { DayPlanClient } from "../../../../src/api/dayPlan/DayPlanClient.ts";
import type { MoveMealItemOptions } from "../../../../src/api/dayPlan/MoveMealItemOptions.ts";
import type { RemoveMealItemsOptions } from "../../../../src/api/dayPlan/RemoveMealItemsOptions.ts";
import type { UpdateMealItemOptions } from "../../../../src/api/dayPlan/UpdateMealItemOptions.ts";
import type { RecipeDetails } from "../../../../src/api/recipes/RecipeDetails.ts";
import {
	type MealItemMutationConfirmationProvider,
	type MealItemMutationProvider,
	MealItemMutationService,
} from "../../../../src/services/dayPlan/MealItemMutationService.ts";
import { ServiceError } from "../../../../src/services/ServiceError.ts";
import { SERVICE_ERROR_CODES } from "../../../../src/services/ServiceErrorCode.ts";
import { MutationConfirmationContext } from "../../../../src/services/MutationConfirmationContext.ts";
import { MutationConfirmationError } from "../../../../src/services/MutationConfirmationError.ts";
import { AddMealItemsTool } from "../../../../src/tools/addMealItems/AddMealItemsTool.ts";
import { GetDayPlanItemsTool } from "../../../../src/tools/dayPlanItems/GetDayPlanItemsTool.ts";
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
					productId: "food-1",
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
						productId: "food-1",
						foodType: "PRODUCT",
						measureId: "measure-1",
						measureQuantity: 2,
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
			dayRevisions: { "2026-07-14": "revision-2026-07-14" },
			acceptedItems: [
				{
					index: 0,
					itemId: "new-item-1",
					productId: "food-1",
					mealKey: "breakfast",
				},
			],
			provisionalItemIds: ["new-item-1"],
			itemIdChanged: false,
		},
		destructiveHint: false,
	},
	{
		name: "add_meal_items",
		createTool: (service: TestedMealItemMutationProvider) => new AddMealItemsTool(service),
		input: {
			date: "2026-07-14",
			mealKey: "dinner",
			items: [
				{
					productId: "food-1",
					measureId: "measure-1",
					measureQuantity: 1,
					eaten: false,
				},
			],
		},
		expectedCall: {
			operation: "add",
			options: {
				date: "2026-07-14",
				mealKey: "dinner",
				items: [
					{
						productId: "food-1",
						foodType: "PRODUCT",
						measureId: "measure-1",
						measureQuantity: 1,
						eaten: false,
					},
				],
			},
		},
		result: createMutationResult({
			operation: "add",
			message: "Accepted 1 item for dinner",
			targetDate: "2026-07-14",
			mealKey: "dinner",
			itemId: "new-item-2",
			provisionalItemIds: ["new-item-2"],
		}),
		expectedStructuredContent: {
			status: "accepted",
			operation: "add",
			message: "Accepted 1 item for dinner",
			targetDate: "2026-07-14",
			mealKey: "dinner",
			operationCount: 1,
			dayRevisions: { "2026-07-14": "revision-2026-07-14" },
			acceptedItems: [
				{
					index: 0,
					itemId: "new-item-2",
					productId: "food-1",
					mealKey: "dinner",
				},
			],
			provisionalItemIds: ["new-item-2"],
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
			dayRevisions: { "2026-07-14": "revision-2026-07-14" },
			acceptedItems: [
				{
					index: 0,
					itemId: "item-1",
					productId: "food-1",
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
			dayRevisions: { "2026-07-14": "revision-2026-07-14" },
			acceptedItems: [
				{
					index: 0,
					itemId: "item-1",
					productId: "food-1",
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
			dayRevisions: { "2026-07-14": "revision-2026-07-14" },
			acceptedItems: [
				{
					index: 0,
					itemId: "new-item-2",
					productId: "food-1",
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
			items: [{ foodId: "100", measureId: "39" }],
		},
	},
	{
		name: "add_meal_items",
		createTool: (service: TestedMealItemMutationProvider) => new AddMealItemsTool(service),
		input: {
			date: "2026-07-14",
			mealKey: "breakfast",
			items: [{ productId: "100", foodType: "PRODUCT", measureId: "39" }],
		},
	},
	{
		name: "add_meal_items",
		createTool: (service: TestedMealItemMutationProvider) => new AddMealItemsTool(service),
		input: {
			date: "2026-07-14",
			mealKey: "breakfast",
			items: [{ productId: "100", name: "X", energyKcal: 100, measureId: "39" }],
		},
	},
	{
		name: "add_meal_items",
		createTool: (service: TestedMealItemMutationProvider) => new AddMealItemsTool(service),
		input: {
			date: "2026-07-14",
			mealKey: "breakfast",
			items: [
				{
					productId: "100",
					measureId: "39",
					ingredientsServing: 1,
				},
			],
		},
	},
	{
		name: "add_meal_items",
		createTool: (service: TestedMealItemMutationProvider) => new AddMealItemsTool(service),
		input: {
			date: "2026-07-14",
			mealKey: "breakfast",
			items: [{ recipeId: "recipe:159408954", measureId: "39" }],
		},
	},
	{
		name: "add_meal_items",
		createTool: (service: TestedMealItemMutationProvider) => new AddMealItemsTool(service),
		input: {
			date: "2026-07-14",
			mealKey: "breakfast",
			items: [{ measureId: "39" }],
		},
	},
	{
		name: "add_meal_items",
		createTool: (service: TestedMealItemMutationProvider) => new AddMealItemsTool(service),
		input: {
			date: "2026-07-14",
			mealKey: "breakfast",
			items: [
				{
					productId: "100",
					recipeId: "159408954",
					measureId: "39",
				},
			],
		},
	},
	{
		name: "add_meal_items",
		createTool: (service: TestedMealItemMutationProvider) => new AddMealItemsTool(service),
		input: {
			date: "2026-07-14",
			mealKey: "breakfast",
			items: [{ productId: "100", name: "X", energyKcal: 100 }],
		},
	},
	{
		name: "add_meal_items",
		createTool: (service: TestedMealItemMutationProvider) => new AddMealItemsTool(service),
		input: {
			date: "2026-07-14",
			mealKey: "breakfast",
			items: [{ recipeId: "159408954", name: "X", energyKcal: 100 }],
		},
	},
	{
		name: "add_meal_items",
		createTool: (service: TestedMealItemMutationProvider) => new AddMealItemsTool(service),
		input: {
			date: "2026-07-14",
			mealKey: "breakfast",
			items: [{ energyKcal: 100 }],
		},
	},
	{
		name: "add_meal_items",
		createTool: (service: TestedMealItemMutationProvider) => new AddMealItemsTool(service),
		input: {
			date: "2026-07-14",
			mealKey: "breakfast",
			items: [{ name: "X" }],
		},
	},
	{
		name: "add_meal_items",
		createTool: (service: TestedMealItemMutationProvider) => new AddMealItemsTool(service),
		input: {
			date: "2026-07-14",
			mealKey: "   ",
			items: [{ productId: "100", measureId: "39" }],
		},
	},
	{
		name: "update_meal_item",
		createTool: (service: TestedMealItemMutationProvider) => new UpdateMealItemTool(service),
		input: { date: "14-07-2026", mealKey: "breakfast", itemId: "item-1", eaten: true },
	},
	{
		name: "update_meal_item",
		createTool: (service: TestedMealItemMutationProvider) => new UpdateMealItemTool(service),
		input: { date: "2026-07-14", mealKey: "", itemId: "item-1", eaten: true },
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
	{
		name: "move_meal_item",
		createTool: (service: TestedMealItemMutationProvider) => new MoveMealItemTool(service),
		input: {
			fromDate: "2026-07-14",
			fromMealKey: "   ",
			itemId: "item-1",
			toMealKey: "lunch",
		},
	},
	{
		name: "move_meal_item",
		createTool: (service: TestedMealItemMutationProvider) => new MoveMealItemTool(service),
		input: {
			fromDate: "2026-07-14",
			fromMealKey: "breakfast",
			itemId: "item-1",
			toMealKey: "",
		},
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
		input: successCases[2].input,
		fallbackMessage: "Unable to update Fitatu meal item.",
	},
	{
		name: "remove_meal_items",
		createTool: (service: TestedMealItemMutationProvider) => new RemoveMealItemsTool(service),
		input: successCases[3].input,
		fallbackMessage: "Unable to remove Fitatu meal items.",
	},
	{
		name: "move_meal_item",
		createTool: (service: TestedMealItemMutationProvider) => new MoveMealItemTool(service),
		input: successCases[4].input,
		fallbackMessage: "Unable to move Fitatu meal item.",
	},
] as const;

describe("meal item mutation tools", () => {
	it.each([
		{ field: "mealKey", tool: new AddMealItemsTool(new FakeMealItemMutationService(successCases[0].result)) },
		{ field: "mealKey", tool: new UpdateMealItemTool(new FakeMealItemMutationService(successCases[0].result)) },
		{ field: "fromMealKey", tool: new MoveMealItemTool(new FakeMealItemMutationService(successCases[0].result)) },
		{ field: "toMealKey", tool: new MoveMealItemTool(new FakeMealItemMutationService(successCases[0].result)) },
	])("publishes free-form string meal keys for $field", async ({ field, tool }) => {
		const registered = await registerToolForTest(tool);
		const properties = registered.config.inputSchema.properties as Record<
			string,
			{ type?: string; enum?: readonly string[] }
		>;

		expect(properties[field]?.type).toBe("string");
		expect(properties[field]?.enum).toBeUndefined();
	});

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

	it("accepts and returns an unprefixed recipeId", async () => {
		const recipeResult: MealItemMutationResult = {
			...createMutationResult({
				operation: "add",
				message: "Accepted recipe",
				targetDate: "2026-07-14",
				mealKey: "supper",
				itemId: "recipe-item-1",
				provisionalItemIds: ["recipe-item-1"],
			}),
			acceptedItems: [
				{
					index: 0,
					itemId: "recipe-item-1",
					productId: null,
					recipeId: "159408954",
					foodType: "RECIPE",
					mealKey: "supper",
				},
			],
		};
		const service = new FakeMealItemMutationService(recipeResult);
		const registered = await registerToolForTest(new AddMealItemsTool(service));

		const result = await registered.invoke({
			date: "2026-07-14",
			mealKey: "supper",
			items: [
				{
					recipeId: "159408954",
					measureId: "39",
					measureQuantity: 1.5,
					eaten: true,
				},
			],
		});

		expect(service.calls).toEqual([
			{
				operation: "add",
				options: {
					date: "2026-07-14",
					mealKey: "supper",
					items: [
						{
							foodType: "RECIPE",
							recipeId: "159408954",
							measureId: "39",
							measureQuantity: 1.5,
							eaten: true,
						},
					],
				},
			},
		]);
		expect(result.structuredContent).toMatchObject({
			acceptedItems: [
				{
					itemId: "recipe-item-1",
					recipeId: "159408954",
				},
			],
		});
		expect(JSON.stringify(result.structuredContent)).not.toContain('"foodType"');
	});

	it("creates a custom item from a name and nutrition without a definition id", async () => {
		const customResult: MealItemMutationResult = {
			...createMutationResult({
				operation: "add",
				message: "Accepted custom item",
				targetDate: "2026-07-14",
				mealKey: "supper",
				itemId: "custom-item-1",
				provisionalItemIds: ["custom-item-1"],
			}),
			acceptedItems: [
				{
					index: 0,
					itemId: "custom-item-1",
					productId: null,
					recipeId: null,
					foodType: "CUSTOM_ITEM",
					mealKey: "supper",
				},
			],
		};
		const service = new FakeMealItemMutationService(customResult);
		const registered = await registerToolForTest(new AddMealItemsTool(service));

		const result = await registered.invoke({
			date: "2026-07-14",
			mealKey: "supper",
			items: [
				{
					name: "Kanapka na oko",
					energyKcal: 450,
					eaten: true,
				},
			],
		});

		expect(service.calls).toEqual([
			{
				operation: "add",
				options: {
					date: "2026-07-14",
					mealKey: "supper",
					items: [
						{
							foodType: "CUSTOM_ITEM",
							name: "Kanapka na oko",
							energyKcal: 450,
							proteinG: 0,
							fatG: 0,
							carbohydrateG: 0,
							eaten: true,
						},
					],
				},
			},
		]);
		expect(result.structuredContent).toMatchObject({
			acceptedItems: [
				{
					itemId: "custom-item-1",
					mealKey: "supper",
				},
			],
		});
		expect(JSON.stringify(result.structuredContent)).not.toContain('"productId"');
		expect(JSON.stringify(result.structuredContent)).not.toContain('"recipeId"');
		expect(JSON.stringify(result.structuredContent)).not.toContain('"foodType"');
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
				items: [{ recipeId: "100", foodType: "RECIPE", measureId: "39" }],
			}),
		).rejects.toThrow("Deleted recipe at items[0].recipeId cannot be added to a day plan.");
		expect(calls).toEqual([]);
	});

	it("derives the hidden ingredientsServing value from the recipe definition", async () => {
		const calls: AddMealItemsOptions[] = [];
		const service = new MealItemMutationService(
			{
				addMealItems: async (options: AddMealItemsOptions) => {
					calls.push(options);
					return successCases[0].result;
				},
			} as unknown as DayPlanClient,
			{ getAvailableMeasureIds: async () => new Set(["39"]) },
			{ getRecipe: async () => recipeDetails({ servings: 8 }) },
			alwaysConfirmingMealItemMutations(),
		);

		await service.addMealItems({
			date: "2026-07-14",
			mealKey: "supper",
			items: [{ recipeId: "159408954", foodType: "RECIPE", measureId: "39", measureQuantity: 1.5 }],
		});

		expect(calls).toEqual([
			{
				date: "2026-07-14",
				mealKey: "supper",
				items: [
					{
						recipeId: "159408954",
						foodType: "RECIPE",
						measureId: "39",
						measureQuantity: 1.5,
						ingredientsServing: 8,
					},
				],
			},
		]);
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
				items: [{ productId: "100", foodType: "PRODUCT", measureId: "999" }],
			}),
		).rejects.toThrow("Measure at items[0].measureId does not belong to the selected food.");
		expect(calls).toEqual([]);
	});

	it("does not perform catalog lookups for a custom item", async () => {
		const calls: AddMealItemsOptions[] = [];
		let measureLookupCalled = false;
		let recipeLookupCalled = false;
		const service = new MealItemMutationService(
			{
				addMealItems: async (options: AddMealItemsOptions) => {
					calls.push(options);
					return successCases[0].result;
				},
			} as unknown as DayPlanClient,
			{
				getAvailableMeasureIds: async () => {
					measureLookupCalled = true;
					return new Set();
				},
			},
			{
				getRecipe: async () => {
					recipeLookupCalled = true;
					return recipeDetails();
				},
			},
			alwaysConfirmingMealItemMutations(),
		);
		const item = {
			foodType: "CUSTOM_ITEM" as const,
			name: "Kanapka na oko",
			energyKcal: 450,
			proteinG: 0,
			fatG: 0,
			carbohydrateG: 0,
		};

		await expect(
			service.addMealItems({
				date: "2026-07-14",
				mealKey: "supper",
				items: [item],
			}),
		).resolves.toMatchObject({ status: "accepted", operation: "add" });
		expect(calls).toEqual([{ date: "2026-07-14", mealKey: "supper", items: [item] }]);
		expect(measureLookupCalled).toBe(false);
		expect(recipeLookupCalled).toBe(false);
	});

	it.each(invalidInputCases)("$name rejects invalid input before delegation", async (testCase) => {
		const service = new FakeMealItemMutationService(successCases[0].result);
		const registered = await registerToolForTest(testCase.createTool(service));

		const result = await registered.invoke(testCase.input);

		expect(result.isError).toBe(true);
		expect(service.calls).toHaveLength(0);
	});

	it.each(errorCases)("$name maps service and unexpected errors to the correct envelope", async (testCase) => {
		const isServiceErrorCase = testCase.name === "add_meal_items";
		const error = isServiceErrorCase
			? new ServiceError(
					"Measure at items[0].measureId does not belong to the selected food.",
					"invalidInput",
					SERVICE_ERROR_CODES.invalidMealItemMeasure,
				)
			: new Error(`secret ${testCase.name} response`);
		const service = new FakeMealItemMutationService(successCases[0].result, error);
		const registered = await registerToolForTest(testCase.createTool(service));

		const result = await registered.invoke(testCase.input);

		expect(result.isError).toBe(true);
		expect(parseTextContent(result)).toEqual({
			status: "error",
			toolName: testCase.name,
			error: isServiceErrorCase
				? {
						source: "service",
						name: "ServiceError",
						message: "Measure at items[0].measureId does not belong to the selected food.",
						kind: "invalidInput",
						code: SERVICE_ERROR_CODES.invalidMealItemMeasure,
					}
				: {
						source: "internal",
						name: "Error",
						message: testCase.fallbackMessage,
					},
		});
		expect(result.structuredContent).toBeUndefined();
		if (!isServiceErrorCase) {
			expect(getTextContent(result)).not.toContain(`secret ${testCase.name} response`);
		}
	});

	it.each([
		{
			name: "timeout",
			error: MutationConfirmationError.timeout(
				new MutationConfirmationContext(AddMealItemsTool.toolName, GetDayPlanItemsTool.toolName),
			),
			code: SERVICE_ERROR_CODES.mutationConfirmationTimeout,
			messagePattern: /accepted.*could not be confirmed.*do not retry automatically/i,
		},
		{
			name: "terminal read failure",
			error: MutationConfirmationError.readFailed(
				new MutationConfirmationContext(AddMealItemsTool.toolName, GetDayPlanItemsTool.toolName),
			),
			code: SERVICE_ERROR_CODES.mutationConfirmationReadFailed,
			messagePattern: /accepted.*confirmation read failed.*do not retry automatically/i,
		},
	])("maps an unconfirmed mutation $name to a safe public service error", async (testCase) => {
		const service = new FakeMealItemMutationService(successCases[0].result, testCase.error);
		const registered = await registerToolForTest(new AddMealItemsTool(service));

		const result = await registered.invoke({
			date: "2026-07-14",
			mealKey: "breakfast",
			items: [{ productId: "101", measureId: "2" }],
		});

		expect(result.isError).toBe(true);
		expect(parseTextContent(result)).toEqual({
			status: "error",
			toolName: "add_meal_items",
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
		dayRevisions: DayRevisions.fromRecord({ [options.targetDate]: `revision-${options.targetDate}` }),
	};
}

function alwaysConfirmingMealItemMutations(): MealItemMutationConfirmationProvider {
	return {
		confirmAdded: async () => undefined,
		confirmUpdated: async () => undefined,
		confirmRemoved: async () => undefined,
		getMoveSource: async () => {
			throw new Error("Move source is not used by this test");
		},
		confirmMoved: async () => undefined,
	};
}
