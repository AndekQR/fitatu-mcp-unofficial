import { describe, expect, it } from "vitest";
import type { GetMeasurementRequest } from "../../../../src/api/users/GetMeasurementRequest.ts";
import { MeasurementApiResponse } from "../../../../src/api/users/MeasurementApiResponse.ts";
import { MeasurementsClient } from "../../../../src/api/users/MeasurementsClient.ts";
import type { SaveMeasurementRequest } from "../../../../src/api/users/SaveMeasurementRequest.ts";
import { FitatuUserClient } from "../../../../src/api/users/FitatuUserClient.ts";
import { FitatuUserProfile } from "../../../../src/api/users/FitatuUserProfile.ts";
import { BodyMeasurementService } from "../../../../src/services/bodyMeasurements/BodyMeasurementService.ts";
import { BodyMeasurementUpdate } from "../../../../src/services/bodyMeasurements/BodyMeasurementUpdate.ts";

describe("BodyMeasurementService", () => {
	it("loads the authenticated user's measurement and normalizes values to two decimals", async () => {
		const measurementsClient = new FakeMeasurementsClient(
			MeasurementApiResponse.fromApiResponse({
				...completeMeasurementResponse(),
				weight: 78.126,
				waist: 85.999999,
			}),
		);
		const userClient = new FakeFitatuUserClient(
			FitatuUserProfile.fromApiResponse({ id: " user-1 ", weightUnit: "KG", sizeUnit: "CM" }),
		);
		const service = new BodyMeasurementService(measurementsClient, userClient);

		const result = await service.getBodyMeasurement("2026-09-06");

		expect(measurementsClient.getRequests).toEqual([{ userId: "user-1", date: "2026-09-06" }]);
		expect(result).toMatchObject({ date: "2026-09-06", weight: 78.13, waist: 86 });
		expect(result?.neck).toBeNull();
	});

	it("returns null when the authenticated user has no measurement for the date", async () => {
		const measurementsClient = new FakeMeasurementsClient(null);
		const userClient = new FakeFitatuUserClient(FitatuUserProfile.fromApiResponse({ id: "user-1" }));
		const service = new BodyMeasurementService(measurementsClient, userClient);

		await expect(service.getBodyMeasurement("2026-09-06")).resolves.toBeNull();
		expect(measurementsClient.getRequests).toEqual([{ userId: "user-1", date: "2026-09-06" }]);
	});

	it("saves a non-empty partial update with profile units and no pre-read", async () => {
		const measurementsClient = new FakeMeasurementsClient(
			MeasurementApiResponse.fromApiResponse(completeMeasurementResponse()),
		);
		const userClient = new FakeFitatuUserClient(
			FitatuUserProfile.fromApiResponse({ id: "user-1", weightUnit: " KG ", sizeUnit: " CM " }),
		);
		const service = new BodyMeasurementService(measurementsClient, userClient);

		const result = await service.saveBodyMeasurement(
			new BodyMeasurementUpdate("2026-09-06", 78.126, undefined, undefined, 85.999),
		);

		expect(measurementsClient.getRequests).toHaveLength(0);
		expect(measurementsClient.saveRequests).toEqual([
			{
				userId: "user-1",
				date: "2026-09-06",
				weightUnit: "KG",
				sizeUnit: "CM",
				weight: 78.13,
				waist: 86,
			},
		]);
		expect(result).toMatchObject({ date: "2026-09-06", weight: 78, waist: 86 });
	});

	it.each([
		{ weightUnit: undefined, sizeUnit: "CM" },
		{ weightUnit: "KG", sizeUnit: null },
		{ weightUnit: null, sizeUnit: null },
	])("rejects saving when profile units are unavailable", async ({ weightUnit, sizeUnit }) => {
		const measurementsClient = new FakeMeasurementsClient(
			MeasurementApiResponse.fromApiResponse(completeMeasurementResponse()),
		);
		const userClient = new FakeFitatuUserClient(
			FitatuUserProfile.fromApiResponse({ id: "user-1", weightUnit, sizeUnit }),
		);
		const service = new BodyMeasurementService(measurementsClient, userClient);

		await expect(service.saveBodyMeasurement(new BodyMeasurementUpdate("2026-09-06", 78))).rejects.toMatchObject({
			name: "ServiceError",
			kind: "conflict",
			code: "BODY_MEASUREMENT_UNITS_UNAVAILABLE",
		});
		expect(measurementsClient.saveRequests).toHaveLength(0);
	});

	it("rejects a missing authenticated user id before requesting measurements", async () => {
		const measurementsClient = new FakeMeasurementsClient(null);
		const userClient = new FakeFitatuUserClient(
			FitatuUserProfile.fromApiResponse({ weightUnit: "KG", sizeUnit: "CM" }),
		);
		const service = new BodyMeasurementService(measurementsClient, userClient);

		await expect(service.getBodyMeasurement("2026-09-06")).rejects.toMatchObject({
			name: "ServiceError",
			kind: "authenticationRequired",
			code: "AUTHENTICATION_REQUIRED",
		});
		expect(measurementsClient.getRequests).toHaveLength(0);
	});

	it("enforces the partial update invariant outside the MCP boundary", () => {
		expect(() => new BodyMeasurementUpdate("2026-09-06")).toThrowError(
			expect.objectContaining({ code: "BODY_MEASUREMENT_VALUE_REQUIRED" }),
		);
		expect(() => new BodyMeasurementUpdate("2026-09-06", 0)).toThrowError(
			expect.objectContaining({ code: "INVALID_BODY_MEASUREMENT_VALUE" }),
		);
		expect(
			() =>
				new BodyMeasurementUpdate(
					"2026-09-06",
					undefined,
					undefined,
					undefined,
					undefined,
					undefined,
					undefined,
					undefined,
					undefined,
					undefined,
					101,
				),
		).toThrowError(expect.objectContaining({ code: "INVALID_BODY_MEASUREMENT_VALUE" }));
	});
});

class FakeMeasurementsClient extends MeasurementsClient {
	public readonly getRequests: GetMeasurementRequest[] = [];
	public readonly saveRequests: SaveMeasurementRequest[] = [];

	public constructor(private readonly response: MeasurementApiResponse | null) {
		super({ fetchFn: unusedFetch });
	}

	public override async getMeasurement(request: GetMeasurementRequest): Promise<MeasurementApiResponse | null> {
		this.getRequests.push(request);
		return this.response;
	}

	public override async saveMeasurement(request: SaveMeasurementRequest): Promise<MeasurementApiResponse> {
		this.saveRequests.push(request);
		if (!this.response) throw new Error("FakeMeasurementsClient requires a response");
		return this.response;
	}
}

class FakeFitatuUserClient extends FitatuUserClient {
	public requestCount = 0;

	public constructor(private readonly profile: FitatuUserProfile) {
		super({
			fetchFn: unusedFetch,
			authClient: {
				getSession: async () => ({ token: "test-token", fitatuUserId: "test-user" }),
				refreshSession: async () => ({ token: "test-token", fitatuUserId: "test-user" }),
			},
		});
	}

	public override async getAuthenticatedUser(): Promise<FitatuUserProfile> {
		this.requestCount += 1;
		return this.profile;
	}
}

const unusedFetch: typeof fetch = async () => {
	throw new Error("Unexpected HTTP request from test fake");
};

function completeMeasurementResponse() {
	return {
		weight: 78,
		neck: null,
		chest: null,
		waist: 86,
		stomach: null,
		hips: null,
		thigh: null,
		calf: null,
		biceps: null,
		fatPercentage: null,
		weightUnit: "KG",
		sizeUnit: "CM",
	};
}
