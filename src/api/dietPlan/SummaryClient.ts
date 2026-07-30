import { DateUtils } from "../../shared/DateUtils.ts";
import { StringUtils } from "../../shared/StringUtils.ts";
import { ValidationError } from "../../shared/ValidationError.ts";
import { FitatuApiClientBase } from "../fitatuApiClientBase/FitatuApiClientBase.ts";
import type { FitatuApiClientBaseOptions } from "../fitatuApiClientBase/FitatuApiClientBaseOptions.ts";
import { FitatuClientError } from "../fitatuApiClientBase/FitatuClientError.ts";
import { FITATU_CLIENT_OPERATIONS, type FitatuClientOperation } from "../fitatuApiClientBase/FitatuClientOperations.ts";
import { FitatuResponseDecodeError } from "../fitatuApiClientBase/FitatuResponseDecodeError.ts";
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
			operation: FITATU_CLIENT_OPERATIONS.dietSummaryGet,
			resourcePath: "/summary/custom",
			endpointTemplate: "/v2/diet-plan/:userId/summary/custom",
			request,
			errorMessage: "Fitatu diet plan summary request failed",
			responseSchema: summaryResponseSchema,
		});
	}

	public async getEnergySummary(request: GetEnergySummaryRequest): Promise<GetEnergySummaryResponse> {
		return this.get({
			operation: FITATU_CLIENT_OPERATIONS.dietEnergySummaryGet,
			resourcePath: "/summary/energy/custom",
			endpointTemplate: "/v2/diet-plan/:userId/summary/energy/custom",
			request,
			errorMessage: "Fitatu diet plan energy summary request failed",
			responseSchema: energySummaryResponseSchema,
		});
	}

	private async get<ResponseBody>(options: {
		readonly operation: FitatuClientOperation;
		readonly resourcePath: string;
		readonly endpointTemplate: string;
		readonly request: GetSummaryRequest | GetEnergySummaryRequest;
		readonly errorMessage: string;
		readonly responseSchema: z.ZodType<ResponseBody>;
	}): Promise<ResponseBody> {
		const userId = StringUtils.firstNonEmptyString(options.request.userId);
		if (!userId) {
			throw FitatuClientError.invalidRequest({
				operation: options.operation,
				message: "Fitatu user id is required",
			});
		}
		const fromDate = normalizeSummaryDate(options.request.fromDate, "fromDate", options.operation);
		const toDate = normalizeSummaryDate(options.request.toDate, "toDate", options.operation);
		if (fromDate > toDate) {
			throw FitatuClientError.invalidRequest({
				operation: options.operation,
				message: "fromDate must be before or equal to toDate",
			});
		}
		const path = `/v2/diet-plan/${encodeURIComponent(userId)}${options.resourcePath}`;

		return this.performCallout({
			operation: options.operation,
			method: "GET",
			path,
			endpointTemplate: options.endpointTemplate,
			failureMessage: options.errorMessage,
			invalidResponseMessage: "Fitatu diet plan summary response was invalid",
			headers: { accept: this.V3_ACCEPT_HEADER },
			query: { fromDate, toDate },
			decoder: (data) => decodeSummaryResponse(data, options.responseSchema),
		});
	}
}

function normalizeSummaryDate(value: string, fieldName: string, operation: FitatuClientOperation): string {
	try {
		return DateUtils.validateIsoDate(value, { fieldName });
	} catch (error) {
		if (!(error instanceof ValidationError)) {
			throw error;
		}

		throw FitatuClientError.invalidRequest({ operation, message: error.message });
	}
}

function decodeSummaryResponse<ResponseBody>(data: unknown, schema: z.ZodType<ResponseBody>): ResponseBody {
	const result = schema.safeParse(data);
	if (!result.success) {
		throw new FitatuResponseDecodeError("Fitatu diet plan summary response was invalid");
	}

	return result.data;
}
