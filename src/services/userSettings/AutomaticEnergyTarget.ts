import type { MacronutrientDistribution } from "./MacronutrientDistribution.ts";

export class AutomaticEnergyTarget {
	public readonly mode = "automatic" as const;
	public readonly kcal: number;
	public readonly macronutrientDistribution?: MacronutrientDistribution;

	public constructor(kcal: number, macronutrientDistribution?: MacronutrientDistribution) {
		this.kcal = kcal;
		this.macronutrientDistribution = macronutrientDistribution;
	}
}
