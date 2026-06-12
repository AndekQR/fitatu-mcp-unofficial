export class FitatuAuthError extends Error {
  public readonly statusCode?: number;

  public constructor(message: string, options: { statusCode?: number } = {}) {
    super(message);
    this.name = "FitatuAuthError";
    this.statusCode = options.statusCode;
  }
}
