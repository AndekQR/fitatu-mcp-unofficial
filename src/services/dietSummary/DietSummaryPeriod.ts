export class DietSummaryPeriod {
	public readonly fromDate: string;
	public readonly toDate: string;
	public readonly dayCount: number;

	public constructor(fromDate: string, toDate: string, dayCount: number) {
		this.fromDate = fromDate;
		this.toDate = toDate;
		this.dayCount = dayCount;
	}
}
