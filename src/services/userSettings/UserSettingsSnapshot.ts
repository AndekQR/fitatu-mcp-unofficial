import type { EnergyTarget } from "./EnergyTarget.ts";
import type { UserSettingsCalculatedValues } from "./UserSettingsCalculatedValues.ts";

export class UserSettingsSnapshot {
	public readonly requestedDate: string;
	public readonly effectiveDate: string;
	public readonly energyTarget: EnergyTarget;
	public readonly calculatedValues?: UserSettingsCalculatedValues;
	public readonly waterServingSizeMl?: number;

	public constructor(
		requestedDate: string,
		effectiveDate: string,
		energyTarget: EnergyTarget,
		calculatedValues?: UserSettingsCalculatedValues,
		waterServingSizeMl?: number,
	) {
		this.requestedDate = requestedDate;
		this.effectiveDate = effectiveDate;
		this.energyTarget = energyTarget;
		this.calculatedValues = calculatedValues;
		this.waterServingSizeMl = waterServingSizeMl;
	}
}
