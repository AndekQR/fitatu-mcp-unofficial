import { ServiceError } from "../ServiceError.ts";
import { SERVICE_ERROR_CODES } from "../ServiceErrorCode.ts";
import type { AutomaticEnergyTargetUpdate } from "./AutomaticEnergyTargetUpdate.ts";
import type { ManualEnergyTargetUpdate } from "./ManualEnergyTargetUpdate.ts";

export type EnergyTargetUpdate = AutomaticEnergyTargetUpdate | ManualEnergyTargetUpdate;

export class UserSettingsUpdate {
	public readonly energyTarget?: EnergyTargetUpdate;
	public readonly waterServingSizeMl?: number;

	public constructor(energyTarget?: EnergyTargetUpdate, waterServingSizeMl?: number) {
		if (energyTarget === undefined && waterServingSizeMl === undefined) {
			throw new ServiceError(
				"At least one user setting is required",
				"invalidInput",
				SERVICE_ERROR_CODES.userSettingsValueRequired,
			);
		}
		if (
			waterServingSizeMl !== undefined &&
			(!Number.isSafeInteger(waterServingSizeMl) || waterServingSizeMl <= 0)
		) {
			throw new ServiceError(
				"waterServingSizeMl must be a positive integer",
				"invalidInput",
				SERVICE_ERROR_CODES.invalidUserSettingsValue,
			);
		}

		this.energyTarget = energyTarget;
		this.waterServingSizeMl = waterServingSizeMl;
	}
}
