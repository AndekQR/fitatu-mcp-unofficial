import { DayPlanClient } from "../../api/dayPlan/DayPlanClient.ts";
import type { DayPlan } from "../../api/dayPlan/DayPlan.ts";
import type { GetDayPlanOptions } from "../../api/dayPlan/DayPlanClientTypes.ts";

export interface DayPlanQueryProvider {
	getDayPlan(options: GetDayPlanOptions): Promise<DayPlan>;
}

export class DayPlanQueryService implements DayPlanQueryProvider {
	private readonly dayPlanClient;

	public constructor(dayPlanClient: DayPlanClient) {
		this.dayPlanClient = dayPlanClient;
	}

	public getDayPlan(options: GetDayPlanOptions): Promise<DayPlan> {
		return this.dayPlanClient.getDayPlan(options);
	}
}
