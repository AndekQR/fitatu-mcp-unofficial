import { describe, expect, it } from "vitest";
import type { AddMealItemsOptions } from "../../../../src/api/dayPlan/AddMealItemsOptions.ts";
import { AddMealItemsResult } from "../../../../src/api/dayPlan/AddMealItemsResult.ts";
import { DayRevisions } from "../../../../src/api/dayPlan/DayRevisions.ts";
import { MealItemOperationSummary } from "../../../../src/api/dayPlan/MealItemOperationSummary.ts";
import { MoveMealItemResult } from "../../../../src/api/dayPlan/MoveMealItemResult.ts";
import type { DayPlanClient } from "../../../../src/api/dayPlan/DayPlanClient.ts";
import { DayPlan } from "../../../../src/api/dayPlan/DayPlan.ts";
import { MoveMealItemOptions } from "../../../../src/api/dayPlan/MoveMealItemOptions.ts";
import { ProductMealItemInput } from "../../../../src/api/dayPlan/ProductMealItemInput.ts";
import { RecipeMealItemInput } from "../../../../src/api/dayPlan/RecipeMealItemInput.ts";
import type { RemoveMealItemsOptions } from "../../../../src/api/dayPlan/RemoveMealItemsOptions.ts";
import { RemoveMealItemsResult } from "../../../../src/api/dayPlan/RemoveMealItemsResult.ts";
import { ReplaceMealItemOptions } from "../../../../src/api/dayPlan/ReplaceMealItemOptions.ts";
import { ReplaceMealItemResult } from "../../../../src/api/dayPlan/ReplaceMealItemResult.ts";
import type { UpdateMealItemOptions } from "../../../../src/api/dayPlan/UpdateMealItemOptions.ts";
import { UpdateMealItemResult } from "../../../../src/api/dayPlan/UpdateMealItemResult.ts";
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
import { ReplaceMealItemTool } from "../../../../src/tools/mealItems/ReplaceMealItemTool.ts";
import { UpdateMealItemTool } from "../../../../src/tools/mealItems/UpdateMealItemTool.ts";
import { getTextContent, parseTextContent, registerToolForTest } from "../../support/mcpToolTestDouble.ts";

type TestedMealItemMutationProvider = Pick<
	MealItemMutationProvider,
	"addMealItems" | "updateMealItem" | "removeMealItems" | "moveMealItem" | "replaceMealItem"
>;

