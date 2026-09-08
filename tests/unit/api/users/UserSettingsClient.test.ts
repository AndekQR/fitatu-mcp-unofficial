import { describe, expect, it } from "vitest";
import { GetUserSettingsRequest } from "../../../../src/api/users/GetUserSettingsRequest.ts";
import { UserSettingsApiResponse } from "../../../../src/api/users/UserSettingsApiResponse.ts";
import { UserSettingsClient } from "../../../../src/api/users/UserSettingsClient.ts";
import { UpdateUserSettingsRequest } from "../../../../src/api/users/UpdateUserSettingsRequest.ts";
import { UserDietSettingsApiResponse } from "../../../../src/api/users/UserDietSettingsApiResponse.ts";
import { UserCalculatedValuesApiResponse } from "../../../../src/api/users/UserCalculatedValuesApiResponse.ts";
import { UserWaterSettingsApiResponse } from "../../../../src/api/users/UserWaterSettingsApiResponse.ts";
import { createFetchStub, createJsonResponse } from "../../support/httpTestDouble.ts";

describe("UserSettingsClient", () => {
	it("gets the date-resolved settings snapshot for one user", async () => {
		const fetchStub = createFetchStub(createJsonResponse(completeSettingsResponse()));
		const client = new UserSettingsClient({
			baseUrl: "https://fitatu.test/api",
			fetchFn: fetchStub.fetchFn,
		});

		const result = await client.getSettings(new GetUserSettingsRequest("user/1", "2026-09-07"));

		expect(fetchStub.calls).toHaveLength(1);
		expect(fetchStub.calls[0]).toMatchObject({
			input: "https://fitatu.test/api/users/user%2F1/settings-new/2026-09-07",
			init: { method: "GET" },
		});
		expect(result).toBeInstanceOf(UserSettingsApiResponse);
		expect(result).toMatchObject({ date: "2026-09-07T10:15:00+00:00" });
		expect(result.userDietSettings).toMatchObject({
			manualEnergyTarget: true,
			energy: 2200,
			proteinPercentage: 20,
			fatPercentage: 30,
			carbohydratePercentage: 50,
		});
		expect(result.userDietSettings).toBeInstanceOf(UserDietSettingsApiResponse);
		expect(result.userDietSettings.createAutomaticEnergyTargetPatch().toJSON()).toMatchObject({
			manualEnergyTarget: false,
			activityBase: 500,
		});
		expect(result.calculatedValues).toMatchObject({ bmr: 1800, tmr: 2700, pal: 1.5 });
		expect(result.calculatedValues).toBeInstanceOf(UserCalculatedValuesApiResponse);
		expect(result.waterSettings).toMatchObject({ unitCapacity: 250 });
		expect(result.waterSettings).toBeInstanceOf(UserWaterSettingsApiResponse);
	});

	it("updates all supplied settings in one patch and returns the full snapshot", async () => {
		const fetchStub = createFetchStub(createJsonResponse(completeSettingsResponse()));
		const client = new UserSettingsClient({
			baseUrl: "https://fitatu.test/api",
			fetchFn: fetchStub.fetchFn,
		});
		const currentDietSettings = UserDietSettingsApiResponse.fromApiResponse({
			manualEnergyTarget: false,
			energy: 2100,
			activityBase: 500,
			activityEnergyInclusionMode: 1,
			activityTraining: 300,
			defaultActivityTraining: false,
			excludedProducts: [],
			firstDayDiet: 1,
			intermittentFastingConfig: { weekDays: [], type: null, default: null, startDate: null },
			meatlessFridays: false,
			multiDayMealConfig: { defaultMeal: "breakfast", meals: [] },
			nutritionSchema: [],
			weightChangeDirection: 1,
			weightChangeSpeed: 0.5,
			weightChangeSpeedKg: 0.5,
			weightChangeSpeedUnit: 1,
		});
		const request = new UpdateUserSettingsRequest(
			"user-1",
			currentDietSettings.createManualEnergyTargetPatch({
				kcal: 2200,
				proteinPercentage: 20,
				proteinWeight: 110,
				fatPercentage: 30,
				fatWeight: 73,
				carbohydratePercentage: 50,
				carbohydrateWeight: 275,
			}),
			250,
		);

		const result = await client.updateSettings(request);

		expect(fetchStub.calls).toHaveLength(1);
		expect(fetchStub.calls[0]).toMatchObject({
			input: "https://fitatu.test/api/users/user-1/settings-new",
			init: {
				method: "PATCH",
				headers: expect.objectContaining({ "content-type": "application/json" }),
			},
		});
		expect(JSON.parse(String(fetchStub.calls[0]?.init?.body))).toEqual({
			userId: "user-1",
			updatedAt: null,
			userDietSettings: {
				manualEnergyTarget: true,
				energy: 2200,
				proteinPercentage: 20,
				proteinWeight: 110,
				fatPercentage: 30,
				fatWeight: 73,
				carbohydratePercentage: 50,
				carbohydrateWeight: 275,
				activityBase: 500,
				activityEnergyInclusionMode: 1,
				activityTraining: 300,
				defaultActivityTraining: false,
				excludedProducts: [],
				firstDayDiet: 1,
				intermittentFastingConfig: { weekDays: [], type: null, default: null, startDate: null },
				meatlessFridays: false,
				multiDayMealConfig: { defaultMeal: "breakfast", meals: [] },
				nutritionSchema: [],
				weightChangeDirection: 1,
				weightChangeSpeed: 0.5,
				weightChangeSpeedKg: 0.5,
				weightChangeSpeedUnit: 1,
			},
			waterSettings: { unitCapacity: 250 },
		});
		expect(result).toBeInstanceOf(UserSettingsApiResponse);
	});

	it("maps an unsupported-account response to an actionable safe error", async () => {
		const fetchStub = createFetchStub(createJsonResponse({ message: "private upstream detail" }, { status: 405 }));
		const client = new UserSettingsClient({
			baseUrl: "https://fitatu.test/api",
			fetchFn: fetchStub.fetchFn,
		});

		await expect(client.getSettings(new GetUserSettingsRequest("user-1", "2026-09-07"))).rejects.toMatchObject({
			name: "FitatuClientError",
			message: "Fitatu user settings are not supported for this account",
			operation: "userSettings.get",
			failure: { kind: "http", statusCode: 405 },
		});
	});

	it("maps an unsupported-account update response to the same actionable safe error", async () => {
		const fetchStub = createFetchStub(createJsonResponse(null, { status: 405 }));
		const client = new UserSettingsClient({
			baseUrl: "https://fitatu.test/api",
			fetchFn: fetchStub.fetchFn,
		});

		await expect(
			client.updateSettings(new UpdateUserSettingsRequest("user-1", undefined, 250)),
		).rejects.toMatchObject({
			name: "FitatuClientError",
			message: "Fitatu user settings are not supported for this account",
			operation: "userSettings.update",
			failure: { kind: "http", statusCode: 405 },
		});
	});

	it("accepts absent optional response sections and preserves explicit macro nulls", async () => {
		const response = UserSettingsApiResponse.fromApiResponse({
			date: "2026-09-07T10:15:00+00:00",
			userDietSettings: {
				manualEnergyTarget: false,
				energy: 2700,
				proteinPercentage: null,
				fatPercentage: null,
				carbohydratePercentage: null,
			},
		});

		expect(response.calculatedValues).toBeNull();
		expect(response.waterSettings).toBeNull();
		expect(response.userDietSettings).toMatchObject({
			proteinPercentage: null,
			fatPercentage: null,
			carbohydratePercentage: null,
		});
	});

	it.each([
		{},
		{ date: "not-a-date", userDietSettings: { manualEnergyTarget: true, energy: 2200 } },
		{ date: "2026-09-07T10:15:00Z", userDietSettings: { energy: 2200 } },
		{ date: "2026-09-07T10:15:00Z", userDietSettings: { manualEnergyTarget: true } },
		{
			date: "2026-09-07T10:15:00Z",
			userDietSettings: { manualEnergyTarget: true, energy: 2200 },
			waterSettings: { unitCapacity: 0 },
		},
	])("rejects malformed core or supplied optional response data", async (responseBody) => {
		const fetchStub = createFetchStub(createJsonResponse(responseBody));
		const client = new UserSettingsClient({ baseUrl: "https://fitatu.test/api", fetchFn: fetchStub.fetchFn });

		await expect(client.getSettings(new GetUserSettingsRequest("user-1", "2026-09-07"))).rejects.toMatchObject({
			name: "FitatuClientError",
			operation: "userSettings.get",
			failure: { kind: "invalidResponse" },
		});
	});
});

function completeSettingsResponse() {
	return {
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
	};
}
