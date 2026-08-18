export const FITATU_CLIENT_OPERATIONS = {
	authLogin: "auth.login",
	authRefresh: "auth.refresh",
	usersGet: "users.get",
	recipesGet: "recipes.get",
	recipesCreate: "recipes.create",
	recipesReplace: "recipes.replace",
	recipesDelete: "recipes.delete",
	recipesSearch: "recipes.search",
	foodSearch: "food.search",
	foodDetailsGet: "food.details.get",
	dayPlanGet: "dayPlan.get",
	dayPlanAddItems: "dayPlan.items.add",
	dayPlanUpdateItem: "dayPlan.items.update",
	dayPlanRemoveItem: "dayPlan.items.remove",
	dayPlanRemoveItems: "dayPlan.items.removeMany",
	dayPlanMoveItem: "dayPlan.items.move",
	dayPlanReplaceItem: "dayPlan.items.replace",
	dayPlanSync: "dayPlan.sync",
	dietSummaryGet: "dietSummary.get",
	dietEnergySummaryGet: "dietSummary.energy.get",
} as const;

export type FitatuClientOperation = (typeof FITATU_CLIENT_OPERATIONS)[keyof typeof FITATU_CLIENT_OPERATIONS];
