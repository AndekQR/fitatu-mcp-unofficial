import { DayPlanClient } from "../../api/dayPlan/DayPlanClient.ts";
import type { DayPlan } from "../../api/dayPlan/DayPlan.ts";
import type { GetDayPlanOptions } from "../../api/dayPlan/DayPlanClientTypes.ts";

export class DayPlanQueryService {

	private readonly dayPlanClient;

	public constructor(dayPlanClient: DayPlanClient) {
		this.dayPlanClient = dayPlanClient;
	}

	public getDayPlan(options: GetDayPlanOptions): Promise<DayPlan> {
		return this.dayPlanClient.getDayPlan(options);
	}
}
