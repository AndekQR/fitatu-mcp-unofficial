import type { EnergyTarget } from "./EnergyTarget.ts";
import type { UserSettingsCalculatedValues } from "./UserSettingsCalculatedValues.ts";

export class UserSettingsSnapshot {
	public readonly date: string;
	public readonly energyTarget: EnergyTarget;
	public readonly calculatedValues?: UserSettingsCalculatedValues;
	public readonly waterServingSizeMl?: number;

	public constructor(
		date: string,
		energyTarget: EnergyTarget,
		calculatedValues?: UserSettingsCalculatedValues,
		waterServingSizeMl?: number,
	) {
		this.date = date;
		this.energyTarget = energyTarget;
		this.calculatedValues = calculatedValues;
		this.waterServingSizeMl = waterServingSizeMl;
	}
}
