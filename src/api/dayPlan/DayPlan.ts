import { ObjectUtils } from "../../shared/ObjectUtils.ts";
import { DayPlanError } from "./DayPlanError.ts";
import { DayPlanMeal } from "./DayPlanMeal.ts";

export class DayPlan {
	public readonly date: string;
	public readonly userId: string;
	public readonly meals: readonly DayPlanMeal[];

	private constructor(input: { date: string; userId: string; meals: readonly DayPlanMeal[] }) {
		this.date = input.date;
		this.userId = input.userId;
		this.meals = input.meals;
	}

	public static fromApiResponse(input: { data: unknown; date: string; userId: string }): DayPlan {
		if (!ObjectUtils.isRecord(input.data)) {
			throw new DayPlanError("DayPlan response was not a valid JSON object");
		}

		if (!ObjectUtils.isRecord(input.data.dietPlan)) {
			throw new DayPlanError("DayPlan response did not contain dietPlan");
		}

		return new DayPlan({
			date: input.date,
			userId: input.userId,
			meals: DayPlanMeal.fromDietPlan(input.data.dietPlan),
		});
	}
}
