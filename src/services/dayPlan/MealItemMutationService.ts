import { AddMealItemsOptions } from "../../api/dayPlan/AddMealItemsOptions.ts";
import type { AddMealItemsResult } from "../../api/dayPlan/AddMealItemsResult.ts";
import { DayPlanClient } from "../../api/dayPlan/DayPlanClient.ts";
import type { FoodTypeName } from "../../api/dayPlan/FoodType.ts";
import type { MoveMealItemResult } from "../../api/dayPlan/MoveMealItemResult.ts";
import type { MealItemInput } from "../../api/dayPlan/MealItemInput.ts";
import { MoveMealItemOptions } from "../../api/dayPlan/MoveMealItemOptions.ts";
import { RemoveMealItemOptions } from "../../api/dayPlan/RemoveMealItemOptions.ts";
import { RemoveMealItemsOptions } from "../../api/dayPlan/RemoveMealItemsOptions.ts";
import type { RemoveMealItemsResult } from "../../api/dayPlan/RemoveMealItemsResult.ts";
import type { ReplaceMealItemResult } from "../../api/dayPlan/ReplaceMealItemResult.ts";
import { ReplaceMealItemOptions } from "../../api/dayPlan/ReplaceMealItemOptions.ts";
import { UpdateMealItemOptions } from "../../api/dayPlan/UpdateMealItemOptions.ts";
import type { RecipeClient } from "../../api/recipes/RecipeClient.ts";
import { RecipeMealItemInput } from "../../api/dayPlan/RecipeMealItemInput.ts";
import type { DayPlanItem } from "../../api/dayPlan/DayPlanItem.ts";
import type { UpdateMealItemResult } from "../../api/dayPlan/UpdateMealItemResult.ts";
import { MealItemRemovalTarget } from "../../api/dayPlan/MealItemRemovalTarget.ts";
import { ServiceError } from "../ServiceError.ts";
import { SERVICE_ERROR_CODES } from "../ServiceErrorCode.ts";
import { MealItemMutationConfirmer } from "./MealItemMutationConfirmer.ts";

interface FoodMeasureProvider {
	getAvailableMeasureIds(definitionId: string | number, foodType: FoodTypeName): Promise<ReadonlySet<string>>;
}

interface RecipeStateProvider {
	getRecipe(recipeId: string | number): ReturnType<RecipeClient["getRecipe"]>;
}

export interface MealItemMutationProvider {
	addMealItems(options: AddMealItemsOptions): Promise<AddMealItemsResult>;
	updateMealItem(options: UpdateMealItemOptions): Promise<UpdateMealItemResult>;
	removeMealItem(options: RemoveMealItemOptions): Promise<RemoveMealItemsResult>;
	removeMealItems(options: RemoveMealItemsOptions): Promise<RemoveMealItemsResult>;
	moveMealItem(options: MoveMealItemOptions): Promise<MoveMealItemResult>;
	replaceMealItem(options: ReplaceMealItemOptions): Promise<ReplaceMealItemResult>;
}

export interface MealItemMutationConfirmationProvider {
	confirmAdded(options: AddMealItemsOptions, result: AddMealItemsResult): Promise<void>;
	confirmUpdated(options: UpdateMealItemOptions): Promise<void>;
	confirmRemoved(options: RemoveMealItemsOptions): Promise<void>;
	getMoveSource(options: MoveMealItemOptions): Promise<DayPlanItem>;
	confirmMoved(options: MoveMealItemOptions, result: MoveMealItemResult, source: DayPlanItem): Promise<void>;
	confirmReplaced(options: ReplaceMealItemOptions, result: ReplaceMealItemResult): Promise<void>;
}

export class MealItemMutationService implements MealItemMutationProvider {
	private readonly dayPlanClient;
	private readonly foodMeasureProvider: FoodMeasureProvider;
	private readonly recipeStateProvider: RecipeStateProvider;
	private readonly confirmer: MealItemMutationConfirmationProvider;

