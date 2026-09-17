import express from "express";
import { request as httpRequest } from "node:http";
import type { Account, TunnelConfig } from "./tunnelConfig.ts";

export class TunnelGateway {
	public readonly app = express();

	public constructor(config: TunnelConfig, accounts: readonly Account[]) {
		this.app.disable("x-powered-by");

		this.app.use((_request, response, next) => {
			response.set({ "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
			next();
		});

		for (const account of accounts) {
			this.app.all(`/${account}/mcp`, (request, response) => {
				if (!["GET", "POST", "DELETE"].includes(request.method)) {
					response.set("Allow", "GET, POST, DELETE").sendStatus(405);
					return;
				}

				const port = account === "test" ? config.TUNNEL_TEST_PORT : config.TUNNEL_PERSONAL_PORT;
				const headers: Record<string, string> = {};

				for (const name of [
					"content-type",
					"accept",
					"mcp-session-id",
					"mcp-protocol-version",
					"last-event-id",
				]) {
					const value = request.get(name);

					if (value) {
						headers[name] = value;
					}
				}

				const upstream = httpRequest(
					{ host: "127.0.0.1", port, path: "/mcp", method: request.method, headers },
					(incoming) => {
						response.status(incoming.statusCode ?? 502);

						for (const name of ["content-type", "mcp-session-id", "mcp-protocol-version", "allow"]) {
							const value = incoming.headers[name];

							if (value) {
								response.setHeader(name, value);
							}
						}

						incoming.on("error", () => response.destroy());
						response.flushHeaders();
						incoming.pipe(response);
					},
				);

				upstream.on("error", () => {
					if (!response.headersSent) {
						response.status(502).json({ error: "Local MCP server unavailable" });
					} else {
						response.destroy();
					}
				});

				request.on("aborted", () => upstream.destroy());
				response.on("close", () => upstream.destroy());
				request.pipe(upstream);
			});
		}

		this.app.use((_request, response) => {
			response.sendStatus(404);
		});

		this.app.use(
			(_error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
				response.status(400).json({ error: "Invalid request" });
			},
		);
	}
}
