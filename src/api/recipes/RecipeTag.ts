export class RecipeTag {
	public readonly name: string;
	public readonly category: string;
	public readonly translation: string;

	public constructor(name: string, category: string, translation: string) {
		this.name = name;
		this.category = category;
		this.translation = translation;
	}
}
