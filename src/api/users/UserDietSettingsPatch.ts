import type { UserDietSettingsApiResponse } from "./UserDietSettingsApiResponse.ts";

export interface ManualEnergyTargetPatchOptions {
	readonly kcal: number;
	readonly proteinPercentage: number;
	readonly proteinWeight: number;
	readonly fatPercentage: number;
	readonly fatWeight: number;
	readonly carbohydratePercentage: number;
	readonly carbohydrateWeight: number;
}

export class UserDietSettingsPatch {
	private readonly current: UserDietSettingsApiResponse;
	private readonly manualEnergyTarget: boolean;
	private readonly manualUpdate?: ManualEnergyTargetPatchOptions;

	private constructor(
		current: UserDietSettingsApiResponse,
		manualEnergyTarget: boolean,
		manualUpdate?: ManualEnergyTargetPatchOptions,
	) {
		this.current = current;
		this.manualEnergyTarget = manualEnergyTarget;
		this.manualUpdate = manualUpdate;
	}

	public static forAutomaticEnergyTarget(current: UserDietSettingsApiResponse): UserDietSettingsPatch {
		return new UserDietSettingsPatch(current, false);
	}

	public static forManualEnergyTarget(
		current: UserDietSettingsApiResponse,
		options: ManualEnergyTargetPatchOptions,
	): UserDietSettingsPatch {
		return new UserDietSettingsPatch(current, true, options);
	}

	public toJSON() {
		if (this.manualUpdate === undefined) {
			return { ...this.current, manualEnergyTarget: this.manualEnergyTarget };
		}

		return {
			...this.current,
			manualEnergyTarget: this.manualEnergyTarget,
			energy: this.manualUpdate.kcal,
			proteinPercentage: this.manualUpdate.proteinPercentage,
			proteinWeight: this.manualUpdate.proteinWeight,
			fatPercentage: this.manualUpdate.fatPercentage,
			fatWeight: this.manualUpdate.fatWeight,
			carbohydratePercentage: this.manualUpdate.carbohydratePercentage,
			carbohydrateWeight: this.manualUpdate.carbohydrateWeight,
		};
	}
}
