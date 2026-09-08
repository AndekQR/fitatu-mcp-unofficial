import { ServiceError } from "../ServiceError.ts";
import { SERVICE_ERROR_CODES } from "../ServiceErrorCode.ts";

export class ManualEnergyTargetUpdate {
	public readonly mode = "manual" as const;
	public readonly kcal: number;
	public readonly proteinPercentage: number;
	public readonly fatPercentage: number;
	public readonly carbohydratePercentage: number;

	public constructor(kcal: number, proteinPercentage: number, fatPercentage: number, carbohydratePercentage: number) {
		requirePositiveInteger(kcal, "kcal");
		requirePercentage(proteinPercentage, "proteinPercentage");
		requirePercentage(fatPercentage, "fatPercentage");
		requirePercentage(carbohydratePercentage, "carbohydratePercentage");
		if (proteinPercentage + fatPercentage + carbohydratePercentage !== 100) {
			throw invalidEnergyTarget("Macronutrient percentages must total exactly 100");
		}

		this.kcal = kcal;
		this.proteinPercentage = proteinPercentage;
		this.fatPercentage = fatPercentage;
		this.carbohydratePercentage = carbohydratePercentage;
	}
}

function requirePositiveInteger(value: number, fieldName: string): void {
	if (!Number.isSafeInteger(value) || value <= 0) {
		throw invalidEnergyTarget(`${fieldName} must be a positive integer`);
	}
}

function requirePercentage(value: number, fieldName: string): void {
	if (!Number.isSafeInteger(value) || value < 0 || value > 100) {
		throw invalidEnergyTarget(`${fieldName} must be an integer between 0 and 100`);
	}
}

function invalidEnergyTarget(message: string): ServiceError {
	return new ServiceError(message, "invalidInput", SERVICE_ERROR_CODES.invalidEnergyTarget);
}
