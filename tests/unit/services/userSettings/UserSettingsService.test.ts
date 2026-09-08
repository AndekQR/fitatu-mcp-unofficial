import { describe, expect, it } from "vitest";
import type { GetUserSettingsRequest } from "../../../../src/api/users/GetUserSettingsRequest.ts";
import { FitatuUserClient } from "../../../../src/api/users/FitatuUserClient.ts";
import { FitatuUserProfile } from "../../../../src/api/users/FitatuUserProfile.ts";
import { UserSettingsApiResponse } from "../../../../src/api/users/UserSettingsApiResponse.ts";
import { UserSettingsClient } from "../../../../src/api/users/UserSettingsClient.ts";
import type { UpdateUserSettingsRequest } from "../../../../src/api/users/UpdateUserSettingsRequest.ts";
import { UserSettingsService } from "../../../../src/services/userSettings/UserSettingsService.ts";
import { AutomaticEnergyTargetUpdate } from "../../../../src/services/userSettings/AutomaticEnergyTargetUpdate.ts";
import { ManualEnergyTargetUpdate } from "../../../../src/services/userSettings/ManualEnergyTargetUpdate.ts";
import { UserSettingsUpdate } from "../../../../src/services/userSettings/UserSettingsUpdate.ts";

describe("UserSettingsService", () => {
	it("uses the authenticated user's timezone when the read date is omitted", async () => {
		const settingsClient = new FakeUserSettingsClient(apiResponse());
		const userClient = new FakeFitatuUserClient(
			FitatuUserProfile.fromApiResponse({ id: " user-1 ", timezone: "Asia/Tokyo" }),
		);
		const service = new UserSettingsService(settingsClient, userClient, () => new Date("2026-09-06T23:30:00.000Z"));

		const result = await service.getUserSettings();

		expect(settingsClient.getRequests).toEqual([{ userId: "user-1", date: "2026-09-07" }]);
		expect(result).toMatchObject({
			date: "2026-09-07",
			energyTarget: {
				mode: "manual",
				kcal: 2200,
				macronutrientDistribution: {
					proteinPercentage: 20,
					fatPercentage: 30,
					carbohydratePercentage: 50,
				},
			},
			calculatedValues: {
				basalMetabolicRateKcal: 1800,
				totalMetabolicRateKcal: 2700,
				physicalActivityLevel: 1.5,
				calculatedEnergyKcal: 2700,
				energyDeficitKcal: 500,
				activityEnergyKcal: 120,
			},
			waterServingSizeMl: 250,
		});
	});

	it("passes an explicit valid settings date through unchanged", async () => {
		const settingsClient = new FakeUserSettingsClient(apiResponse());
		const service = new UserSettingsService(
			settingsClient,
			new FakeFitatuUserClient(FitatuUserProfile.fromApiResponse({ id: "user-1" })),
		);

		await service.getUserSettings("2028-02-29");

		expect(settingsClient.getRequests).toEqual([{ userId: "user-1", date: "2028-02-29" }]);
	});

	it("preserves current diet settings and combines manual energy and water in one patch", async () => {
		const settingsClient = new FakeUserSettingsClient(apiResponse());
		const userClient = new FakeFitatuUserClient(
			FitatuUserProfile.fromApiResponse({ id: "user-1", timezone: "Europe/Warsaw" }),
		);
		const service = new UserSettingsService(settingsClient, userClient, () => new Date("2026-09-07T10:00:00.000Z"));

		await service.updateUserSettings(new UserSettingsUpdate(new ManualEnergyTargetUpdate(2250, 15, 25, 60), 300));

		expect(settingsClient.getRequests).toEqual([{ userId: "user-1", date: "2026-09-07" }]);
		expect(settingsClient.updateRequests).toHaveLength(1);
		expect(settingsClient.updateRequests[0]).toMatchObject({
			userId: "user-1",
			waterServingSizeMl: 300,
		});
		expect(settingsClient.updateRequests[0]?.userDietSettings?.toJSON()).toEqual({
			manualEnergyTarget: true,
			energy: 2250,
			proteinPercentage: 15,
			proteinWeight: 84,
			fatPercentage: 25,
			fatWeight: 63,
			carbohydratePercentage: 60,
			carbohydrateWeight: 338,
			activityBase: 500,
		});
	});

	it("switches to automatic calculation while preserving the current diet settings", async () => {
		const settingsClient = new FakeUserSettingsClient(apiResponse());
		const service = new UserSettingsService(
			settingsClient,
			new FakeFitatuUserClient(FitatuUserProfile.fromApiResponse({ id: "user-1", timezone: "Europe/Warsaw" })),
			() => new Date("2026-09-07T10:00:00.000Z"),
		);

		await service.updateUserSettings(new UserSettingsUpdate(new AutomaticEnergyTargetUpdate()));

		expect(settingsClient.getRequests).toHaveLength(1);
		expect(settingsClient.updateRequests).toHaveLength(1);
		expect(settingsClient.updateRequests[0]).toMatchObject({
			userId: "user-1",
			waterServingSizeMl: undefined,
		});
		expect(settingsClient.updateRequests[0]?.userDietSettings?.toJSON()).toEqual({
			manualEnergyTarget: false,
			energy: 2200,
			proteinPercentage: 20,
			fatPercentage: 30,
			carbohydratePercentage: 50,
			activityBase: 500,
		});
	});

	it("updates only water without reading settings first", async () => {
		const settingsClient = new FakeUserSettingsClient(apiResponse());
		const service = new UserSettingsService(
			settingsClient,
			new FakeFitatuUserClient(FitatuUserProfile.fromApiResponse({ id: "user-1" })),
		);

		await service.updateUserSettings(new UserSettingsUpdate(undefined, 275));

		expect(settingsClient.getRequests).toHaveLength(0);
		expect(settingsClient.updateRequests).toEqual([
			{ userId: "user-1", userDietSettings: undefined, waterServingSizeMl: 275 },
		]);
	});

	it("enforces update invariants outside the MCP boundary", () => {
		expect(() => new UserSettingsUpdate()).toThrowError(
			expect.objectContaining({ code: "USER_SETTINGS_VALUE_REQUIRED" }),
		);
		expect(() => new UserSettingsUpdate(undefined, 0)).toThrowError(
			expect.objectContaining({ code: "INVALID_USER_SETTINGS_VALUE" }),
		);
		expect(() => new ManualEnergyTargetUpdate(0, 15, 25, 60)).toThrowError(
			expect.objectContaining({ code: "INVALID_ENERGY_TARGET" }),
		);
		expect(() => new ManualEnergyTargetUpdate(2250, 15, 25, 59)).toThrowError(
			expect.objectContaining({ code: "INVALID_ENERGY_TARGET" }),
		);
	});

	it("requires a configured valid timezone only when today must be resolved", async () => {
		const settingsClient = new FakeUserSettingsClient(apiResponse());
		const missingTimezoneService = new UserSettingsService(
			settingsClient,
			new FakeFitatuUserClient(FitatuUserProfile.fromApiResponse({ id: "user-1" })),
		);
		const invalidTimezoneService = new UserSettingsService(
			settingsClient,
			new FakeFitatuUserClient(FitatuUserProfile.fromApiResponse({ id: "user-1", timezone: "Invalid/Zone" })),
		);

		await expect(missingTimezoneService.getUserSettings()).rejects.toMatchObject({
			code: "USER_TIMEZONE_UNAVAILABLE",
		});
		await expect(invalidTimezoneService.getUserSettings()).rejects.toMatchObject({
			code: "USER_TIMEZONE_UNAVAILABLE",
		});
		expect(settingsClient.getRequests).toHaveLength(0);
	});
});

