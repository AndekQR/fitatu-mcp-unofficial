/** Application request to create a user-owned product. All nutrition values are per 100 g. */
export class ProductCreation {
	public readonly name: string;
	public readonly brand: string | null;
	public readonly barcode: string | null;
	public readonly energy: number;
	public readonly fat: number;
	public readonly carbohydrate: number;
	public readonly protein: number;
	public readonly saturatedFat: number | null;
	public readonly sugars: number | null;
	public readonly fiber: number | null;
	public readonly salt: number | null;

	public constructor(
		name: string,
		brand: string | null,
		barcode: string | null,
		energy: number,
		fat: number,
		carbohydrate: number,
		protein: number,
		saturatedFat: number | null,
		sugars: number | null,
		fiber: number | null,
		salt: number | null,
	) {
		this.name = name;
		this.brand = brand;
		this.barcode = barcode;
		this.energy = energy;
		this.fat = fat;
		this.carbohydrate = carbohydrate;
		this.protein = protein;
		this.saturatedFat = saturatedFat;
		this.sugars = sugars;
		this.fiber = fiber;
		this.salt = salt;
	}
}
