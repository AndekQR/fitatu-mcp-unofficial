import type { AddMealItemsOptions } from "../../api/dayPlan/AddMealItemsOptions.ts";
import { DayPlanClient } from "../../api/dayPlan/DayPlanClient.ts";
import { DayPlanError } from "../../api/dayPlan/DayPlanError.ts";
import { FoodType, type FoodTypeName } from "../../api/dayPlan/FoodType.ts";
import type { MealItemMutationResult } from "../../api/dayPlan/MealItemMutationResult.ts";
import type { MoveMealItemOptions } from "../../api/dayPlan/MoveMealItemOptions.ts";
import type { RemoveMealItemOptions } from "../../api/dayPlan/RemoveMealItemOptions.ts";
import type { RemoveMealItemsOptions } from "../../api/dayPlan/RemoveMealItemsOptions.ts";
import type { UpdateMealItemOptions } from "../../api/dayPlan/UpdateMealItemOptions.ts";
import type { FoodSearchClient } from "../../api/foodSearch/FoodSearchClient.ts";
import { FoodSearchError } from "../../api/foodSearch/FoodSearchError.ts";
import type { RecipeClient } from "../../api/recipes/RecipeClient.ts";
import { RecipeError } from "../../api/recipes/RecipeError.ts";

interface FoodMeasureProvider {
	getAvailableMeasureIds(foodId: string | number, foodType: FoodTypeName): Promise<ReadonlySet<string>>;
}

interface RecipeStateProvider {
	getRecipe(recipeId: string | number): ReturnType<RecipeClient["getRecipe"]>;
}

export interface MealItemMutationProvider {
	addMealItems(options: AddMealItemsOptions): Promise<MealItemMutationResult>;
	updateMealItem(options: UpdateMealItemOptions): Promise<MealItemMutationResult>;
	removeMealItem(options: RemoveMealItemOptions): Promise<MealItemMutationResult>;
	removeMealItems(options: RemoveMealItemsOptions): Promise<MealItemMutationResult>;
	moveMealItem(options: MoveMealItemOptions): Promise<MealItemMutationResult>;
}

export class MealItemMutationService implements MealItemMutationProvider {
	private readonly dayPlanClient;
	private readonly foodMeasureProvider: FoodMeasureProvider;
	private readonly recipeStateProvider: RecipeStateProvider;

	public constructor(
		dayPlanClient: DayPlanClient,
		foodMeasureProvider: Pick<FoodSearchClient, "getAvailableMeasureIds">,
		recipeStateProvider: Pick<RecipeClient, "getRecipe">,
	) {
		this.dayPlanClient = dayPlanClient;
		this.foodMeasureProvider = foodMeasureProvider;
		this.recipeStateProvider = recipeStateProvider;
	}

	public async addMealItems(options: AddMealItemsOptions): Promise<MealItemMutationResult> {
		await this.validateMealItems(options.items);
		return this.dayPlanClient.addMealItems(options);
	}

	public updateMealItem(options: UpdateMealItemOptions): Promise<MealItemMutationResult> {
		return this.dayPlanClient.updateMealItem(options);
	}

	public removeMealItem(options: RemoveMealItemOptions): Promise<MealItemMutationResult> {
		return this.dayPlanClient.removeMealItem(options);
	}

	public removeMealItems(options: RemoveMealItemsOptions): Promise<MealItemMutationResult> {
		return this.dayPlanClient.removeMealItems(options);
	}

	public moveMealItem(options: MoveMealItemOptions): Promise<MealItemMutationResult> {
		return this.dayPlanClient.moveMealItem(options);
	}

	private async validateMealItems(items: AddMealItemsOptions["items"]): Promise<void> {
		const cache = new Map<string, ReadonlySet<string>>();
		for (const [index, item] of items.entries()) {
			const foodType = FoodType.resolve(
				item.foodType,
				item.recipeId ? "RECIPE" : "PRODUCT",
				`items[${index}].foodType`,
			);
			const foodId = String(item.foodId ?? item.recipeId ?? item.productId ?? "").trim();
			if (!foodId) {
				throw new DayPlanError(`items[${index}].foodId is required`);
			}

			if (foodType === "RECIPE") {
				let recipe;
				try {
					recipe = await this.recipeStateProvider.getRecipe(foodId);
				} catch (error) {
					if (RecipeError.isNotFound(error)) {
						throw new DayPlanError(`Recipe at items[${index}].foodId was not found.`);
					}
					throw error;
				}
				if (recipe.deleted) {
					throw new DayPlanError(`Deleted recipe at items[${index}].foodId cannot be added to a day plan.`);
				}
			}

			const cacheKey = `${foodType}:${foodId}`;
			let measureIds = cache.get(cacheKey);
			if (!measureIds) {
				try {
					measureIds = await this.foodMeasureProvider.getAvailableMeasureIds(foodId, foodType);
				} catch (error) {
					if (error instanceof FoodSearchError && error.statusCode === 404) {
						throw new DayPlanError(`Food at items[${index}].foodId was not found.`);
					}
					throw error;
				}
				cache.set(cacheKey, measureIds);
			}

			if (!measureIds.has(String(item.measureId ?? ""))) {
				throw new DayPlanError(`Measure at items[${index}].measureId does not belong to the selected food.`);
			}
		}
	}
}
