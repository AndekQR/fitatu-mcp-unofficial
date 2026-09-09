import { GetUserSettingsRequest } from "../../api/users/GetUserSettingsRequest.ts";
import { FitatuUserClient } from "../../api/users/FitatuUserClient.ts";
import type { FitatuUserProfile } from "../../api/users/FitatuUserProfile.ts";
import type { UserSettingsApiResponse } from "../../api/users/UserSettingsApiResponse.ts";
import { UserSettingsClient } from "../../api/users/UserSettingsClient.ts";
import type { UserDietSettingsPatch } from "../../api/users/UserDietSettingsPatch.ts";
import { UpdateUserSettingsRequest } from "../../api/users/UpdateUserSettingsRequest.ts";
import { DateUtils } from "../../shared/DateUtils.ts";
import { StringUtils } from "../../shared/StringUtils.ts";
import { ValidationError } from "../../shared/ValidationError.ts";
import { ServiceError } from "../ServiceError.ts";
import { SERVICE_ERROR_CODES } from "../ServiceErrorCode.ts";
import { AutomaticEnergyTarget } from "./AutomaticEnergyTarget.ts";
import { ManualEnergyTargetUpdate } from "./ManualEnergyTargetUpdate.ts";
import { MacronutrientDistribution } from "./MacronutrientDistribution.ts";
import { ManualEnergyTarget } from "./ManualEnergyTarget.ts";
import { UserSettingsCalculatedValues } from "./UserSettingsCalculatedValues.ts";
import { UserSettingsSnapshot } from "./UserSettingsSnapshot.ts";
import type { UserSettingsUpdate } from "./UserSettingsUpdate.ts";

export class UserSettingsService {
	private readonly settingsClient: UserSettingsClient;
	private readonly userClient: FitatuUserClient;
	private readonly now: () => Date;

	public constructor(
		settingsClient: UserSettingsClient,
		userClient: FitatuUserClient,
		now: () => Date = () => new Date(),
	) {
		this.settingsClient = settingsClient;
		this.userClient = userClient;
		this.now = now;
	}

	public async getUserSettings(date?: string): Promise<UserSettingsSnapshot> {
		const user = await this.userClient.getAuthenticatedUser();
		const userId = requireUserId(user.id);
		const resolvedDate = date === undefined ? todayInUserTimezone(this.now(), user) : normalizeDate(date);
		const response = await this.settingsClient.getSettings(new GetUserSettingsRequest(userId, resolvedDate));
		return toUserSettingsSnapshot(response, resolvedDate);
	}

	public async updateUserSettings(update: UserSettingsUpdate): Promise<UserSettingsSnapshot> {
		const user = await this.userClient.getAuthenticatedUser();
		const userId = requireUserId(user.id);
		let userDietSettings: UserDietSettingsPatch | undefined;

		if (update.energyTarget !== undefined) {
			const date = todayInUserTimezone(this.now(), user);
			const current = await this.settingsClient.getSettings(new GetUserSettingsRequest(userId, date));
			userDietSettings = applyEnergyTarget(current, update.energyTarget);
		}

		const response = await this.settingsClient.updateSettings(
			new UpdateUserSettingsRequest(userId, userDietSettings, update.waterServingSizeMl),
		);
		return toUserSettingsSnapshot(response);
	}
}

function applyEnergyTarget(
	current: UserSettingsApiResponse,
	update: NonNullable<UserSettingsUpdate["energyTarget"]>,
): UserDietSettingsPatch {
	if (!(update instanceof ManualEnergyTargetUpdate)) {
		return current.userDietSettings.createAutomaticEnergyTargetPatch();
	}

	return current.userDietSettings.createManualEnergyTargetPatch({
		kcal: update.kcal,
		proteinPercentage: update.proteinPercentage,
		proteinWeight: Math.round((update.kcal * update.proteinPercentage) / 100 / 4),
		fatPercentage: update.fatPercentage,
		fatWeight: Math.round((update.kcal * update.fatPercentage) / 100 / 9),
		carbohydratePercentage: update.carbohydratePercentage,
		carbohydrateWeight: Math.round((update.kcal * update.carbohydratePercentage) / 100 / 4),
	});
}

function toUserSettingsSnapshot(
	response: UserSettingsApiResponse,
	requestedDate: string = response.date.slice(0, 10),
): UserSettingsSnapshot {
	const diet = response.userDietSettings;
	const calculated = response.calculatedValues;
	return new UserSettingsSnapshot(
		requestedDate,
		response.date.slice(0, 10),
		diet.manualEnergyTarget
			? new ManualEnergyTarget(diet.energy, toMacronutrientDistribution(response))
			: new AutomaticEnergyTarget(diet.energy, toMacronutrientDistribution(response)),
		calculated === null
			? undefined
			: new UserSettingsCalculatedValues(
					calculated.bmr,
					calculated.tmr,
					calculated.pal,
					calculated.calculatedEnergy,
					calculated.deficit,
					calculated.activityEnergy,
				),
		response.waterSettings?.unitCapacity,
	);
}

function toMacronutrientDistribution(response: UserSettingsApiResponse): MacronutrientDistribution | undefined {
	const diet = response.userDietSettings;
	if (
		diet.proteinPercentage === undefined &&
		diet.fatPercentage === undefined &&
		diet.carbohydratePercentage === undefined
	) {
		return undefined;
	}

	return new MacronutrientDistribution(
		diet.proteinPercentage ?? null,
		diet.fatPercentage ?? null,
		diet.carbohydratePercentage ?? null,
	);
}

function requireUserId(value: unknown): string {
	const userId = StringUtils.firstNonEmptyString(value);
	if (!userId) {
		throw new ServiceError(
			"Fitatu user id is required",
			"authenticationRequired",
			SERVICE_ERROR_CODES.authenticationRequired,
		);
	}
	return userId;
}

function normalizeDate(value: unknown): string {
	try {
		return DateUtils.validateIsoDate(value);
	} catch (error) {
		if (!(error instanceof ValidationError)) throw error;
		throw new ServiceError(error.message, "invalidInput", SERVICE_ERROR_CODES.invalidDateRange);
	}
}

function todayInUserTimezone(now: Date, user: FitatuUserProfile): string {
	const timezone = StringUtils.firstNonEmptyString(user.timezone);
	if (!timezone) {
		throw new ServiceError(
			"Configure a timezone in Fitatu before requesting settings without a date.",
			"conflict",
			SERVICE_ERROR_CODES.userTimezoneUnavailable,
		);
	}

	try {
		const parts = new Intl.DateTimeFormat("en", {
			timeZone: timezone,
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
		}).formatToParts(now);
		const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
		return `${values.year}-${values.month}-${values.day}`;
	} catch (error) {
		if (!(error instanceof RangeError)) throw error;
		throw new ServiceError(
			"The timezone configured in Fitatu is invalid.",
			"conflict",
			SERVICE_ERROR_CODES.userTimezoneUnavailable,
		);
	}
}
