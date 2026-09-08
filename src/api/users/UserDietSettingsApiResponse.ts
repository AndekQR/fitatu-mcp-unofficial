import { ObjectUtils } from "../../shared/ObjectUtils.ts";
import { FitatuResponseDecodeError } from "../fitatuApiClientBase/FitatuResponseDecodeError.ts";
import { UserDietSettingsPatch, type ManualEnergyTargetPatchOptions } from "./UserDietSettingsPatch.ts";
import { UserIntermittentFastingConfigApiResponse } from "./UserIntermittentFastingConfigApiResponse.ts";
import { UserMultiDayMealConfigApiResponse } from "./UserMultiDayMealConfigApiResponse.ts";
import { requireFiniteUserSettingsNumber } from "./UserSettingsApiFieldDecoder.ts";

export class UserDietSettingsApiResponse {
	public readonly manualEnergyTarget: boolean;
	public readonly energy: number;
	public readonly proteinPercentage?: number | null;
	public readonly proteinWeight?: number | null;
	public readonly fatPercentage?: number | null;
	public readonly fatWeight?: number | null;
	public readonly carbohydratePercentage?: number | null;
	public readonly carbohydrateWeight?: number | null;
	public readonly activityBase?: number;
	public readonly activityEnergyInclusionMode?: number;
	public readonly activityTraining?: number;
	public readonly defaultActivityTraining?: boolean;
	public readonly excludedProducts?: readonly number[];
	public readonly firstDayDiet?: number;
	public readonly intermittentFastingConfig?: UserIntermittentFastingConfigApiResponse;
	public readonly meatlessFridays?: boolean;
	public readonly multiDayMealConfig?: UserMultiDayMealConfigApiResponse;
	public readonly nutritionSchema?: readonly number[];
	public readonly weightChangeDirection?: number;
	public readonly weightChangeSpeed?: number;
	public readonly weightChangeSpeedKg?: number;
	public readonly weightChangeSpeedUnit?: number;

	private constructor(
		manualEnergyTarget: boolean,
		energy: number,
		proteinPercentage?: number | null,
		proteinWeight?: number | null,
		fatPercentage?: number | null,
		fatWeight?: number | null,
		carbohydratePercentage?: number | null,
		carbohydrateWeight?: number | null,
		activityBase?: number,
		activityEnergyInclusionMode?: number,
		activityTraining?: number,
		defaultActivityTraining?: boolean,
		excludedProducts?: readonly number[],
		firstDayDiet?: number,
		intermittentFastingConfig?: UserIntermittentFastingConfigApiResponse,
		meatlessFridays?: boolean,
		multiDayMealConfig?: UserMultiDayMealConfigApiResponse,
		nutritionSchema?: readonly number[],
		weightChangeDirection?: number,
		weightChangeSpeed?: number,
		weightChangeSpeedKg?: number,
		weightChangeSpeedUnit?: number,
	) {
		this.manualEnergyTarget = manualEnergyTarget;
		this.energy = energy;
		this.proteinPercentage = proteinPercentage;
		this.proteinWeight = proteinWeight;
		this.fatPercentage = fatPercentage;
		this.fatWeight = fatWeight;
		this.carbohydratePercentage = carbohydratePercentage;
		this.carbohydrateWeight = carbohydrateWeight;
		this.activityBase = activityBase;
		this.activityEnergyInclusionMode = activityEnergyInclusionMode;
		this.activityTraining = activityTraining;
		this.defaultActivityTraining = defaultActivityTraining;
		this.excludedProducts = excludedProducts;
		this.firstDayDiet = firstDayDiet;
		this.intermittentFastingConfig = intermittentFastingConfig;
		this.meatlessFridays = meatlessFridays;
		this.multiDayMealConfig = multiDayMealConfig;
		this.nutritionSchema = nutritionSchema;
		this.weightChangeDirection = weightChangeDirection;
		this.weightChangeSpeed = weightChangeSpeed;
		this.weightChangeSpeedKg = weightChangeSpeedKg;
		this.weightChangeSpeedUnit = weightChangeSpeedUnit;
	}

