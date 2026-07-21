import { DayPlanError } from "../dayPlan/DayPlanError.ts";
import { createFitatuApiErrorDetails } from "../fitatuApiClientBase/FitatuApiError.ts";
import { FitatuApiClientBase } from "../fitatuApiClientBase/FitatuApiClientBase.ts";
import type { FitatuApiClientBaseOptions } from "../fitatuApiClientBase/FitatuApiClientBaseOptions.ts";
import type { GetEnergySummaryRequest } from "./GetEnergySummaryRequest.ts";
import type { GetEnergySummaryResponse } from "./GetEnergySummaryResponse.ts";
import type { GetSummaryRequest } from "./GetSummaryRequest.ts";
import type { GetSummaryResponse } from "./GetSummaryResponse.ts";
import { z } from "zod";

const nullableNumberSchema = z.number().nullable();
const summaryMeasureSchema = z.object({
	current: nullableNumberSchema,
	min: nullableNumberSchema,
	max: nullableNumberSchema,
	eaten: nullableNumberSchema,
});
const summaryResponseSchema: z.ZodType<GetSummaryResponse> = z.record(z.string(), summaryMeasureSchema);
const energySummaryResponseSchema: z.ZodType<GetEnergySummaryResponse> = z.object({
	targets: z.record(z.string(), nullableNumberSchema),
	measures: z.record(z.string(), nullableNumberSchema),
});

/** HTTP adapter for Fitatu diet-plan summary endpoints. */
export class SummaryClient extends FitatuApiClientBase {
	public constructor(options: FitatuApiClientBaseOptions = {}) {
		super(options);
	}

	public async getSummary(request: GetSummaryRequest): Promise<GetSummaryResponse> {
		return this.get({
			path: `/v2/diet-plan/${encodeURIComponent(request.userId)}/summary/custom`,
			request,
			errorMessage: "Fitatu diet plan summary request failed",
			responseSchema: summaryResponseSchema,
		});
	}

	public async getEnergySummary(request: GetEnergySummaryRequest): Promise<GetEnergySummaryResponse> {
		return this.get({
			path: `/v2/diet-plan/${encodeURIComponent(request.userId)}/summary/energy/custom`,
			request,
			errorMessage: "Fitatu diet plan energy summary request failed",
			responseSchema: energySummaryResponseSchema,
		});
	}

	private async get<ResponseBody>(options: {
		readonly path: string;
		readonly request: GetSummaryRequest | GetEnergySummaryRequest;
		readonly errorMessage: string;
		readonly responseSchema: z.ZodType<ResponseBody>;
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
		const result = options.responseSchema.safeParse(data);
		if (!result.success) {
			throw new DayPlanError("Fitatu diet plan summary response was invalid");
		}

		return result.data;
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
