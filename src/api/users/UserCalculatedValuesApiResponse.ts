import { ObjectUtils } from "../../shared/ObjectUtils.ts";
import { FitatuResponseDecodeError } from "../fitatuApiClientBase/FitatuResponseDecodeError.ts";
import { requireFiniteUserSettingsNumber } from "./UserSettingsApiFieldDecoder.ts";

export class UserCalculatedValuesApiResponse {
	public readonly bmr: number;
	public readonly tmr: number;
	public readonly pal: number;
	public readonly calculatedEnergy: number;
	public readonly deficit: number;
	public readonly activityEnergy: number;

	private constructor(
		bmr: number,
		tmr: number,
		pal: number,
		calculatedEnergy: number,
		deficit: number,
		activityEnergy: number,
	) {
		this.bmr = bmr;
		this.tmr = tmr;
		this.pal = pal;
		this.calculatedEnergy = calculatedEnergy;
		this.deficit = deficit;
		this.activityEnergy = activityEnergy;
	}

	public static fromApiResponse(data: unknown): UserCalculatedValuesApiResponse | null {
		if (data === null || data === undefined) {
			return null;
		}
		if (!ObjectUtils.isRecord(data)) {
			throw new FitatuResponseDecodeError("Fitatu calculated user settings were not a valid JSON object");
		}

		return new UserCalculatedValuesApiResponse(
			requireFiniteUserSettingsNumber(data.BMR, "calculated user settings", "BMR"),
			requireFiniteUserSettingsNumber(data.TMR, "calculated user settings", "TMR"),
			requireFiniteUserSettingsNumber(data.PAL, "calculated user settings", "PAL"),
			requireFiniteUserSettingsNumber(data.calculatedEnergy, "calculated user settings", "calculatedEnergy"),
			requireFiniteUserSettingsNumber(data.deficit, "calculated user settings", "deficit"),
			requireFiniteUserSettingsNumber(data.activityEnergy, "calculated user settings", "activityEnergy"),
		);
	}
}