	public static fromApiResponse(data: unknown): UserDietSettingsApiResponse {
		if (!ObjectUtils.isRecord(data)) {
			throw new FitatuResponseDecodeError("Fitatu user diet settings were not a valid JSON object");
		}

		assertCompleteMacronutrientGroup(data.proteinPercentage, data.fatPercentage, data.carbohydratePercentage);
		return new UserDietSettingsApiResponse(
			requireBoolean(data.manualEnergyTarget, "manualEnergyTarget"),
			requireFiniteUserSettingsNumber(data.energy, "user diet settings", "energy"),
			optionalNumberOrNull(data.proteinPercentage, "proteinPercentage"),
			optionalNumberOrNull(data.proteinWeight, "proteinWeight"),
			optionalNumberOrNull(data.fatPercentage, "fatPercentage"),
			optionalNumberOrNull(data.fatWeight, "fatWeight"),
			optionalNumberOrNull(data.carbohydratePercentage, "carbohydratePercentage"),
			optionalNumberOrNull(data.carbohydrateWeight, "carbohydrateWeight"),
			optionalNumber(data.activityBase, "activityBase"),
			optionalNumber(data.activityEnergyInclusionMode, "activityEnergyInclusionMode"),
			optionalNumber(data.activityTraining, "activityTraining"),
			optionalBoolean(data.defaultActivityTraining, "defaultActivityTraining"),
			optionalNumberArray(data.excludedProducts, "excludedProducts"),
			optionalNumber(data.firstDayDiet, "firstDayDiet"),
			UserIntermittentFastingConfigApiResponse.fromApiResponse(data.intermittentFastingConfig),
			optionalBoolean(data.meatlessFridays, "meatlessFridays"),
			UserMultiDayMealConfigApiResponse.fromApiResponse(data.multiDayMealConfig),
			optionalNumberArray(data.nutritionSchema, "nutritionSchema"),
			optionalNumber(data.weightChangeDirection, "weightChangeDirection"),
			optionalNumber(data.weightChangeSpeed, "weightChangeSpeed"),
			optionalNumber(data.weightChangeSpeedKg, "weightChangeSpeedKg"),
			optionalNumber(data.weightChangeSpeedUnit, "weightChangeSpeedUnit"),
		);
	}

	public createAutomaticEnergyTargetPatch(): UserDietSettingsPatch {
		return UserDietSettingsPatch.forAutomaticEnergyTarget(this);
	}

	public createManualEnergyTargetPatch(options: ManualEnergyTargetPatchOptions): UserDietSettingsPatch {
		return UserDietSettingsPatch.forManualEnergyTarget(this, options);
	}
}

function requireBoolean(value: unknown, fieldName: string): boolean {
	if (typeof value !== "boolean") {
		throw new FitatuResponseDecodeError(`Fitatu user diet settings ${fieldName} was not a boolean`);
	}
	return value;
}

function assertCompleteMacronutrientGroup(
	proteinPercentage: unknown,
	fatPercentage: unknown,
	carbohydratePercentage: unknown,
): void {
	const suppliedCount = [proteinPercentage, fatPercentage, carbohydratePercentage].filter(
		(value) => value !== undefined,
	).length;
	if (suppliedCount !== 0 && suppliedCount !== 3) {
		throw new FitatuResponseDecodeError("Fitatu user diet settings macronutrient percentages were incomplete");
	}
}

function optionalNumberOrNull(value: unknown, fieldName: string): number | null | undefined {
	if (value === undefined) {
		return undefined;
	}
	if (value === null) {
		return null;
	}
	return requireFiniteUserSettingsNumber(value, "user diet settings", fieldName);
}

function optionalNumber(value: unknown, fieldName: string): number | undefined {
	return value === undefined ? undefined : requireFiniteUserSettingsNumber(value, "user diet settings", fieldName);
}

function optionalBoolean(value: unknown, fieldName: string): boolean | undefined {
	if (value === undefined) return undefined;
	return requireBoolean(value, fieldName);
}

function optionalNumberArray(value: unknown, fieldName: string): readonly number[] | undefined {
	if (value === undefined) return undefined;
	if (!Array.isArray(value) || !value.every((item) => typeof item === "number" && Number.isFinite(item))) {
		throw new FitatuResponseDecodeError(`Fitatu user diet settings ${fieldName} was not a number array`);
	}
	return value;
}
