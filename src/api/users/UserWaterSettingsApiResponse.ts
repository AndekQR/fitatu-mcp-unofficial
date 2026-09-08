import { ObjectUtils } from "../../shared/ObjectUtils.ts";
import { FitatuResponseDecodeError } from "../fitatuApiClientBase/FitatuResponseDecodeError.ts";

export class UserWaterSettingsApiResponse {
	public readonly unitCapacity: number;

	private constructor(unitCapacity: number) {
		this.unitCapacity = unitCapacity;
	}

	public static fromApiResponse(data: unknown): UserWaterSettingsApiResponse | null {
		if (data === null || data === undefined) {
			return null;
		}
		if (!ObjectUtils.isRecord(data)) {
			throw new FitatuResponseDecodeError("Fitatu water settings were not a valid JSON object");
		}

		const unitCapacity = data.unitCapacity;
		if (typeof unitCapacity !== "number" || !Number.isSafeInteger(unitCapacity) || unitCapacity <= 0) {
			throw new FitatuResponseDecodeError("Fitatu water settings unitCapacity was not a positive integer");
		}
		return new UserWaterSettingsApiResponse(unitCapacity);
	}
}
