import { DayClient } from "../dietAndActivityPlan/DayClient.ts";
import { DaysClient } from "../dietPlan/DaysClient.ts";
import type { FitatuApiClientBaseOptions } from "../fitatuApiClientBase/FitatuApiClientBaseOptions.ts";
import { FitatuClientError } from "../fitatuApiClientBase/FitatuClientError.ts";
import { FITATU_CLIENT_OPERATIONS } from "../fitatuApiClientBase/FitatuClientOperations.ts";
import { ObjectUtils } from "../../shared/ObjectUtils.ts";
import type { GetDayPlanOptions } from "./GetDayPlanOptions.ts";
import { DayPlanSyncProvider } from "./DayPlanSyncProvider.ts";
import { DaySyncPayload } from "./DaySyncPayload.ts";

export class DayPlanSyncCoordinator extends DayPlanSyncProvider {
	private readonly dayClient: DayClient;
	private readonly daysClient: DaysClient;

	public constructor(options: FitatuApiClientBaseOptions = {}) {
		super();
		this.dayClient = new DayClient(options);
		this.daysClient = new DaysClient(options);
	}

	public async getDayPlanData(options: GetDayPlanOptions & { readonly userId: string }): Promise<unknown> {
		return this.dayClient.getDay(options);
	}

	public async getDaySyncPayload(userId: string, date: string): Promise<DaySyncPayload> {
		const data = await this.getDayPlanData({ date, userId });
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
			dietPlan: data.dietPlan,
			toiletItems: Array.isArray(data.toiletItems) ? data.toiletItems : [],
			note: data.note ?? null,
			tagsIds: Array.isArray(data.tagsIds) ? data.tagsIds : [],
		});
	}

	public async syncSingleDay(userId: string, date: string, dayPayload: DaySyncPayload): Promise<void> {
		await this.syncDays(userId, { [date]: dayPayload });
	}

	public async syncDays(userId: string, daysPayload: Record<string, unknown>): Promise<void> {
		await this.daysClient.syncDays({ userId, daysPayload });
	}
}
