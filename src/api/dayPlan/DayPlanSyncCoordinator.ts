import { DayClient } from "../dietAndActivityPlan/DayClient.ts";
import { DaysClient } from "../dietPlan/DaysClient.ts";
import type { FitatuApiClientBaseOptions } from "../fitatuApiClientBase/FitatuApiClientBaseOptions.ts";
import { FitatuClientError } from "../fitatuApiClientBase/FitatuClientError.ts";
import { FITATU_CLIENT_OPERATIONS } from "../fitatuApiClientBase/FitatuClientOperations.ts";
import { ObjectUtils } from "../../shared/ObjectUtils.ts";
import { GetDayPlanOptions } from "./GetDayPlanOptions.ts";
import { DayPlanSyncProvider } from "./DayPlanSyncProvider.ts";
import type { DayRevisions } from "./DayRevisions.ts";
import { DaySyncPayload } from "./DaySyncPayload.ts";

export class DayPlanSyncCoordinator extends DayPlanSyncProvider {
	private readonly dayClient: DayClient;
	private readonly daysClient: DaysClient;

	public constructor(options: FitatuApiClientBaseOptions = {}) {
		super();
		this.dayClient = new DayClient(options);
		this.daysClient = new DaysClient(options);
	}

	public async getDayPlanData(options: GetDayPlanOptions): Promise<unknown> {
		if (options.userId === undefined) {
			throw FitatuClientError.invalidRequest({
				operation: FITATU_CLIENT_OPERATIONS.dayPlanGet,
				message: "userId is required",
			});
		}
		return this.dayClient.getDay({
			date: options.date,
			userId: options.userId,
			withRating: options.withRating,
		});
	}

	public async getDaySyncPayload(userId: string, date: string): Promise<DaySyncPayload> {
		const data = await this.getDayPlanData(new GetDayPlanOptions(date, userId));
		if (!ObjectUtils.isRecord(data)) {
			throw FitatuClientError.invalidResponse({
				operation: FITATU_CLIENT_OPERATIONS.dayPlanGet,
				message: "DayPlan response was not a valid JSON object",
				method: "GET",
				endpointTemplate: "/diet-and-activity-plan/:userId/day/:date",
			});
		}
		if (!ObjectUtils.isRecord(data.dietPlan)) {
			throw FitatuClientError.invalidResponse({
				operation: FITATU_CLIENT_OPERATIONS.dayPlanGet,
				message: "dietPlan was not a valid JSON object",
				method: "GET",
				endpointTemplate: "/diet-and-activity-plan/:userId/day/:date",
			});
		}

		return new DaySyncPayload({
			planDayRevisions: Array.isArray(data.planDayRevisions) ? data.planDayRevisions : [],
			activities: Array.isArray(data.activityPlan) ? data.activityPlan : [],
			dietPlan: data.dietPlan,
			toilet: Array.isArray(data.toilet) ? data.toilet : Array.isArray(data.toiletItems) ? data.toiletItems : [],
			water: ObjectUtils.isRecord(data.water) ? data.water : { waterConsumption: 0 },
			note: data.note ?? null,
			tagsIds: Array.isArray(data.tagsIds) ? data.tagsIds : [],
		});
	}

	public async syncSingleDay(userId: string, date: string, dayPayload: DaySyncPayload): Promise<DayRevisions> {
		return this.syncDays(userId, { [date]: dayPayload });
	}

	public async syncDays(userId: string, daysPayload: Record<string, unknown>): Promise<DayRevisions> {
		return this.daysClient.syncDays({ userId, daysPayload });
	}
}
