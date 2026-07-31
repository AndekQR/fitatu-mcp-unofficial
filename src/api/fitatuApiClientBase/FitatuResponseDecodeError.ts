export class FitatuResponseDecodeError extends Error {
	public constructor(message: string) {
		super(message);
		this.name = "FitatuResponseDecodeError";
	}
}
