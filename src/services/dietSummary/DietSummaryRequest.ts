export class DietSummaryRequest {
	public readonly fromDate: string;
	public readonly toDate: string;

	public constructor(fromDate: string, toDate: string) {
		this.fromDate = fromDate;
		this.toDate = toDate;
	}
}
