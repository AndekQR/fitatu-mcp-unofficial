export class MutationConfirmationContext {
	public readonly subject: string;
	public readonly inspectionTool: string;

	public constructor(subject: string, inspectionTool: string) {
		this.subject = subject;
		this.inspectionTool = inspectionTool;
	}
}
