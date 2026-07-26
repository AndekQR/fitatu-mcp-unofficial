import { ObjectUtils } from "../../shared/ObjectUtils.ts";
import { StringUtils } from "../../shared/StringUtils.ts";
import { FitatuApiClientBase } from "../fitatuApiClientBase/FitatuApiClientBase.ts";
import type { FitatuApiClientBaseOptions } from "../fitatuApiClientBase/FitatuApiClientBaseOptions.ts";
import { FitatuClientError } from "../fitatuApiClientBase/FitatuClientError.ts";
import { FITATU_CLIENT_OPERATIONS } from "../fitatuApiClientBase/FitatuClientOperations.ts";
import { FitatuFallbackRunner } from "../fitatuApiClientBase/FitatuFallbackRunner.ts";
import { FitatuResponseDecodeError } from "../fitatuApiClientBase/FitatuResponseDecodeError.ts";
import { getApiProblemMessage } from "../dayPlan/DayPlanApiResponse.ts";
import type { SyncDaysRequest } from "./SyncDaysRequest.ts";

/** HTTP adapter for POST /diet-plan/{userId}/days, including Fitatu version fallbacks. */
export class DaysClient extends FitatuApiClientBase {
	public constructor(options: FitatuApiClientBaseOptions = {}) {
		super(options);
	}

	public async syncDays(request: SyncDaysRequest): Promise<void> {
		const userId = StringUtils.firstNonEmptyString(request.userId);
		if (!userId || !ObjectUtils.isRecord(request.daysPayload)) {
			throw FitatuClientError.invalidRequest({
				operation: FITATU_CLIENT_OPERATIONS.dayPlanSync,
				message: !userId ? "Fitatu user id is required" : "daysPayload must be a JSON object",
			});
		}

		const paths = this.paths(userId);
		await FitatuFallbackRunner.run(
			paths,
			async (path) => {
				await this.post(path, request.daysPayload);
			},
			(error) => error.failure.kind === "http" && error.failure.statusCode === 404,
		);
	}

	private async post(path: string, body: Record<string, unknown>): Promise<void> {
		await this.requestOptionalJson({
			operation: FITATU_CLIENT_OPERATIONS.dayPlanSync,
			method: "POST",
			path,
			endpointTemplate: endpointTemplateForPath(path),
			failureMessage: "Fitatu day synchronization request failed",
			invalidResponseMessage: "Fitatu day synchronization response was invalid",
			headers: { accept: this.V3_ACCEPT_HEADER, "content-type": "application/json" },
			body: JSON.stringify(body),
			decoder: decodeSyncResponse,
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

function decodeSyncResponse(data: unknown): null {
	const apiProblem = getApiProblemMessage(data);
	if (apiProblem) {
		throw new FitatuResponseDecodeError(apiProblem);
	}

	return null;
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
