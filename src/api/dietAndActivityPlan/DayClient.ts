import { DateUtils } from "../../shared/DateUtils.ts";
import { ObjectUtils } from "../../shared/ObjectUtils.ts";
import { StringUtils } from "../../shared/StringUtils.ts";
import { ValidationError } from "../../shared/ValidationError.ts";
import { FitatuApiClientBase } from "../fitatuApiClientBase/FitatuApiClientBase.ts";
import type { FitatuApiClientBaseOptions } from "../fitatuApiClientBase/FitatuApiClientBaseOptions.ts";
import { FitatuClientError } from "../fitatuApiClientBase/FitatuClientError.ts";
import { FITATU_CLIENT_OPERATIONS } from "../fitatuApiClientBase/FitatuClientOperations.ts";
import { FitatuResponseDecodeError } from "../fitatuApiClientBase/FitatuResponseDecodeError.ts";
import type { GetDayRequest } from "./GetDayRequest.ts";
import type { GetDayResponse } from "./GetDayResponse.ts";

/** HTTP adapter for GET /diet-and-activity-plan/{userId}/day/{date}. */
export class DayClient extends FitatuApiClientBase {
	public constructor(options: FitatuApiClientBaseOptions = {}) {
		super(options);
	}

	public async getDay(request: GetDayRequest): Promise<GetDayResponse> {
		const userId = StringUtils.firstNonEmptyString(request.userId);
		if (!userId) {
			throw FitatuClientError.invalidRequest({
				operation: FITATU_CLIENT_OPERATIONS.dayPlanGet,
				message: "Fitatu user id is required",
			});
		}
		const date = normalizeDate(request.date);
		if (request.withRating !== undefined && typeof request.withRating !== "boolean") {
			throw FitatuClientError.invalidRequest({
				operation: FITATU_CLIENT_OPERATIONS.dayPlanGet,
				message: "withRating must be a boolean",
			});
		}
		const path = `/diet-and-activity-plan/${encodeURIComponent(userId)}/day/${date}`;

		return this.performCallout({
			operation: FITATU_CLIENT_OPERATIONS.dayPlanGet,
			method: "GET",
			path,
			endpointTemplate: "/diet-and-activity-plan/:userId/day/:date",
			failureMessage: "Fitatu day plan request failed",
			invalidResponseMessage: "Fitatu day plan response was invalid",
			query: request.withRating === true ? { withRating: true } : undefined,
			decoder: decodeDayResponse,
		});
	}
}

function decodeDayResponse(data: unknown): GetDayResponse {
	if (!ObjectUtils.isRecord(data)) {
		throw new FitatuResponseDecodeError("Fitatu day plan response was not a JSON object");
	}

	return data;
}

function normalizeDate(value: string): string {
	try {
		return DateUtils.validateIsoDate(value);
	} catch (error) {
		if (!(error instanceof ValidationError)) {
			throw error;
		}

		throw FitatuClientError.invalidRequest({
			operation: FITATU_CLIENT_OPERATIONS.dayPlanGet,
			message: error.message,
		});
	}
}
