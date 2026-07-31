import type { CustomMealItemInput } from "./CustomMealItemInput.ts";
import type { ProductMealItemInput } from "./ProductMealItemInput.ts";
import type { RecipeMealItemInput } from "./RecipeMealItemInput.ts";

export type MealItemInput = ProductMealItemInput | RecipeMealItemInput | CustomMealItemInput;