const REMOVE_ITEM_ID_1 = "item-1";
const REMOVE_ITEM_ID_2 = "item-2";

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
			targetDate: "2026-07-14",
			mealKey: "breakfast",
			itemId: "new-item-1",
		}),
		expectedStructuredContent: {
			status: "confirmed",
			date: "2026-07-14",
			mealKey: "breakfast",
			addedItems: [
				{
					inputIndex: 0,
					itemId: "new-item-1",
				},
			],
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
			targetDate: "2026-07-14",
			mealKey: "dinner",
			itemId: "new-item-2",
		}),
		expectedStructuredContent: {
			status: "confirmed",
			date: "2026-07-14",
			mealKey: "dinner",
			addedItems: [
				{
					inputIndex: 0,
					itemId: "new-item-2",
				},
			],
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
				name: undefined,
				energyKcal: undefined,
				proteinG: undefined,
				fatG: undefined,
				carbohydrateG: undefined,
			},
		},
		result: createMutationResult({
			operation: "update",
			targetDate: "2026-07-14",
			mealKey: "breakfast",
			itemId: "item-1",
		}),
		expectedStructuredContent: {
			status: "confirmed",
			date: "2026-07-14",
			mealKey: "breakfast",
			itemId: "item-1",
		},
		destructiveHint: false,
	},
	{
		name: "remove_meal_items",
		createTool: (service: TestedMealItemMutationProvider) => new RemoveMealItemsTool(service),
		input: {
			date: "2026-07-14",
			items: [
				{ mealKey: "breakfast", itemId: REMOVE_ITEM_ID_1 },
				{ mealKey: "lunch", itemId: REMOVE_ITEM_ID_2 },
			],
		},
		expectedCall: {
			operation: "remove",
			options: {
				date: "2026-07-14",
				items: [
					{ mealKey: "breakfast", itemId: REMOVE_ITEM_ID_1 },
					{ mealKey: "lunch", itemId: REMOVE_ITEM_ID_2 },
				],
			},
		},
		result: createMutationResult({
			operation: "remove",
			targetDate: "2026-07-14",
			mealKey: "breakfast",
			itemId: "item-1",
		}),
		expectedStructuredContent: {
			status: "confirmed",
			date: "2026-07-14",
			removedItems: [
				{
					inputIndex: 0,
					itemId: "item-1",
					mealKey: "breakfast",
				},
			],
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
			targetDate: "2026-07-14",
			mealKey: "breakfast",
			itemId: "new-item-2",
			oldItemId: "item-1",
			toDate: "2026-07-15",
			toMealKey: "lunch",
		}),
		expectedStructuredContent: {
			status: "confirmed",
			fromDate: "2026-07-14",
			fromMealKey: "breakfast",
			previousItemId: "item-1",
			toDate: "2026-07-15",
			toMealKey: "lunch",
			itemId: "new-item-2",
		},
		destructiveHint: false,
	},
	{
		name: "replace_meal_item",
		createTool: (service: TestedMealItemMutationProvider) => new ReplaceMealItemTool(service),
		input: {
			date: "2026-07-14",
			mealKey: "breakfast",
			itemId: "old-item-1",
			replacement: {
				productId: "food-2",
				measureId: "measure-2",
				measureQuantity: 0.5,
			},
		},
		expectedCall: {
			operation: "replace",
			options: {
				date: "2026-07-14",
				mealKey: "breakfast",
				itemId: "old-item-1",
				replacement: {
					foodType: "PRODUCT",
					productId: "food-2",
					measureId: "measure-2",
					measureQuantity: 0.5,
					eaten: undefined,
				},
			},
		},
		result: createMutationResult({
			operation: "replace",
			targetDate: "2026-07-14",
			mealKey: "breakfast",
			itemId: "new-item-3",
			oldItemId: "old-item-1",
		}),
		expectedStructuredContent: {
			status: "confirmed",
			date: "2026-07-14",
			mealKey: "breakfast",
			previousItemId: "old-item-1",
			itemId: "new-item-3",
		},
		destructiveHint: true,
	},
] as const;

const invalidInputCases = [
	{
		name: "replace_meal_item",
		createTool: (service: TestedMealItemMutationProvider) => new ReplaceMealItemTool(service),
		input: {
			date: "2026-07-14",
			mealKey: "breakfast",
			itemId: "old-item-1",
			replacement: { productId: "food-2" },
		},
	},
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
		name: "update_meal_item",
		createTool: (service: TestedMealItemMutationProvider) => new UpdateMealItemTool(service),
		input: { date: "2026-07-14", mealKey: "breakfast", itemId: "item-1" },
	},
	{
		name: "update_meal_item",
		createTool: (service: TestedMealItemMutationProvider) => new UpdateMealItemTool(service),
		input: { date: "2026-07-14", mealKey: "breakfast", itemId: "item-1", name: "   " },
	},
	{
		name: "update_meal_item",
		createTool: (service: TestedMealItemMutationProvider) => new UpdateMealItemTool(service),
		input: { date: "2026-07-14", mealKey: "breakfast", itemId: "item-1", energyKcal: -1 },
	},
	{
		name: "remove_meal_items",
		createTool: (service: TestedMealItemMutationProvider) => new RemoveMealItemsTool(service),
		input: { date: "2026-07-14", items: [] },
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
	{
		name: "replace_meal_item",
		createTool: (service: TestedMealItemMutationProvider) => new ReplaceMealItemTool(service),
		input: successCases[5].input,
		fallbackMessage: "Unable to replace Fitatu meal item.",
	},
] as const;

