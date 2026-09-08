import { DateUtils } from "../../shared/DateUtils.ts";
import { StringUtils } from "../../shared/StringUtils.ts";
import { ValidationError } from "../../shared/ValidationError.ts";
import { FitatuApiClientBase } from "../fitatuApiClientBase/FitatuApiClientBase.ts";
import type { FitatuApiClientBaseOptions } from "../fitatuApiClientBase/FitatuApiClientBaseOptions.ts";
import { FitatuClientError } from "../fitatuApiClientBase/FitatuClientError.ts";
import { FITATU_CLIENT_OPERATIONS, type FitatuClientOperation } from "../fitatuApiClientBase/FitatuClientOperations.ts";
import type { GetUserSettingsRequest } from "./GetUserSettingsRequest.ts";
import type { UserDietSettingsPatch } from "./UserDietSettingsPatch.ts";
import { UserSettingsApiResponse } from "./UserSettingsApiResponse.ts";
import type { UpdateUserSettingsRequest } from "./UpdateUserSettingsRequest.ts";

export class UserSettingsClient extends FitatuApiClientBase {
	public constructor(options: FitatuApiClientBaseOptions = {}) {
		super(options);
	}

	public async getSettings(request: GetUserSettingsRequest): Promise<UserSettingsApiResponse> {
		const userId = requireUserId(request.userId);
		const date = requireDate(request.date);

		try {
			return await this.performCallout({
				operation: FITATU_CLIENT_OPERATIONS.userSettingsGet,
				method: "GET",
				path: `/users/${encodeURIComponent(userId)}/settings-new/${date}`,
				endpointTemplate: "/users/:userId/settings-new/:date",
				failureMessage: "Fitatu user settings request failed",
				invalidResponseMessage: "Fitatu user settings response was invalid",
				decoder: UserSettingsApiResponse.fromApiResponse,
			});
		} catch (error) {
			throwMappedSettingsError(error);
		}
	}

	public async updateSettings(request: UpdateUserSettingsRequest): Promise<UserSettingsApiResponse> {
		const userId = requireUserId(request.userId, FITATU_CLIENT_OPERATIONS.userSettingsUpdate);
		let waterSettings: UserSettingsWaterPatch | undefined;
		if (request.waterServingSizeMl !== undefined) {
			if (!Number.isSafeInteger(request.waterServingSizeMl) || request.waterServingSizeMl <= 0) {
				throw FitatuClientError.invalidRequest({
					operation: FITATU_CLIENT_OPERATIONS.userSettingsUpdate,
					message: "waterServingSizeMl must be a positive integer",
				});
			}
			waterSettings = { unitCapacity: request.waterServingSizeMl };
		}
		const body: UserSettingsPatchBody = {
			userId,
			updatedAt: null,
			userDietSettings: request.userDietSettings,
			waterSettings,
		};
		if (request.userDietSettings === undefined && request.waterServingSizeMl === undefined) {
			throw FitatuClientError.invalidRequest({
				operation: FITATU_CLIENT_OPERATIONS.userSettingsUpdate,
				message: "At least one user setting is required",
			});
		}

		try {
			return await this.performCallout({
				operation: FITATU_CLIENT_OPERATIONS.userSettingsUpdate,
				method: "PATCH",
				path: `/users/${encodeURIComponent(userId)}/settings-new`,
				endpointTemplate: "/users/:userId/settings-new",
				failureMessage: "Fitatu user settings update failed",
				invalidResponseMessage: "Fitatu user settings update response was invalid",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(body),
				decoder: UserSettingsApiResponse.fromApiResponse,
			});
		} catch (error) {
			throwMappedSettingsError(error);
		}
	}
}

interface UserSettingsWaterPatch {
	readonly unitCapacity: number;
}

interface UserSettingsPatchBody {
	readonly userId: string;
	readonly updatedAt: null;
	readonly userDietSettings?: UserDietSettingsPatch;
	readonly waterSettings?: UserSettingsWaterPatch;
}

function throwMappedSettingsError(error: unknown): never {
	if (error instanceof FitatuClientError && error.failure.kind === "http" && error.failure.statusCode === 405) {
		throw error.withAttempts(error.attempts, "Fitatu user settings are not supported for this account");
	}
	throw error;
}

function requireUserId(
	value: unknown,
	operation: FitatuClientOperation = FITATU_CLIENT_OPERATIONS.userSettingsGet,
): string {
	const userId = StringUtils.firstNonEmptyString(value);
	if (!userId) {
		throw FitatuClientError.invalidRequest({
			operation,
			message: "Fitatu user id is required",
		});
	}
	return userId;
}

function requireDate(value: unknown): string {
	try {
		return DateUtils.validateIsoDate(value);
	} catch (error) {
		if (!(error instanceof ValidationError)) throw error;
		throw FitatuClientError.invalidRequest({
			operation: FITATU_CLIENT_OPERATIONS.userSettingsGet,
			message: error.message,
		});
	}
}
