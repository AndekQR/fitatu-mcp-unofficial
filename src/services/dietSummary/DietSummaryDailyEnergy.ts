export class DietSummaryDailyEnergy {
	public readonly date: string;
	public readonly logged: number;
	public readonly target: number | null;
	public readonly remainingToTarget: number | null;

	public constructor(date: string, logged: number, target: number | null, remainingToTarget: number | null) {
		this.date = date;
		this.logged = logged;
		this.target = target;
		this.remainingToTarget = remainingToTarget;
	}
}
