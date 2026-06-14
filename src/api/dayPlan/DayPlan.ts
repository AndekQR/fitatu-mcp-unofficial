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
		if (!isRecord(input.data)) {
			throw new DayPlanError("DayPlan response was not a valid JSON object");
		}

		if (!isRecord(input.data.dietPlan)) {
			throw new DayPlanError("DayPlan response did not contain dietPlan");
		}

		return new DayPlan({
			date: input.date,
			userId: input.userId,
			meals: DayPlanMeal.fromDietPlan(input.data.dietPlan),
		});
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
