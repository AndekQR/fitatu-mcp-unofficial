export const FITATU_DAY_DATE_FIXTURE = "2026-07-12";

export const FITATU_DAY_RESPONSE_FIXTURE = {
	planDayRevisions: [{ revision: "existing-revision" }],
	activityPlan: [{ activityId: "activity-1" }],
	dietPlan: { breakfast: { items: [] } },
	toilet: [{ type: "OTHER" }],
	water: { waterConsumption: 600 },
	note: "sanitized note",
	tagsIds: [12],
};

export const FITATU_DAY_SYNC_PAYLOAD_FIXTURE = {
	planDayRevisions: [{ revision: "existing-revision" }],
	activities: [{ activityId: "activity-1" }],
	dietPlan: { breakfast: { items: [] } },
	toilet: [{ type: "OTHER" }],
	water: { waterConsumption: 600 },
	note: "sanitized note",
	tagsIds: [12],
};

export const FITATU_DAY_SYNC_RECEIPTS_FIXTURE = [
	{
		date: FITATU_DAY_DATE_FIXTURE,
		revision: "revision-1",
		errorMessage: null,
	},
];
