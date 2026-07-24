import { RecipeWriteInput } from "./RecipeWriteInput.ts";

export class RecipeReplacementInput extends RecipeWriteInput {
	declare public readonly categories: unknown;
}
