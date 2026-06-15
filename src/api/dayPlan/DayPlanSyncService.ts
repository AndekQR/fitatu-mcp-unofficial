import type { FitatuApiRequestOptions } from "../fitatuApiClientBase/FitatuApiRequestOptions.ts";
import { asRecord, getApiProblemMessage, isRecord, parseOptionalJson } from "./DayPlanApiResponse.ts";
import { DayPlanError } from "./DayPlanError.ts";
import type { GetDayPlanOptions } from "./DayPlanClientTypes.ts";

const V3_ACCEPT_HEADER = "application/json; version=v3";

export interface DaySyncPayload {
	dietPlan: Record<string, unknown>;
	toiletItems: unknown[];
	note: unknown;
	tagsIds: unknown[];
}

export interface FitatuApiTransport {
	fetchFitatuApi(options: FitatuApiRequestOptions): Promise<Response>;
}

export class DayPlanSyncService {
	private readonly transport: FitatuApiTransport;

	public constructor(transport: FitatuApiTransport) {
		this.transport = transport;
	}

	public async getDayPlanData(options: GetDayPlanOptions & { readonly userId: string }): Promise<unknown> {
		const response = await this.transport.fetchFitatuApi({
			method: "GET",
			path: `/diet-and-activity-plan/${encodeURIComponent(options.userId)}/day/${options.date}`,
			headers: { accept: V3_ACCEPT_HEADER },
			query: options.withRating === true ? { withRating: true } : undefined,
		});

		if (!response.ok) {
			throw new DayPlanError("Fitatu day plan request failed", {
				statusCode: response.status,
			});
		}

		return response.json();
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

	public async syncSingleDay(
		userId: string,
		date: string,
		dayPayload: DaySyncPayload,
		failureMessage: string,
	): Promise<void> {
		await this.syncDays(userId, { [date]: dayPayload }, failureMessage);
	}

	public async syncDays(userId: string, daysPayload: Record<string, unknown>, failureMessage: string): Promise<void> {
		await this.fetchAcceptedJson({
			method: "POST",
			path: this.syncDaysPath(userId),
			body: daysPayload,
			failureMessage,
		});
	}

	private async fetchAcceptedJson(options: {
		readonly method: "POST";
		readonly path: string;
		readonly body: unknown;
		readonly failureMessage: string;
	}): Promise<unknown> {
		const response = await this.transport.fetchFitatuApi({
			method: options.method,
			path: options.path,
			headers: {
				accept: V3_ACCEPT_HEADER,
				"content-type": "application/json",
			},
			body: JSON.stringify(options.body),
		});

		if (!response.ok) {
			throw new DayPlanError(options.failureMessage, { statusCode: response.status });
		}

		const data = await parseOptionalJson(response);
		const apiProblem = getApiProblemMessage(data);
		if (apiProblem) {
			throw new DayPlanError(apiProblem, { statusCode: response.status });
		}

		return data;
	}

	private syncDaysPath(userId: string): string {
		const encodedUserId = encodeURIComponent(userId);
		return `/diet-plan/${encodedUserId}/days`;
	}
}
