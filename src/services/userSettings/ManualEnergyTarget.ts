import type { MacronutrientDistribution } from "./MacronutrientDistribution.ts";

export class ManualEnergyTarget {
	public readonly mode = "manual" as const;
	public readonly kcal: number;
	public readonly macronutrientDistribution?: MacronutrientDistribution;

	public constructor(kcal: number, macronutrientDistribution?: MacronutrientDistribution) {
		this.kcal = kcal;
		this.macronutrientDistribution = macronutrientDistribution;
	}
}