describe("meal item mutation tools", () => {
	it("documents that replacement order is not part of the contract", async () => {
		const registered = await registerToolForTest(
			new ReplaceMealItemTool(new FakeMealItemMutationService(successCases[5].result)),
		);

		expect(registered.config.description).toContain("same meal");
		expect(registered.config.description).toContain("item order is not part of the contract");
	});

	it.each([
		{ field: "mealKey", tool: new AddMealItemsTool(new FakeMealItemMutationService(successCases[0].result)) },
		{ field: "mealKey", tool: new UpdateMealItemTool(new FakeMealItemMutationService(successCases[0].result)) },
		{ field: "mealKey", tool: new ReplaceMealItemTool(new FakeMealItemMutationService(successCases[0].result)) },
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

	it.each(successCases)("$name delegates validated input and returns confirmed content", async (testCase) => {
		const service = new FakeMealItemMutationService(testCase.result);
		const registered = await registerToolForTest(testCase.createTool(service));

		const result = await registered.invoke(testCase.input);

		expect(service.calls).toEqual([testCase.expectedCall]);
		expect(registered.config.annotations).toMatchObject({
			readOnlyHint: false,
			destructiveHint: testCase.destructiveHint,
			idempotentHint: false,
		});
		const outputSchema = registered.config.outputSchema;
		expect(outputSchema).toMatchObject({ properties: { status: { const: "confirmed" } } });
		if (!outputSchema) {
			throw new Error("Expected a mutation output schema");
		}
		const outputProperties = outputSchema.properties as Record<string, unknown>;
		for (const technicalField of [
			"dayRevisions",
			"provisionalItemIds",
			"itemIdChanged",
			"operationCount",
			"message",
		]) {
			expect(outputProperties).not.toHaveProperty(technicalField);
		}
		expect(result.structuredContent).toEqual(testCase.expectedStructuredContent);
		expect(result.content).toEqual([
			{ type: "text", text: JSON.stringify(testCase.expectedStructuredContent, null, 2) },
		]);
	});

	it("accepts and returns any non-empty raw recipeId supported by the client", async () => {
		const rawRecipeId = "recipe:159408954";
		const recipeResult = new AddMealItemsResult(
			"2026-07-14",
			"supper",
			[new MealItemOperationSummary(0, "recipe-item-1", null, rawRecipeId, "RECIPE", "supper")],
			DayRevisions.fromRecord({ "2026-07-14": "revision-2026-07-14" }),
		);
		const service = new FakeMealItemMutationService(recipeResult);
		const registered = await registerToolForTest(new AddMealItemsTool(service));

		const result = await registered.invoke({
			date: "2026-07-14",
			mealKey: "supper",
			items: [
				{
					recipeId: `  ${rawRecipeId}  `,
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
							recipeId: rawRecipeId,
							measureId: "39",
							measureQuantity: 1.5,
							eaten: true,
						},
					],
				},
			},
		]);
		expect(result.structuredContent).toMatchObject({
			addedItems: [
				{
					itemId: "recipe-item-1",
				},
			],
		});
		expect(JSON.stringify(result.structuredContent)).not.toContain('"recipeId"');
		expect(JSON.stringify(result.structuredContent)).not.toContain('"foodType"');
	});

	it("creates a custom item from a name and nutrition without a definition id", async () => {
		const customResult = new AddMealItemsResult(
			"2026-07-14",
			"supper",
			[new MealItemOperationSummary(0, "custom-item-1", null, null, "CUSTOM_ITEM", "supper")],
			DayRevisions.fromRecord({ "2026-07-14": "revision-2026-07-14" }),
		);
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
			addedItems: [
				{
					itemId: "custom-item-1",
				},
			],
		});
		expect(JSON.stringify(result.structuredContent)).not.toContain('"productId"');
		expect(JSON.stringify(result.structuredContent)).not.toContain('"recipeId"');
		expect(JSON.stringify(result.structuredContent)).not.toContain('"foodType"');
	});

	it.each([
		{
			name: "recipe",
			replacement: { recipeId: "159408954", measureId: "39", measureQuantity: 1.5, eaten: false },
			expected: {
				foodType: "RECIPE",
				recipeId: "159408954",
				measureId: "39",
				measureQuantity: 1.5,
				eaten: false,
			},
		},
		{
			name: "custom item",
			replacement: { name: "Replacement custom", energyKcal: 250 },
			expected: {
				foodType: "CUSTOM_ITEM",
				name: "Replacement custom",
				energyKcal: 250,
				proteinG: 0,
				fatG: 0,
				carbohydrateG: 0,
				eaten: undefined,
			},
		},
	])("accepts an add-compatible $name replacement payload", async ({ replacement, expected }) => {
		const service = new FakeMealItemMutationService(successCases[5].result);
		const registered = await registerToolForTest(new ReplaceMealItemTool(service));

		await registered.invoke({
			date: "2026-07-14",
			mealKey: "supper",
			itemId: "old-item",
			replacement,
		});

		expect(service.calls).toEqual([
			{
				operation: "replace",
				options: {
					date: "2026-07-14",
					mealKey: "supper",
					itemId: "old-item",
					replacement: expected,
				},
			},
		]);
	});

	it("delegates trimmed custom-item name and zero nutrition updates", async () => {
		const service = new FakeMealItemMutationService(successCases[2].result);
		const registered = await registerToolForTest(new UpdateMealItemTool(service));

		await registered.invoke({
			date: "2026-07-14",
			mealKey: "supper",
			itemId: "custom-item-1",
			name: "  Corrected snack  ",
			energyKcal: 0,
			proteinG: 0,
			fatG: 0,
			carbohydrateG: 0,
		});

		expect(service.calls).toEqual([
			{
				operation: "update",
				options: {
					date: "2026-07-14",
					mealKey: "supper",
					itemId: "custom-item-1",
					measureQuantity: undefined,
					measureId: undefined,
					eaten: undefined,
					userId: undefined,
					name: "Corrected snack",
					energyKcal: 0,
					proteinG: 0,
					fatG: 0,
					carbohydrateG: 0,
				},
			},
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

	it("validates and confirms a replacement through the existing add preparation path", async () => {
		const calls: ReplaceMealItemOptions[] = [];
		const confirmations: ReplaceMealItemOptions[] = [];
		const service = new MealItemMutationService(
			{
				replaceMealItem: async (options: ReplaceMealItemOptions) => {
					calls.push(options);
					return successCases[5].result;
				},
			} as unknown as DayPlanClient,
			{ getAvailableMeasureIds: async () => new Set(["measure-2"]) },
			{ getRecipe: async () => recipeDetails() },
			{
				...alwaysConfirmingMealItemMutations(),
				confirmReplaced: async (options) => {
					confirmations.push(options);
				},
			},
		);
		const options = new ReplaceMealItemOptions(
			"2026-07-14",
			"breakfast",
			"old-item-1",
			new ProductMealItemInput("food-2", "measure-2", 0.5),
		);

		const result = await service.replaceMealItem(options);

		expect(calls).toHaveLength(1);
		expect(calls[0]?.replacement).toBeInstanceOf(ProductMealItemInput);
		expect(confirmations).toEqual(calls);
		expect(result).toBe(successCases[5].result);
	});

	it("rejects a replacement with a mismatched product measure before the day-plan write", async () => {
		const calls: ReplaceMealItemOptions[] = [];
		const service = new MealItemMutationService(
			{
				replaceMealItem: async (options: ReplaceMealItemOptions) => {
					calls.push(options);
					return successCases[5].result;
				},
			} as unknown as DayPlanClient,
			{ getAvailableMeasureIds: async () => new Set(["measure-1"]) },
			{ getRecipe: async () => recipeDetails() },
		);

		await expect(
			service.replaceMealItem(
				new ReplaceMealItemOptions(
					"2026-07-14",
					"breakfast",
					"old-item-1",
					new ProductMealItemInput("food-2", "wrong-measure"),
				),
			),
		).rejects.toThrow("Measure at items[0].measureId does not belong to the selected food.");
		expect(calls).toEqual([]);
	});

	it("rejects a deleted recipe replacement before the day-plan write", async () => {
		const calls: ReplaceMealItemOptions[] = [];
		const service = new MealItemMutationService(
			{
				replaceMealItem: async (options: ReplaceMealItemOptions) => {
					calls.push(options);
					return successCases[5].result;
				},
			} as unknown as DayPlanClient,
			{ getAvailableMeasureIds: async () => new Set(["39"]) },
			{ getRecipe: async () => recipeDetails({ deleted: true }) },
		);

		await expect(
			service.replaceMealItem(
				new ReplaceMealItemOptions(
					"2026-07-14",
					"breakfast",
					"old-item-1",
					new RecipeMealItemInput("159408954", "39"),
				),
			),
		).rejects.toThrow("Deleted recipe at items[0].recipeId cannot be added to a day plan.");
		expect(calls).toEqual([]);
	});

	it("rejects a mismatched update measure before delegating the day-plan write", async () => {
		const calls: UpdateMealItemOptions[] = [];
		const lookups: { readonly definitionId: string | number; readonly foodType: string }[] = [];
		const service = new MealItemMutationService(
			{
				getDayPlan: async () =>
					dayPlanWithItem("breakfast", {
						planDayDietItemId: "item-1",
						foodType: "PRODUCT",
						productId: 100,
						measureId: 1,
					}),
				updateMealItem: async (options: UpdateMealItemOptions) => {
					calls.push(options);
					return successCases[2].result;
				},
			} as unknown as DayPlanClient,
			{
				getAvailableMeasureIds: async (definitionId, foodType) => {
					lookups.push({ definitionId, foodType });
					return new Set(["1"]);
				},
			},
			{ getRecipe: async () => recipeDetails() },
			alwaysConfirmingMealItemMutations(),
		);

		await expect(
			service.updateMealItem({
				date: "2026-07-14",
				mealKey: "breakfast",
				itemId: "item-1",
				measureId: "999",
			}),
		).rejects.toThrow("Measure does not belong to the selected food.");
		expect(lookups).toEqual([{ definitionId: 100, foodType: "PRODUCT" }]);
		expect(calls).toEqual([]);
	});

	it.each([
		{ name: "measureId", update: { measureId: "1" } },
		{ name: "measureQuantity", update: { measureQuantity: 2 } },
	])("rejects a $name update for a CUSTOM_ITEM before delegating the day-plan write", async ({ update }) => {
		const calls: UpdateMealItemOptions[] = [];
		let measureLookupCalled = false;
		const service = new MealItemMutationService(
			{
				getDayPlan: async () =>
					dayPlanWithItem("supper", {
						planDayDietItemId: "custom-1",
						foodType: "CUSTOM_ITEM",
						measureId: 1,
						measureQuantity: 100,
					}),
				updateMealItem: async (options: UpdateMealItemOptions) => {
					calls.push(options);
					return successCases[2].result;
				},
			} as unknown as DayPlanClient,
			{
				getAvailableMeasureIds: async () => {
					measureLookupCalled = true;
					return new Set(["1"]);
				},
			},
			{ getRecipe: async () => recipeDetails() },
			alwaysConfirmingMealItemMutations(),
		);

		await expect(
			service.updateMealItem({
				date: "2026-07-14",
				mealKey: "supper",
				itemId: "custom-1",
				...update,
			}),
		).rejects.toMatchObject({
			code: SERVICE_ERROR_CODES.customMealItemMeasureImmutable,
		});
		expect(measureLookupCalled).toBe(false);
		expect(calls).toEqual([]);
	});

	it.each([
		{
			name: "missing destination",
			options: new MoveMealItemOptions("2026-07-14", "breakfast", "item-1"),
			expectedCode: SERVICE_ERROR_CODES.mealItemMoveDestinationRequired,
		},
		{
			name: "unchanged destination",
			options: new MoveMealItemOptions("2026-07-14", "breakfast", "item-1", "2026-07-14", "breakfast"),
			expectedCode: SERVICE_ERROR_CODES.mealItemMoveDestinationUnchanged,
		},
	])("rejects a move with $name before reading its source", async ({ options, expectedCode }) => {
		let sourceRead = false;
		let moveDelegated = false;
		const confirmation: MealItemMutationConfirmationProvider = {
			...alwaysConfirmingMealItemMutations(),
			getMoveSource: async () => {
				sourceRead = true;
				throw new Error("Move source must not be read");
			},
		};
		const service = new MealItemMutationService(
			{
				moveMealItem: async () => {
					moveDelegated = true;
					return successCases[4].result;
				},
			} as unknown as DayPlanClient,
			{ getAvailableMeasureIds: async () => new Set() },
			{ getRecipe: async () => recipeDetails() },
			confirmation,
		);

		await expect(service.moveMealItem(options)).rejects.toMatchObject({ code: expectedCode });
		expect(sourceRead).toBe(false);
		expect(moveDelegated).toBe(false);
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
		).resolves.toMatchObject({ operation: "add" });
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
	| { readonly operation: "move"; readonly options: MoveMealItemOptions }
	| { readonly operation: "replace"; readonly options: ReplaceMealItemOptions };

type TestMealItemMutationResult =
	AddMealItemsResult | UpdateMealItemResult | RemoveMealItemsResult | MoveMealItemResult | ReplaceMealItemResult;

class FakeMealItemMutationService {
	public readonly calls: MutationCall[] = [];

	public constructor(
		private readonly result: TestMealItemMutationResult,
		private readonly error?: Error,
	) {}

	public async addMealItems(options: AddMealItemsOptions): Promise<AddMealItemsResult> {
		return this.record({ operation: "add", options });
	}

	public async updateMealItem(options: UpdateMealItemOptions): Promise<UpdateMealItemResult> {
		return this.record({ operation: "update", options });
	}

	public async removeMealItems(options: RemoveMealItemsOptions): Promise<RemoveMealItemsResult> {
		return this.record({ operation: "remove", options });
	}

	public async moveMealItem(options: MoveMealItemOptions): Promise<MoveMealItemResult> {
		return this.record({ operation: "move", options });
	}

	public async replaceMealItem(options: ReplaceMealItemOptions): Promise<ReplaceMealItemResult> {
		return this.record({ operation: "replace", options });
	}

	private record(call: Extract<MutationCall, { readonly operation: "add" }>): Promise<AddMealItemsResult>;
	private record(call: Extract<MutationCall, { readonly operation: "update" }>): Promise<UpdateMealItemResult>;
	private record(call: Extract<MutationCall, { readonly operation: "remove" }>): Promise<RemoveMealItemsResult>;
	private record(call: Extract<MutationCall, { readonly operation: "move" }>): Promise<MoveMealItemResult>;
	private record(call: Extract<MutationCall, { readonly operation: "replace" }>): Promise<ReplaceMealItemResult>;
	private async record(call: MutationCall): Promise<TestMealItemMutationResult> {
		this.calls.push(call);
		if (this.error) {
			throw this.error;
		}
		if (this.result.operation !== call.operation) {
			throw new Error(`Expected a ${call.operation} test result, received ${this.result.operation}`);
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

function dayPlanWithItem(mealKey: string, item: Record<string, unknown>): DayPlan {
	return DayPlan.fromApiResponse({
		date: "2026-07-14",
		userId: "user-1",
		data: {
			dietPlan: {
				[mealKey]: {
					mealName: mealKey,
					items: [item],
				},
			},
		},
	});
}

type MutationResultOptions = {
	readonly targetDate: string;
	readonly mealKey: string;
	readonly itemId: string;
} & (
	| { readonly operation: "add" | "update" | "remove" }
	| { readonly operation: "move"; readonly oldItemId: string; readonly toDate: string; readonly toMealKey: string }
	| { readonly operation: "replace"; readonly oldItemId: string }
);

function createMutationResult(options: MutationResultOptions): TestMealItemMutationResult {
	const dayRevisions = DayRevisions.fromRecord({
		[options.targetDate]: `revision-${options.targetDate}`,
	});
	const item = new MealItemOperationSummary(
		0,
		options.itemId,
		"food-1",
		null,
		"PRODUCT",
		options.operation === "move" ? options.toMealKey : options.mealKey,
	);

	switch (options.operation) {
		case "add":
			return new AddMealItemsResult(options.targetDate, options.mealKey, [item], dayRevisions);
		case "update":
			return new UpdateMealItemResult(options.targetDate, item, dayRevisions);
		case "remove":
			return new RemoveMealItemsResult(options.targetDate, [item], dayRevisions);
		case "move":
			return new MoveMealItemResult(
				options.targetDate,
				options.mealKey,
				options.oldItemId,
				options.toDate,
				item,
				dayRevisions,
			);
		case "replace":
			return new ReplaceMealItemResult(
				options.targetDate,
				options.mealKey,
				options.oldItemId,
				item,
				dayRevisions,
				false,
			);
	}
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
		confirmReplaced: async () => undefined,
	};
}
