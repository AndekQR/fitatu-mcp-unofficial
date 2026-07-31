import { AddMealItemsOptions } from "../../api/dayPlan/AddMealItemsOptions.ts";
import { DayPlanClient } from "../../api/dayPlan/DayPlanClient.ts";
import type { FoodTypeName } from "../../api/dayPlan/FoodType.ts";
import { MealItemMutationResult } from "../../api/dayPlan/MealItemMutationResult.ts";
import type { MealItemInput } from "../../api/dayPlan/MealItemInput.ts";
import type { MoveMealItemOptions } from "../../api/dayPlan/MoveMealItemOptions.ts";
import type { RemoveMealItemOptions } from "../../api/dayPlan/RemoveMealItemOptions.ts";
import { RemoveMealItemsOptions } from "../../api/dayPlan/RemoveMealItemsOptions.ts";
import type { UpdateMealItemOptions } from "../../api/dayPlan/UpdateMealItemOptions.ts";
import type { FoodSearchClient } from "../../api/foodSearch/FoodSearchClient.ts";
import type { RecipeClient } from "../../api/recipes/RecipeClient.ts";
import { RecipeMealItemInput } from "../../api/dayPlan/RecipeMealItemInput.ts";
import type { DayPlanItem } from "../../api/dayPlan/DayPlanItem.ts";
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
	addMealItems(options: AddMealItemsOptions): Promise<MealItemMutationResult>;
	updateMealItem(options: UpdateMealItemOptions): Promise<MealItemMutationResult>;
	removeMealItem(options: RemoveMealItemOptions): Promise<MealItemMutationResult>;
	removeMealItems(options: RemoveMealItemsOptions): Promise<MealItemMutationResult>;
	moveMealItem(options: MoveMealItemOptions): Promise<MealItemMutationResult>;
}

export interface MealItemMutationConfirmationProvider {
	confirmAdded(options: AddMealItemsOptions, result: MealItemMutationResult): Promise<void>;
	confirmUpdated(options: UpdateMealItemOptions): Promise<void>;
	confirmRemoved(options: RemoveMealItemsOptions): Promise<void>;
	getMoveSource(options: MoveMealItemOptions): Promise<DayPlanItem>;
	confirmMoved(options: MoveMealItemOptions, result: MealItemMutationResult, source: DayPlanItem): Promise<void>;
}

export class MealItemMutationService implements MealItemMutationProvider {
	private readonly dayPlanClient;
	private readonly foodMeasureProvider: FoodMeasureProvider;
	private readonly recipeStateProvider: RecipeStateProvider;
	private readonly confirmer: MealItemMutationConfirmationProvider;

	public constructor(
		dayPlanClient: DayPlanClient,
		foodMeasureProvider: Pick<FoodSearchClient, "getAvailableMeasureIds">,
		recipeStateProvider: Pick<RecipeClient, "getRecipe">,
		confirmer: MealItemMutationConfirmationProvider = new MealItemMutationConfirmer(dayPlanClient),
	) {
		this.dayPlanClient = dayPlanClient;
		this.foodMeasureProvider = foodMeasureProvider;
		this.recipeStateProvider = recipeStateProvider;
		this.confirmer = confirmer;
	}

	public async addMealItems(options: AddMealItemsOptions): Promise<MealItemMutationResult> {
		const items = await this.prepareMealItems(options.items);
		const preparedOptions = new AddMealItemsOptions(options.date, options.mealKey, items, options.userId);
		const result = await this.dayPlanClient.addMealItems(preparedOptions);
		await this.confirmer.confirmAdded(preparedOptions, result);
		return MealItemMutationResult.confirmed(result);
	}

	public async updateMealItem(options: UpdateMealItemOptions): Promise<MealItemMutationResult> {
		const result = await this.dayPlanClient.updateMealItem(options);
		await this.confirmer.confirmUpdated(options);
		return MealItemMutationResult.confirmed(result);
	}

	public async removeMealItem(options: RemoveMealItemOptions): Promise<MealItemMutationResult> {
		const result = await this.dayPlanClient.removeMealItem(options);
		await this.confirmer.confirmRemoved(new RemoveMealItemsOptions(options.date, [options.itemId], options.userId));
		return MealItemMutationResult.confirmed(result);
	}

	public async removeMealItems(options: RemoveMealItemsOptions): Promise<MealItemMutationResult> {
		const result = await this.dayPlanClient.removeMealItems(options);
		await this.confirmer.confirmRemoved(options);
		return MealItemMutationResult.confirmed(result);
	}

	public async moveMealItem(options: MoveMealItemOptions): Promise<MealItemMutationResult> {
		const source = await this.confirmer.getMoveSource(options);
		const result = await this.dayPlanClient.moveMealItem(options);
		await this.confirmer.confirmMoved(options, result, source);
		return MealItemMutationResult.confirmed(result);
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
}
