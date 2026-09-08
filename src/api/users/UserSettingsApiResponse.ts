import { DateUtils } from "../../shared/DateUtils.ts";
import { ObjectUtils } from "../../shared/ObjectUtils.ts";
import { StringUtils } from "../../shared/StringUtils.ts";
import { ValidationError } from "../../shared/ValidationError.ts";
import { FitatuResponseDecodeError } from "../fitatuApiClientBase/FitatuResponseDecodeError.ts";
import { UserCalculatedValuesApiResponse } from "./UserCalculatedValuesApiResponse.ts";
import { UserDietSettingsApiResponse } from "./UserDietSettingsApiResponse.ts";
import { UserWaterSettingsApiResponse } from "./UserWaterSettingsApiResponse.ts";

export class UserSettingsApiResponse {
	public readonly date: string;
	public readonly userDietSettings: UserDietSettingsApiResponse;
	public readonly calculatedValues: UserCalculatedValuesApiResponse | null;
	public readonly waterSettings: UserWaterSettingsApiResponse | null;

	private constructor(
		date: string,
		userDietSettings: UserDietSettingsApiResponse,
		calculatedValues: UserCalculatedValuesApiResponse | null,
		waterSettings: UserWaterSettingsApiResponse | null,
	) {
		this.date = date;
		this.userDietSettings = userDietSettings;
		this.calculatedValues = calculatedValues;
		this.waterSettings = waterSettings;
	}

	public static fromApiResponse(data: unknown): UserSettingsApiResponse {
		if (!ObjectUtils.isRecord(data)) {
			throw new FitatuResponseDecodeError("Fitatu user settings response was not a valid JSON object");
		}

		return new UserSettingsApiResponse(
			requireResponseDate(data.date),
			UserDietSettingsApiResponse.fromApiResponse(data.userDietSettings),
			UserCalculatedValuesApiResponse.fromApiResponse(data.calculatedValues),
			UserWaterSettingsApiResponse.fromApiResponse(data.waterSettings),
		);
	}
}

function requireResponseDate(value: unknown): string {
	const dateTime = StringUtils.firstNonEmptyString(value);
	if (!dateTime || Number.isNaN(Date.parse(dateTime))) {
		throw new FitatuResponseDecodeError("Fitatu user settings date was not a valid date-time");
	}

	try {
		DateUtils.validateIsoDate(dateTime.slice(0, 10));
	} catch (error) {
		if (!(error instanceof ValidationError)) throw error;
		throw new FitatuResponseDecodeError("Fitatu user settings date was not a valid date-time");
	}

	return dateTime;
}
