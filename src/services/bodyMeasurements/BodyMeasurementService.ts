import { MeasurementsClient } from "../../api/users/MeasurementsClient.ts";
import { MEASUREMENT_SIZE_FIELDS } from "../../api/users/MeasurementSizeField.ts";
import { FitatuUserClient } from "../../api/users/FitatuUserClient.ts";
import { DateUtils } from "../../shared/DateUtils.ts";
import { StringUtils } from "../../shared/StringUtils.ts";
import { ServiceError } from "../ServiceError.ts";
import { SERVICE_ERROR_CODES } from "../ServiceErrorCode.ts";
import { BodyMeasurement } from "./BodyMeasurement.ts";
import { BodyMeasurementUpdate } from "./BodyMeasurementUpdate.ts";

export class BodyMeasurementService {
	private readonly measurementsClient: MeasurementsClient;
	private readonly userClient: FitatuUserClient;

	public constructor(measurementsClient: MeasurementsClient, userClient: FitatuUserClient) {
		this.measurementsClient = measurementsClient;
		this.userClient = userClient;
	}

	public async getBodyMeasurement(date?: string): Promise<BodyMeasurement | null> {
		const userId = await this.getAuthenticatedUserId();
		if (date !== undefined) {
			return this.getBodyMeasurementForDate(userId, DateUtils.validateIsoDate(date));
		}

		const histories = await Promise.all([
			this.measurementsClient.getWeightMeasurementHistory(userId),
			...MEASUREMENT_SIZE_FIELDS.map((field) => this.measurementsClient.getSizeMeasurementHistory(userId, field)),
		]);
		const dates = [...new Set(histories.flatMap((history) => history.dates))].sort().reverse();
		for (const latestDate of dates) {
			const measurement = await this.getBodyMeasurementForDate(userId, latestDate);
			if (measurement !== null) return measurement;
		}
		return null;
	}

	public async saveBodyMeasurement(update: BodyMeasurementUpdate): Promise<BodyMeasurement> {
		const user = await this.userClient.getAuthenticatedUser();
		const userId = requireUserId(user.id);
		const weightUnit = StringUtils.firstNonEmptyString(user.weightUnit);
		const sizeUnit = StringUtils.firstNonEmptyString(user.sizeUnit);
		if (!weightUnit || !sizeUnit) {
			throw new ServiceError(
				"Configure weight and size units in Fitatu before saving body measurements.",
				"conflict",
				SERVICE_ERROR_CODES.bodyMeasurementUnitsUnavailable,
			);
		}

		const response = await this.measurementsClient.saveMeasurement({
			userId,
			date: update.date,
			weightUnit,
			sizeUnit,
			...(update.weight === undefined ? {} : { weight: update.weight }),
			...(update.neck === undefined ? {} : { neck: update.neck }),
			...(update.chest === undefined ? {} : { chest: update.chest }),
			...(update.waist === undefined ? {} : { waist: update.waist }),
			...(update.stomach === undefined ? {} : { stomach: update.stomach }),
			...(update.hips === undefined ? {} : { hips: update.hips }),
			...(update.thigh === undefined ? {} : { thigh: update.thigh }),
			...(update.calf === undefined ? {} : { calf: update.calf }),
			...(update.biceps === undefined ? {} : { biceps: update.biceps }),
			...(update.fatPercentage === undefined ? {} : { fatPercentage: update.fatPercentage }),
		});
		return new BodyMeasurement(update.date, response);
	}

	private async getAuthenticatedUserId(): Promise<string> {
		const user = await this.userClient.getAuthenticatedUser();
		return requireUserId(user.id);
	}

	private async getBodyMeasurementForDate(userId: string, date: string): Promise<BodyMeasurement | null> {
		const response = await this.measurementsClient.getMeasurement({ userId, date });
		return response === null ? null : new BodyMeasurement(date, response);
	}
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
