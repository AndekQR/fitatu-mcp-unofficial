import type { DietSummaryDailyEnergy } from "./DietSummaryDailyEnergy.ts";

export class DietSummaryEnergy {
	public readonly loggedTotal: number;
	public readonly targetTotal: number;
	public readonly averageLogged: number;
	public readonly averageTarget: number;
	public readonly remainingToTarget: number;
	public readonly daily: readonly DietSummaryDailyEnergy[];

	public constructor(
		loggedTotal: number,
		targetTotal: number,
		averageLogged: number,
		averageTarget: number,
		remainingToTarget: number,
		daily: readonly DietSummaryDailyEnergy[],
	) {
		this.loggedTotal = loggedTotal;
		this.targetTotal = targetTotal;
		this.averageLogged = averageLogged;
		this.averageTarget = averageTarget;
		this.remainingToTarget = remainingToTarget;
		this.daily = daily;
	}
}
