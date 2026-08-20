import { describe, expect, it } from "vitest";
import { BodyMeasurement } from "../../../../src/api/bodyMeasurements/BodyMeasurement.ts";
import type { GetBodyMeasurementRequest } from "../../../../src/api/bodyMeasurements/GetBodyMeasurementRequest.ts";
import type { SaveBodyMeasurementRequest } from "../../../../src/api/bodyMeasurements/SaveBodyMeasurementRequest.ts";
import { FitatuUserProfile } from "../../../../src/api/users/FitatuUserProfile.ts";
import { BodyMeasurementService } from "../../../../src/services/bodyMeasurements/BodyMeasurementService.ts";
import { SaveBodyMeasurementInput } from "../../../../src/services/bodyMeasurements/SaveBodyMeasurementInput.ts";

const persistedMeasurement = BodyMeasurement.fromApiResponse("2026-08-20", {
	weight: 84.6,
	weightUnit: "KG",
	sizeUnit: "CM",
});

class FakeBodyMeasurementClient {
	public readonly getRequests: GetBodyMeasurementRequest[] = [];
	public readonly saveRequests: SaveBodyMeasurementRequest[] = [];

	public async findMeasurement(request: GetBodyMeasurementRequest): Promise<BodyMeasurement | null> {
		this.getRequests.push(request);
		return persistedMeasurement;
	}

	public async saveMeasurement(request: SaveBodyMeasurementRequest): Promise<BodyMeasurement> {
		this.saveRequests.push(request);
		return persistedMeasurement;
	}
}

function createUserClient(profile: Record<string, unknown>) {
	return {
		getAuthenticatedUser: async () => FitatuUserProfile.fromApiResponse(profile),
	};
}

describe("BodyMeasurementService", () => {
	it("reads a measurement for the authenticated user", async () => {
		const client = new FakeBodyMeasurementClient();
		const service = new BodyMeasurementService(client, createUserClient({ id: "user-1" }));

		await service.getMeasurement("2026-08-20");

		expect(client.getRequests).toEqual([{ userId: "user-1", date: "2026-08-20" }]);
	});

	it("saves with the units configured on the Fitatu profile", async () => {
		const client = new FakeBodyMeasurementClient();
		const service = new BodyMeasurementService(
			client,
			createUserClient({ id: "user-1", weightUnit: "LB", sizeUnit: "IN" }),
		);

		await service.saveMeasurement(new SaveBodyMeasurementInput("2026-08-20", { weight: 186.5 }));

		expect(client.saveRequests).toEqual([
			{
				userId: "user-1",
				date: "2026-08-20",
				weightUnit: "LB",
				sizeUnit: "IN",
				values: { weight: 186.5 },
			},
		]);
	});

	it("falls back to metric units when the profile does not declare them", async () => {
		const client = new FakeBodyMeasurementClient();
		const service = new BodyMeasurementService(client, createUserClient({ id: "user-1" }));

		await service.saveMeasurement(new SaveBodyMeasurementInput("2026-08-20", { weight: 84.6 }));

		expect(client.saveRequests[0]).toMatchObject({ weightUnit: "KG", sizeUnit: "CM" });
	});

	it("fails when the authenticated profile carries no user id", async () => {
		const service = new BodyMeasurementService(new FakeBodyMeasurementClient(), createUserClient({}));

		await expect(service.getMeasurement("2026-08-20")).rejects.toMatchObject({
			name: "ServiceError",
			code: "AUTHENTICATION_REQUIRED",
		});
	});
});