	public constructor(
		dayPlanClient: DayPlanClient,
		foodMeasureProvider: FoodMeasureProvider,
		recipeStateProvider: Pick<RecipeClient, "getRecipe">,
		confirmer: MealItemMutationConfirmationProvider = new MealItemMutationConfirmer(dayPlanClient),
	) {
		this.dayPlanClient = dayPlanClient;
		this.foodMeasureProvider = foodMeasureProvider;
		this.recipeStateProvider = recipeStateProvider;
		this.confirmer = confirmer;
	}

	public async addMealItems(options: AddMealItemsOptions): Promise<AddMealItemsResult> {
		const items = await this.prepareMealItems(options.items);
		const preparedOptions = new AddMealItemsOptions(options.date, options.mealKey, items, options.userId);
		const result = await this.dayPlanClient.addMealItems(preparedOptions);
		await this.confirmer.confirmAdded(preparedOptions, result);
		return result;
	}

	public async updateMealItem(options: UpdateMealItemOptions): Promise<UpdateMealItemResult> {
		const preparedOptions = UpdateMealItemOptions.from(options);
		await this.validateMealItemMeasureUpdate(preparedOptions);
		const result = await this.dayPlanClient.updateMealItem(preparedOptions);
		await this.confirmer.confirmUpdated(preparedOptions);
		return result;
	}

	public async removeMealItem(options: RemoveMealItemOptions): Promise<RemoveMealItemsResult> {
		const preparedOptions = RemoveMealItemOptions.from(options);
		const result = await this.dayPlanClient.removeMealItem(preparedOptions);
		await this.confirmer.confirmRemoved(
			new RemoveMealItemsOptions(
				preparedOptions.date,
				[new MealItemRemovalTarget(preparedOptions.mealKey, preparedOptions.itemId)],
				preparedOptions.userId,
			),
		);
		return result;
	}

	public async removeMealItems(options: RemoveMealItemsOptions): Promise<RemoveMealItemsResult> {
		const preparedOptions = RemoveMealItemsOptions.from(options);
		const result = await this.dayPlanClient.removeMealItems(preparedOptions);
		await this.confirmer.confirmRemoved(preparedOptions);
		return result;
	}

	public async moveMealItem(options: MoveMealItemOptions): Promise<MoveMealItemResult> {
		const preparedOptions = MoveMealItemOptions.from(options);
		this.validateMoveDestination(preparedOptions);
		const source = await this.confirmer.getMoveSource(preparedOptions);
		const result = await this.dayPlanClient.moveMealItem(preparedOptions);
		await this.confirmer.confirmMoved(preparedOptions, result, source);
		return result;
	}

	public async replaceMealItem(options: ReplaceMealItemOptions): Promise<ReplaceMealItemResult> {
		const [replacement] = await this.prepareMealItems([options.replacement]);
		if (replacement === undefined) {
			throw new Error("Prepared replacement meal item was not available");
		}
		const preparedOptions = new ReplaceMealItemOptions(
			options.date,
			options.mealKey,
			options.itemId,
			replacement,
			options.userId,
		);
		const result = await this.dayPlanClient.replaceMealItem(preparedOptions);
		await this.confirmer.confirmReplaced(preparedOptions, result);
		return result;
	}

