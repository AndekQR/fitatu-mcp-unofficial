import type { AddMealItemsOptions } from "../../api/dayPlan/AddMealItemsOptions.ts";
import { DayPlanClient } from "../../api/dayPlan/DayPlanClient.ts";
import type { FoodTypeName } from "../../api/dayPlan/FoodType.ts";
import type { MealItemMutationResult } from "../../api/dayPlan/MealItemMutationResult.ts";
import type { MealItemInput } from "../../api/dayPlan/MealItemInput.ts";
import type { MoveMealItemOptions } from "../../api/dayPlan/MoveMealItemOptions.ts";
import type { RemoveMealItemOptions } from "../../api/dayPlan/RemoveMealItemOptions.ts";
import type { RemoveMealItemsOptions } from "../../api/dayPlan/RemoveMealItemsOptions.ts";
import type { UpdateMealItemOptions } from "../../api/dayPlan/UpdateMealItemOptions.ts";
import type { FoodSearchClient } from "../../api/foodSearch/FoodSearchClient.ts";
import type { RecipeClient } from "../../api/recipes/RecipeClient.ts";
import { ServiceError } from "../ServiceError.ts";
import { SERVICE_ERROR_CODES } from "../ServiceErrorCode.ts";

interface FoodMeasureProvider {
	getAvailableMeasureIds(definitionId: string | number, foodType: FoodTypeName): Promise<ReadonlySet<string>>;
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
		const items = await this.prepareMealItems(options.items);
		return this.dayPlanClient.addMealItems({ ...options, items });
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
				preparedItems.push({ ...item, ingredientsServing: recipe.servings });
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
}
