import { DayPlanClient } from "../../api/dayPlan/DayPlanClient.ts";
import type {
	AddMealItemsOptions,
	MoveMealItemOptions,
	RemoveMealItemOptions,
	RemoveMealItemsOptions,
	UpdateMealItemOptions,
} from "../../api/dayPlan/DayPlanClientTypes.ts";
import type { MealItemMutationResult } from "../../api/dayPlan/MealItemMutation.ts";

export interface MealItemMutationProvider {
	addMealItems(options: AddMealItemsOptions): Promise<MealItemMutationResult>;
	updateMealItem(options: UpdateMealItemOptions): Promise<MealItemMutationResult>;
	removeMealItem(options: RemoveMealItemOptions): Promise<MealItemMutationResult>;
	removeMealItems(options: RemoveMealItemsOptions): Promise<MealItemMutationResult>;
	moveMealItem(options: MoveMealItemOptions): Promise<MealItemMutationResult>;
}

export class MealItemMutationService implements MealItemMutationProvider {
	private readonly dayPlanClient;

	public constructor(dayPlanClient: DayPlanClient) {
		this.dayPlanClient = dayPlanClient;
	}

	public addMealItems(options: AddMealItemsOptions): Promise<MealItemMutationResult> {
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
}
