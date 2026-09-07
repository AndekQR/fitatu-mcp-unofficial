import { DateUtils } from "../../shared/DateUtils.ts";
import { StringUtils } from "../../shared/StringUtils.ts";
import { ValidationError } from "../../shared/ValidationError.ts";
import { FitatuApiClientBase } from "../fitatuApiClientBase/FitatuApiClientBase.ts";
import type { FitatuApiClientBaseOptions } from "../fitatuApiClientBase/FitatuApiClientBaseOptions.ts";
import { FitatuClientError } from "../fitatuApiClientBase/FitatuClientError.ts";
import { FITATU_CLIENT_OPERATIONS, type FitatuClientOperation } from "../fitatuApiClientBase/FitatuClientOperations.ts";
import type { GetMeasurementRequest } from "./GetMeasurementRequest.ts";
import { MeasurementApiResponse } from "./MeasurementApiResponse.ts";
import type { SaveMeasurementRequest } from "./SaveMeasurementRequest.ts";

const measurementFields = [
	"weight",
	"neck",
	"chest",
	"waist",
	"stomach",
	"hips",
	"thigh",
	"calf",
	"biceps",
	"fatPercentage",
] as const;

export class MeasurementsClient extends FitatuApiClientBase {
	public constructor(options: FitatuApiClientBaseOptions = {}) {
		super(options);
	}

	public async getMeasurement(request: GetMeasurementRequest): Promise<MeasurementApiResponse | null> {
		const { path } = normalizeRequest(request, FITATU_CLIENT_OPERATIONS.measurementsGet);

		try {
			return await this.performCallout({
				operation: FITATU_CLIENT_OPERATIONS.measurementsGet,
				method: "GET",
				path,
				endpointTemplate: "/users/:userId/measurements/:date",
				failureMessage: "Fitatu measurement request failed",
				invalidResponseMessage: "Fitatu measurement response was invalid",
				decoder: MeasurementApiResponse.fromApiResponse,
			});
		} catch (error) {
			if (
				error instanceof FitatuClientError &&
				error.failure.kind === "http" &&
				error.failure.statusCode === 404
			) {
				return null;
			}
			throw error;
		}
	}

	public async saveMeasurement(request: SaveMeasurementRequest): Promise<MeasurementApiResponse> {
		const { path, date } = normalizeRequest(request, FITATU_CLIENT_OPERATIONS.measurementsSave);
		const weightUnit = requireNonEmptyText(
			request.weightUnit,
			"weightUnit is required",
			FITATU_CLIENT_OPERATIONS.measurementsSave,
		);
		const sizeUnit = requireNonEmptyText(
			request.sizeUnit,
			"sizeUnit is required",
			FITATU_CLIENT_OPERATIONS.measurementsSave,
		);
		const body: Record<string, string> = { date, weightUnit, sizeUnit };

		for (const field of measurementFields) {
			const value = request[field];
			if (value === undefined) {
				continue;
			}
			if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
				throw FitatuClientError.invalidRequest({
					operation: FITATU_CLIENT_OPERATIONS.measurementsSave,
					message: `${field} must be a finite number greater than zero`,
				});
			}
			if (field === "fatPercentage" && value > 100) {
				throw FitatuClientError.invalidRequest({
					operation: FITATU_CLIENT_OPERATIONS.measurementsSave,
					message: "fatPercentage must be less than or equal to 100",
				});
			}
			body[field] = String(value);
		}

		if (Object.keys(body).length === 3) {
			throw FitatuClientError.invalidRequest({
				operation: FITATU_CLIENT_OPERATIONS.measurementsSave,
				message: "At least one body measurement value is required",
			});
		}

		return this.performCallout({
			operation: FITATU_CLIENT_OPERATIONS.measurementsSave,
			method: "PUT",
			path,
			endpointTemplate: "/users/:userId/measurements/:date",
			failureMessage: "Fitatu measurement save failed",
			invalidResponseMessage: "Fitatu measurement response was invalid",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(body),
			decoder: MeasurementApiResponse.fromApiResponse,
		});
	}
}

function normalizeRequest(
	request: GetMeasurementRequest | SaveMeasurementRequest,
	operation: FitatuClientOperation,
): { readonly path: string; readonly date: string } {
	const userId = StringUtils.firstNonEmptyString(request.userId);
	if (!userId) {
		throw FitatuClientError.invalidRequest({ operation, message: "Fitatu user id is required" });
	}

	let date: string;
	try {
		date = DateUtils.validateIsoDate(request.date);
	} catch (error) {
		if (!(error instanceof ValidationError)) {
			throw error;
		}
		throw FitatuClientError.invalidRequest({ operation, message: error.message });
	}

	return {
		path: `/users/${encodeURIComponent(userId)}/measurements/${date}`,
		date,
	};
}

function requireNonEmptyText(value: unknown, message: string, operation: FitatuClientOperation): string {
	const normalized = StringUtils.firstNonEmptyString(value);
	if (!normalized) {
		throw FitatuClientError.invalidRequest({ operation, message });
	}
	return normalized;
}
