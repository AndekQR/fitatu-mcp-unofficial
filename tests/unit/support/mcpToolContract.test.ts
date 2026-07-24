import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpServer as TestMcpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LATEST_PROTOCOL_VERSION } from "@modelcontextprotocol/sdk/types.js";
import { once } from "node:events";
import { request as httpRequest } from "node:http";
import type { AddressInfo } from "node:net";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { McpHttpServer } from "../../../src/server/McpHttpServer.ts";
import { createTextResult } from "../../../src/tools/shared/ToolResult.ts";
import { getTextContent, registerToolForTest } from "./mcpToolTestDouble.ts";

describe("MCP tool contract harness", () => {
	it("rejects successful structured content that violates the registered output schema", async () => {
		const registered = await registerToolForTest({
			register(server: McpServer): void {
				server.registerTool(
					"broken_output",
					{
						description: "Deliberately broken tool used to verify SDK output validation.",
						inputSchema: {},
						outputSchema: { value: z.string() },
					},
					async () => createTextResult({ wrongField: true }),
				);
			},
		});

		expect(registered.config.outputSchema).toMatchObject({ type: "object", required: ["value"] });
		const result = await registered.invoke({});

		expect(result.isError).toBe(true);
		expect(getTextContent(result)).toContain("Output validation error");
	});

	it("terminates HTTP sessions explicitly and during shutdown", async () => {
		const httpServer = new McpHttpServer({
			createServer: () => new TestMcpServer({ name: "transport-test", version: "1.0.0" }),
		});
		const listener = httpServer.app.listen(0, "127.0.0.1");
		await once(listener, "listening");
		const port = (listener.address() as AddressInfo).port;
		const url = `http://127.0.0.1:${port}/mcp`;

		try {
			const initialized = await request(
				url,
				{
					method: "POST",
					headers: {
						accept: "application/json, text/event-stream",
						"content-type": "application/json",
					},
				},
				{
					jsonrpc: "2.0",
					id: 1,
					method: "initialize",
					params: {
						protocolVersion: LATEST_PROTOCOL_VERSION,
						capabilities: {},
						clientInfo: { name: "transport-test", version: "1.0.0" },
					},
				},
			);
			const sessionId = initialized.headers["mcp-session-id"];

			expect(initialized.status).toBe(200);
			expect(sessionId).toBeTruthy();
			expect(httpServer.activeSessionCount).toBe(1);

			const deleted = await request(url, {
				method: "DELETE",
				headers: {
					accept: "application/json, text/event-stream",
					"mcp-protocol-version": LATEST_PROTOCOL_VERSION,
					"mcp-session-id": String(sessionId ?? ""),
				},
			});
			expect(deleted.status).toBe(200);
			expect(httpServer.activeSessionCount).toBe(0);

			const reused = await request(
				url,
				{
					method: "POST",
					headers: {
						accept: "application/json, text/event-stream",
						"content-type": "application/json",
						"mcp-protocol-version": LATEST_PROTOCOL_VERSION,
						"mcp-session-id": String(sessionId ?? ""),
					},
				},
				{ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
			);

			expect(reused.status).toBe(404);
			expect(reused.json).toMatchObject({
				jsonrpc: "2.0",
				error: { code: -32001, message: "Session not found" },
				id: null,
			});

			const reinitialized = await request(
				url,
				{
					method: "POST",
					headers: {
						accept: "application/json, text/event-stream",
						"content-type": "application/json",
					},
				},
				{
					jsonrpc: "2.0",
					id: 3,
					method: "initialize",
					params: {
						protocolVersion: LATEST_PROTOCOL_VERSION,
						capabilities: {},
						clientInfo: { name: "transport-test", version: "1.0.0" },
					},
				},
			);
			const shutdownSessionId = reinitialized.headers["mcp-session-id"];
			expect(shutdownSessionId).toBeTruthy();
			expect(httpServer.activeSessionCount).toBe(1);

			await httpServer.closeSessions();
			expect(httpServer.activeSessionCount).toBe(0);

			const reusedAfterShutdown = await request(
				url,
				{
					method: "POST",
					headers: {
						accept: "application/json, text/event-stream",
						"content-type": "application/json",
						"mcp-protocol-version": LATEST_PROTOCOL_VERSION,
						"mcp-session-id": String(shutdownSessionId ?? ""),
					},
				},
				{ jsonrpc: "2.0", id: 4, method: "tools/list", params: {} },
			);
			expect(reusedAfterShutdown.status).toBe(404);
			expect(reusedAfterShutdown.json).toMatchObject({
				jsonrpc: "2.0",
				error: { code: -32001, message: "Session not found" },
				id: null,
			});
		} finally {
			await httpServer.closeSessions();
			listener.close();
		}
	});
});

function request(
	url: string,
	options: { readonly method: string; readonly headers: Readonly<Record<string, string>> },
	body?: unknown,
): Promise<{
	readonly status: number;
	readonly headers: Readonly<Record<string, string | string[] | undefined>>;
	readonly json: unknown;
}> {
	return new Promise((resolve, reject) => {
		const payload = body === undefined ? undefined : JSON.stringify(body);
		const outgoing = httpRequest(
			url,
			{
				method: options.method,
				headers: {
					...options.headers,
					...(payload ? { "content-length": Buffer.byteLength(payload) } : {}),
				},
			},
			(response) => {
				const chunks: Buffer[] = [];
				response.on("data", (chunk: Buffer) => chunks.push(chunk));
				response.on("end", () => {
					const text = Buffer.concat(chunks).toString("utf8");
					resolve({
						status: response.statusCode ?? 0,
						headers: response.headers,
						json: text.trimStart().startsWith("{") ? JSON.parse(text) : null,
					});
				});
			},
		);
		outgoing.on("error", reject);
		if (payload) {
			outgoing.write(payload);
		}
		outgoing.end();
	});
}
