import type { DietSummaryEnergy } from "./DietSummaryEnergy.ts";
import type { DietSummaryNutrient } from "./DietSummaryNutrient.ts";
import type { DietSummaryPeriod } from "./DietSummaryPeriod.ts";

export class DietSummaryResult {
	public readonly period: DietSummaryPeriod;
	public readonly energy: DietSummaryEnergy;
	public readonly keyNutrients: readonly DietSummaryNutrient[];
	public readonly allNutrients: readonly DietSummaryNutrient[];

	public constructor(
		period: DietSummaryPeriod,
		energy: DietSummaryEnergy,
		keyNutrients: readonly DietSummaryNutrient[],
		allNutrients: readonly DietSummaryNutrient[],
	) {
		this.period = period;
		this.energy = energy;
		this.keyNutrients = keyNutrients;
		this.allNutrients = allNutrients;
	}
}
