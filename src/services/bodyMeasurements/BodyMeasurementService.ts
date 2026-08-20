import type { BodyMeasurement } from "../../api/bodyMeasurements/BodyMeasurement.ts";
import type { GetBodyMeasurementRequest } from "../../api/bodyMeasurements/GetBodyMeasurementRequest.ts";
import type { SaveBodyMeasurementRequest } from "../../api/bodyMeasurements/SaveBodyMeasurementRequest.ts";
import type { FitatuUserProfile } from "../../api/users/FitatuUserProfile.ts";
import { StringUtils } from "../../shared/StringUtils.ts";
import { ServiceError } from "../ServiceError.ts";
import { SERVICE_ERROR_CODES } from "../ServiceErrorCode.ts";
import type { SaveBodyMeasurementInput } from "./SaveBodyMeasurementInput.ts";

const DEFAULT_WEIGHT_UNIT = "KG";
const DEFAULT_SIZE_UNIT = "CM";

interface BodyMeasurementApiClient {
	findMeasurement(request: GetBodyMeasurementRequest): Promise<BodyMeasurement | null>;
	saveMeasurement(request: SaveBodyMeasurementRequest): Promise<BodyMeasurement>;
}

interface AuthenticatedUserProvider {
	getAuthenticatedUser(): Promise<FitatuUserProfile>;
}

export interface BodyMeasurementProvider {
	getMeasurement(date: string): Promise<BodyMeasurement | null>;
	saveMeasurement(input: SaveBodyMeasurementInput): Promise<BodyMeasurement>;
}

/**
 * Reads and writes body measurements for the authenticated user.
 *
 * Units are taken from the Fitatu profile so a saved value is interpreted the
 * same way the mobile app would interpret it.
 */
export class BodyMeasurementService implements BodyMeasurementProvider {
	private readonly bodyMeasurementClient: BodyMeasurementApiClient;
	private readonly userClient: AuthenticatedUserProvider;

	public constructor(bodyMeasurementClient: BodyMeasurementApiClient, userClient: AuthenticatedUserProvider) {
		this.bodyMeasurementClient = bodyMeasurementClient;
		this.userClient = userClient;
	}

	public async getMeasurement(date: string): Promise<BodyMeasurement | null> {
		const user = await this.userClient.getAuthenticatedUser();

		return this.bodyMeasurementClient.findMeasurement({ userId: this.requireUserId(user), date });
	}

	public async saveMeasurement(input: SaveBodyMeasurementInput): Promise<BodyMeasurement> {
		const user = await this.userClient.getAuthenticatedUser();

		return this.bodyMeasurementClient.saveMeasurement({
			userId: this.requireUserId(user),
			date: input.date,
			weightUnit: StringUtils.firstNonEmptyString(user.weightUnit) ?? DEFAULT_WEIGHT_UNIT,
			sizeUnit: StringUtils.firstNonEmptyString(user.sizeUnit) ?? DEFAULT_SIZE_UNIT,
			values: input.values,
		});
	}

	private requireUserId(user: FitatuUserProfile): string {
		const userId = StringUtils.firstNonEmptyString(user.id);
		if (!userId) {
			throw new ServiceError(
				"Authenticated Fitatu user id is required",
				"authenticationRequired",
				SERVICE_ERROR_CODES.authenticationRequired,
			);
		}

		return userId;
	}
}
