import { ObjectUtils } from "../../shared/ObjectUtils.ts";
import { StringUtils } from "../../shared/StringUtils.ts";
import { ValidationError } from "../../shared/ValidationError.ts";
import { DayRevisions } from "../dayPlan/DayRevisions.ts";
import { FitatuApiClientBase } from "../fitatuApiClientBase/FitatuApiClientBase.ts";
import type { FitatuApiClientBaseOptions } from "../fitatuApiClientBase/FitatuApiClientBaseOptions.ts";
import { FitatuClientError } from "../fitatuApiClientBase/FitatuClientError.ts";
import { FITATU_CLIENT_OPERATIONS } from "../fitatuApiClientBase/FitatuClientOperations.ts";
import { FitatuFallbackRunner } from "../fitatuApiClientBase/FitatuFallbackRunner.ts";
import { FitatuResponseDecodeError } from "../fitatuApiClientBase/FitatuResponseDecodeError.ts";
import { getApiProblemMessage } from "../dayPlan/DayPlanApiResponse.ts";
import { DaySyncReceipt } from "./DaySyncReceipt.ts";
import type { SyncDaysRequest } from "./SyncDaysRequest.ts";

/** HTTP adapter for POST /diet-plan/{userId}/days, including Fitatu version fallbacks. */
export class DaysClient extends FitatuApiClientBase {
	public constructor(options: FitatuApiClientBaseOptions = {}) {
		super(options);
	}

	public async syncDays(request: SyncDaysRequest): Promise<DayRevisions> {
		const userId = StringUtils.firstNonEmptyString(request.userId);
		if (!userId || !ObjectUtils.isRecord(request.daysPayload)) {
			throw FitatuClientError.invalidRequest({
				operation: FITATU_CLIENT_OPERATIONS.dayPlanSync,
				message: !userId ? "Fitatu user id is required" : "daysPayload must be a JSON object",
			});
		}

		const paths = this.paths(userId);
		return FitatuFallbackRunner.run(
			paths,
			(path) => this.post(path, request.daysPayload),
			(error) => error.failure.kind === "http" && error.failure.statusCode === 404,
		);
	}

	private async post(path: string, body: Record<string, unknown>): Promise<DayRevisions> {
		const allowEmptyLegacyResponse = path.startsWith("/v2/") || path.startsWith("/v3/");
		return this.performCallout({
			operation: FITATU_CLIENT_OPERATIONS.dayPlanSync,
			method: "POST",
			path,
			endpointTemplate: endpointTemplateForPath(path),
			failureMessage: "Fitatu day synchronization request failed",
			invalidResponseMessage: "Fitatu day synchronization response was invalid",
			headers: { "content-type": "application/json;charset=UTF-8" },
			query: { synchronous: true },
			body: JSON.stringify(body),
			decoder: (data) => decodeSyncResponse(data, allowEmptyLegacyResponse),
		});
	}

	private paths(userId: string): readonly string[] {
		const encodedUserId = encodeURIComponent(userId);
		return [
			`/diet-plan/${encodedUserId}/days`,
			`/v2/diet-plan/${encodedUserId}/days`,
			`/v3/diet-plan/${encodedUserId}/days`,
		];
	}
}

function decodeSyncResponse(data: unknown, allowEmptyLegacyResponse: boolean): DayRevisions {
	if (data === null) {
		if (allowEmptyLegacyResponse) {
			return DayRevisions.empty();
		}
		throw new FitatuResponseDecodeError("Fitatu day synchronization response was empty");
	}
	if (!Array.isArray(data)) {
		const apiProblem = getApiProblemMessage(data);
		if (apiProblem) {
			throw new FitatuResponseDecodeError(apiProblem);
		}
		throw new FitatuResponseDecodeError("Fitatu day synchronization response was not an array");
	}
	const receipts = data.map((receipt) => DaySyncReceipt.fromApiResponse(receipt));
	const failedReceipt = receipts.find(({ errorMessage }) => errorMessage !== null);
	if (failedReceipt?.errorMessage) {
		throw new FitatuResponseDecodeError(failedReceipt.errorMessage);
	}
	try {
		return DayRevisions.fromReceipts(receipts);
	} catch (error) {
		if (!(error instanceof ValidationError)) {
			throw error;
		}
		throw new FitatuResponseDecodeError(error.message);
	}
}

function endpointTemplateForPath(path: string): string {
	if (path.startsWith("/v2/")) {
		return "/v2/diet-plan/:userId/days";
	}
	if (path.startsWith("/v3/")) {
		return "/v3/diet-plan/:userId/days";
	}
	return "/diet-plan/:userId/days";
}
