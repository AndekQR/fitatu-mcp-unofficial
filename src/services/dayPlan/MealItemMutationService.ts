import { DayPlanClient } from "../../api/dayPlan/DayPlanClient.ts";
import type {
	AddMealItemsOptions,
	MoveMealItemOptions,
	RemoveMealItemOptions,
	UpdateMealItemOptions,
} from "../../api/dayPlan/DayPlanClientTypes.ts";
import type { MealItemMutationResult } from "../../api/dayPlan/MealItemMutation.ts";

export class MealItemMutationService {

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

	public moveMealItem(options: MoveMealItemOptions): Promise<MealItemMutationResult> {
		return this.dayPlanClient.moveMealItem(options);
	}
}