	private async prepareMealItems(items: AddMealItemsOptions["items"]): Promise<readonly MealItemInput[]> {
		const cache = new Map<string, ReadonlySet<string>>();
		const preparedItems: MealItemInput[] = [];
		for (const [index, item] of items.entries()) {
			if (item.foodType === "CUSTOM_ITEM") {
				preparedItems.push(item);
				continue;
			}

			const idField = item.foodType === "RECIPE" ? "recipeId" : "productId";
			const definitionId = String(item.foodType === "RECIPE" ? item.recipeId : item.productId).trim();
			if (!definitionId) {
				throw new ServiceError(
					`items[${index}].${idField} is required`,
					"invalidInput",
					SERVICE_ERROR_CODES.mealItemDefinitionRequired,
				);
			}

			if (item.foodType === "RECIPE") {
				const recipe = await this.recipeStateProvider.getRecipe(definitionId);
				if (recipe.deleted) {
					throw new ServiceError(
						`Deleted recipe at items[${index}].recipeId cannot be added to a day plan.`,
						"conflict",
						SERVICE_ERROR_CODES.deletedRecipeSelection,
					);
				}
				preparedItems.push(
					new RecipeMealItemInput(
						item.recipeId,
						item.measureId,
						item.measureQuantity,
						item.eaten,
						recipe.servings,
					),
				);
			} else {
				preparedItems.push(item);
			}

			const cacheKey = `${item.foodType}:${definitionId}`;
			let measureIds = cache.get(cacheKey);
			if (!measureIds) {
				measureIds = await this.foodMeasureProvider.getAvailableMeasureIds(definitionId, item.foodType);
				cache.set(cacheKey, measureIds);
			}

			if (!measureIds.has(String(item.measureId ?? ""))) {
				throw new ServiceError(
					`Measure at items[${index}].measureId does not belong to the selected food.`,
					"invalidInput",
					SERVICE_ERROR_CODES.invalidMealItemMeasure,
				);
			}
		}
		return preparedItems;
	}

	private async validateMealItemMeasureUpdate(options: UpdateMealItemOptions): Promise<void> {
		if (options.measureId === undefined && options.measureQuantity === undefined) {
			return;
		}

		const dayPlan = await this.dayPlanClient.getDayPlan({ date: options.date, userId: options.userId });
		const mealKey = options.mealKey.trim();
		const item = dayPlan.meals
			.find((meal) => meal.mealKey === mealKey)
			?.items.find((candidate) => candidate.itemId === options.itemId);
		if (!item) {
			throw new ServiceError(
				"Meal item was not found in the requested meal context.",
				"conflict",
				SERVICE_ERROR_CODES.mealItemContextMismatch,
			);
		}

		const foodType = item.foodType?.trim().toUpperCase();
		if (foodType === "CUSTOM_ITEM") {
			throw new ServiceError(
				"CUSTOM_ITEM measureId and measureQuantity cannot be updated.",
				"invalidInput",
				SERVICE_ERROR_CODES.customMealItemMeasureImmutable,
			);
		}
		if (options.measureId === undefined) {
			return;
		}

		if (foodType !== "PRODUCT" && foodType !== "RECIPE") {
			throw new ServiceError(
				"Meal item food definition was not available for measure validation.",
				"conflict",
				SERVICE_ERROR_CODES.mealItemContextMismatch,
			);
		}
		const definitionId = foodType === "RECIPE" ? item.recipeId : item.productId;
		if (definitionId === null) {
			throw new ServiceError(
				"Meal item food definition was not available for measure validation.",
				"conflict",
				SERVICE_ERROR_CODES.mealItemContextMismatch,
			);
		}

		const measureIds = await this.foodMeasureProvider.getAvailableMeasureIds(definitionId, foodType);
		if (!measureIds.has(String(options.measureId))) {
			throw new ServiceError(
				"Measure does not belong to the selected food.",
				"invalidInput",
				SERVICE_ERROR_CODES.invalidMealItemMeasure,
			);
		}
	}

	private validateMoveDestination(options: MoveMealItemOptions): void {
		if (options.toDate === undefined && options.toMealKey === undefined) {
			throw new ServiceError(
				"Provide at least one move destination field.",
				"invalidInput",
				SERVICE_ERROR_CODES.mealItemMoveDestinationRequired,
			);
		}

		const fromDate = options.fromDate.trim();
		const toDate = (options.toDate ?? options.fromDate).trim();
		const fromMealKey = options.fromMealKey.trim();
		const toMealKey = (options.toMealKey ?? options.fromMealKey).trim();
		if (fromDate === toDate && fromMealKey === toMealKey) {
			throw new ServiceError(
				"Move destination must differ from its source.",
				"conflict",
				SERVICE_ERROR_CODES.mealItemMoveDestinationUnchanged,
			);
		}
	}
}
