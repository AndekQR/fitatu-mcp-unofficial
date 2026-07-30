import type { NutrientStatus } from "./NutrientStatus.ts";

export class DietSummaryNutrient {
	public readonly key: string;
	public readonly label: string;
	public readonly unit?: string;
	public readonly current: number | null;
	public readonly min: number | null;
	public readonly max: number | null;
	public readonly eaten: number | null;
	public readonly status: NutrientStatus;
	public readonly amountToMinimum?: number;
	public readonly amountOverMaximum?: number;
	public readonly remainingToMaximum?: number;

	public constructor(
		key: string,
		label: string,
		unit: string | undefined,
		current: number | null,
		min: number | null,
		max: number | null,
		eaten: number | null,
		status: NutrientStatus,
		amountToMinimum?: number,
		amountOverMaximum?: number,
		remainingToMaximum?: number,
	) {
		this.key = key;
		this.label = label;
		this.unit = unit;
		this.current = current;
		this.min = min;
		this.max = max;
		this.eaten = eaten;
		this.status = status;
		this.amountToMinimum = amountToMinimum;
		this.amountOverMaximum = amountOverMaximum;
		this.remainingToMaximum = remainingToMaximum;
	}
}
