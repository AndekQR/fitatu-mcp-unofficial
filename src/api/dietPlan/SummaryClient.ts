import { DayPlanError } from "../dayPlan/DayPlanError.ts";
import { createFitatuApiErrorDetails } from "../fitatuApiClientBase/FitatuApiError.ts";
import { FitatuApiClientBase } from "../fitatuApiClientBase/FitatuApiClientBase.ts";
import type { FitatuApiClientBaseOptions } from "../fitatuApiClientBase/FitatuApiClientBaseOptions.ts";
import type { GetEnergySummaryRequest } from "./GetEnergySummaryRequest.ts";
import type { GetEnergySummaryResponse } from "./GetEnergySummaryResponse.ts";
import type { GetSummaryRequest } from "./GetSummaryRequest.ts";
import type { GetSummaryResponse } from "./GetSummaryResponse.ts";

/** HTTP adapter for Fitatu diet-plan summary endpoints. */
export class SummaryClient extends FitatuApiClientBase {
	public constructor(options: FitatuApiClientBaseOptions = {}) {
		super(options);
	}

	public async getSummary(request: GetSummaryRequest): Promise<GetSummaryResponse> {
		return this.get<GetSummaryResponse>({
			path: `/v2/diet-plan/${encodeURIComponent(request.userId)}/summary/custom`,
			request,
			errorMessage: "Fitatu diet plan summary request failed",
		});
	}

	public async getEnergySummary(request: GetEnergySummaryRequest): Promise<GetEnergySummaryResponse> {
		return this.get<GetEnergySummaryResponse & Record<string, unknown>>({
			path: `/v2/diet-plan/${encodeURIComponent(request.userId)}/summary/energy/custom`,
			request,
			errorMessage: "Fitatu diet plan energy summary request failed",
		});
	}

	private async get<ResponseBody extends Record<string, unknown>>(options: {
		readonly path: string;
		readonly request: GetSummaryRequest | GetEnergySummaryRequest;
		readonly errorMessage: string;
	}): Promise<ResponseBody> {
		const fromDate = normalizeSummaryDate(options.request.fromDate, "fromDate");
		const toDate = normalizeSummaryDate(options.request.toDate, "toDate");
		if (fromDate > toDate) {
			throw new DayPlanError("fromDate must be before or equal to toDate");
		}

		const response = await this.fetchFitatuApi({
			method: "GET",
			path: options.path,
			headers: { accept: this.V3_ACCEPT_HEADER },
			query: { fromDate, toDate },
		});

		if (!response.ok) {
			const fitatuApiError = await createFitatuApiErrorDetails(response, {
				method: "GET",
				path: options.path,
			});
			throw new DayPlanError(options.errorMessage, { statusCode: response.status, fitatuApiError });
		}

		const data: unknown = await response.json();
		if (!isRecord(data)) {
			throw new DayPlanError("Fitatu diet plan summary response was not a JSON object");
		}

		return data as ResponseBody;
	}
}

function normalizeSummaryDate(value: string, fieldName: string): string {
	const date = value.trim();
	if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
		throw new DayPlanError(`${fieldName} must use YYYY-MM-DD format`);
	}

	const parsed = new Date(`${date}T00:00:00.000Z`);
	if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
		throw new DayPlanError(`${fieldName} must be a valid calendar date`);
	}

	return date;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
