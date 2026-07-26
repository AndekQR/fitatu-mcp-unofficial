export class CustomMealItemInput {
	declare public readonly foodType: "CUSTOM_ITEM";
	declare public readonly name: string;
	declare public readonly energyKcal: number;
	declare public readonly proteinG?: number;
	declare public readonly fatG?: number;
	declare public readonly carbohydrateG?: number;
	declare public readonly eaten?: boolean;
}
