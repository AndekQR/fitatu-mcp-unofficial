export const SERVICE_ERROR_CODES = {
	recipeNameMismatch: "RECIPE_NAME_MISMATCH",
	recipeNotOwned: "RECIPE_NOT_OWNED",
	recipeNotEditable: "RECIPE_NOT_EDITABLE",
	invalidRecipeTagCategory: "INVALID_RECIPE_TAG_CATEGORY",
	duplicateIngredientSelection: "DUPLICATE_INGREDIENT_SELECTION",
	invalidIngredientMeasure: "INVALID_INGREDIENT_MEASURE",
	mealItemDefinitionRequired: "MEAL_ITEM_DEFINITION_REQUIRED",
	deletedRecipeSelection: "DELETED_RECIPE_SELECTION",
	invalidMealItemMeasure: "INVALID_MEAL_ITEM_MEASURE",
	invalidDateRange: "INVALID_DATE_RANGE",
	authenticationRequired: "AUTHENTICATION_REQUIRED",
} as const;

export type ServiceErrorCode = (typeof SERVICE_ERROR_CODES)[keyof typeof SERVICE_ERROR_CODES];
