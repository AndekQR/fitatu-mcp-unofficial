export type NutrientStatus = "belowMin" | "withinRange" | "aboveMax" | "noTarget" | "noValue";

export interface DietSummaryRequest {
	readonly fromDate: string;
	readonly toDate: string;
}

export interface DietSummaryResult {
	readonly period: DietSummaryPeriod;
	readonly energy: DietSummaryEnergy;
	readonly keyNutrients: readonly DietSummaryNutrient[];
	readonly allNutrients: readonly DietSummaryNutrient[];
}

export interface DietSummaryPeriod {
	readonly fromDate: string;
	readonly toDate: string;
	readonly dayCount: number;
}

export interface DietSummaryEnergy {
	readonly loggedTotal: number;
	readonly targetTotal: number;
	readonly averageLogged: number;
	readonly averageTarget: number;
	readonly remainingToTarget: number;
	readonly daily: readonly DietSummaryDailyEnergy[];
}

export interface DietSummaryDailyEnergy {
	readonly date: string;
	readonly logged: number;
	readonly target: number | null;
	readonly remainingToTarget: number | null;
}

export interface DietSummaryNutrient {
	readonly key: string;
	readonly label: string;
	readonly unit?: string;
	readonly current: number | null;
	readonly min: number | null;
	readonly max: number | null;
	readonly eaten: number | null;
	readonly status: NutrientStatus;
	readonly amountToMinimum?: number;
	readonly amountOverMaximum?: number;
	readonly remainingToMaximum?: number;
}