class FakeUserSettingsClient extends UserSettingsClient {
	public readonly getRequests: GetUserSettingsRequest[] = [];
	public readonly updateRequests: UpdateUserSettingsRequest[] = [];
	private readonly response: UserSettingsApiResponse;

	public constructor(response: UserSettingsApiResponse) {
		super({ fetchFn: unusedFetch });
		this.response = response;
	}

	public override async getSettings(request: GetUserSettingsRequest): Promise<UserSettingsApiResponse> {
		this.getRequests.push(request);
		return this.response;
	}

	public override async updateSettings(request: UpdateUserSettingsRequest): Promise<UserSettingsApiResponse> {
		this.updateRequests.push(request);
		return this.response;
	}
}

class FakeFitatuUserClient extends FitatuUserClient {
	private readonly profile: FitatuUserProfile;

	public constructor(profile: FitatuUserProfile) {
		super({ fetchFn: unusedFetch });
		this.profile = profile;
	}

	public override async getAuthenticatedUser(): Promise<FitatuUserProfile> {
		return this.profile;
	}
}

function apiResponse(): UserSettingsApiResponse {
	return UserSettingsApiResponse.fromApiResponse({
		date: "2026-09-07T10:15:00+00:00",
		userDietSettings: {
			manualEnergyTarget: true,
			energy: 2200,
			proteinPercentage: 20,
			fatPercentage: 30,
			carbohydratePercentage: 50,
			activityBase: 500,
		},
		calculatedValues: {
			BMR: 1800,
			TMR: 2700,
			PAL: 1.5,
			calculatedEnergy: 2700,
			deficit: 500,
			activityEnergy: 120,
		},
		waterSettings: { unitCapacity: 250 },
	});
}

const unusedFetch: typeof fetch = async () => {
	throw new Error("Unexpected HTTP request from test fake");
};
