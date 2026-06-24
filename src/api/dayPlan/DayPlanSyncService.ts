import { DayClient } from "../dietAndActivityPlan/DayClient.ts";
import { DaysClient } from "../dietPlan/DaysClient.ts";
import type { FitatuApiClientBaseOptions } from "../fitatuApiClientBase/FitatuApiClientBaseOptions.ts";
import { asRecord, isRecord } from "./DayPlanApiResponse.ts";
import { DayPlanError } from "./DayPlanError.ts";
import type { GetDayPlanOptions } from "./DayPlanClientTypes.ts";

export interface DaySyncPayload {
	dietPlan: Record<string, unknown>;
	toiletItems: unknown[];
	note: unknown;
	tagsIds: unknown[];
}

export class DayPlanSyncService {
	private readonly dayClient: DayClient;
	private readonly daysClient: DaysClient;

	public constructor(options: FitatuApiClientBaseOptions = {}) {
		this.dayClient = new DayClient(options);
		this.daysClient = new DaysClient(options);
	}

	public async getDayPlanData(options: GetDayPlanOptions & { readonly userId: string }): Promise<unknown> {
		return this.dayClient.getDay(options);
	}

	public async getDaySyncPayload(userId: string, date: string): Promise<DaySyncPayload> {
		const data = await this.getDayPlanData({ date, userId });
		if (!isRecord(data)) {
			throw new DayPlanError("DayPlan response was not a valid JSON object");
		}

		return {
			dietPlan: asRecord(data.dietPlan, "dietPlan"),
			toiletItems: Array.isArray(data.toiletItems) ? data.toiletItems : [],
			note: data.note ?? null,
			tagsIds: Array.isArray(data.tagsIds) ? data.tagsIds : [],
		};
	}

	public async syncSingleDay(userId: string, date: string, dayPayload: DaySyncPayload): Promise<void> {
		await this.syncDays(userId, { [date]: dayPayload });
	}

	public async syncDays(userId: string, daysPayload: Record<string, unknown>): Promise<void> {
		try {
			await this.daysClient.syncDays({ userId, daysPayload });
		} catch (error) {
			if (error instanceof DayPlanError) {
				throw new DayPlanError(
					error.fitatuApiError?.upstreamMessage ?? "Fitatu day synchronization request failed",
					{
						statusCode: error.statusCode,
						fitatuApiError: error.fitatuApiError,
					},
				);
			}
			throw new DayPlanError("Fitatu day synchronization request failed");
		}
	}
}
