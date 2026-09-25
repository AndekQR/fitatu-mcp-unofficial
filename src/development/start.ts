import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import type { Server } from "node:http";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { TunnelGateway } from "./TunnelGateway.ts";
import { readTunnelConfig, type Account } from "./tunnelConfig.ts";

const NGROK_WEB_PORT = 4040;

async function main(): Promise<void> {
	const config = readTunnelConfig(process.env);
	const mode = process.argv[2];

	if (mode !== "all" && mode !== "test") {
		throw new Error("Choose all or test accounts.");
	}

	const accounts: Account[] = mode === "all" ? ["personal", "test"] : ["test"];
	const children: ChildProcess[] = [];
	let listener: Server | undefined;
	let stopping = false;
	const root = fileURLToPath(new URL("../../", import.meta.url));
	const signal = (child: ChildProcess, name: NodeJS.Signals): void => {
		if (!child.pid) {
			return;
		}

		try {
			process.kill(-child.pid, name);
		} catch {
			/* Child already stopped. */
		}
	};

	const stop = async (exitCode: number): Promise<void> => {
		if (stopping) {
			return;
		}

		stopping = true;
		process.exitCode = exitCode;
		listener?.close();
		listener?.closeAllConnections();

		const exits = children.map((child) => {
			if (!child.pid || child.exitCode !== null || child.signalCode !== null) {
				return Promise.resolve();
			}

			return new Promise<void>((resolve) => {
				child.once("exit", () => resolve());
			});
		});

		for (const child of children) {
			signal(child, "SIGTERM");
		}

		const timeout = setTimeout(() => {
			for (const child of children) {
				signal(child, "SIGKILL");
			}
		}, 5000);

		await Promise.all(exits);
		clearTimeout(timeout);
	};

	process.once("SIGINT", () => {
		void stop(0);
	});

	process.once("SIGTERM", () => {
		void stop(0);
	});
	process.once("SIGHUP", () => {
		void stop(0);
	});
	process.once("exit", () => {
		for (const child of children) {
			signal(child, "SIGTERM");
		}
	});

	const start = (name: string, command: string, args: string[], environment: NodeJS.ProcessEnv): ChildProcess => {
		if (stopping) {
			throw new Error("Startup interrupted.");
		}

		const child = spawn(command, args, {
			cwd: root,
			env: environment,
			stdio: ["ignore", "inherit", "inherit"],
			detached: true,
		});
		children.push(child);

		child.on("error", () => {
			console.error(`${name} could not start. Check installation and configuration.`);
			void stop(1);
		});

		child.on("exit", () => {
			if (!stopping) {
				console.error(`${name} stopped; shutting down the remaining processes.`);
				void stop(1);
			}
		});

		return child;
	};

	try {
		const ports = accounts.map((account) =>
			account === "test" ? config.TUNNEL_TEST_PORT : config.TUNNEL_PERSONAL_PORT,
		);

		await checkPort(
			NGROK_WEB_PORT,
			`Ngrok web port ${NGROK_WEB_PORT} is already in use. A previous ngrok agent may still be running. ` +
				`Inspect it with: lsof -nP -iTCP:${NGROK_WEB_PORT} -sTCP:LISTEN`,
		);

		for (const port of [config.TUNNEL_PORT, ...ports]) {
			await checkPort(port);
		}

		const gateway = new TunnelGateway(config, accounts);

		const environment = Object.fromEntries(
			Object.entries(process.env).filter(([name]) => !/^(FITATU_|TUNNEL_|NGROK_DOMAIN$)/.test(name)),
		);

		for (const account of accounts) {
			const port = account === "test" ? config.TUNNEL_TEST_PORT : config.TUNNEL_PERSONAL_PORT;
			start(`Fitatu ${account}`, process.execPath, ["--watch", "src/index.ts"], {
				...environment,
				MCP_TRANSPORT: "http",
				HOST: "127.0.0.1",
				PORT: String(port),
				SERVER_NAME: `fitatu-${account}`,
				FITATU_EMAIL: account === "test" ? config.FITATU_INTEGRATION_EMAIL : config.FITATU_EMAIL,
				FITATU_PASSWORD: account === "test" ? config.FITATU_INTEGRATION_PASSWORD : config.FITATU_PASSWORD,
				...Object.fromEntries(
					["FITATU_USER_AGENT", "FITATU_APP_VERSION", "FITATU_API_APK_UUID"]
						.filter((key) => process.env[key] !== undefined)
						.map((key) => [key, process.env[key]]),
				),
			});
		}

		for (const port of ports) {
			let ready = false;

			for (let attempt = 0; attempt < 100 && !stopping; attempt++) {
				try {
					const response = await fetch(`http://127.0.0.1:${port}/mcp`, { signal: AbortSignal.timeout(500) });
					await response.body?.cancel();
					ready = response.status === 400;
				} catch {
					/* Startup or watch restart. */
				}

				if (ready) {
					break;
				}

				await delay(100);
			}

			if (stopping) {
				return;
			}

			if (!ready) {
				throw new Error(`MCP server on port ${port} did not become ready.`);
			}
		}

		if (stopping) {
			return;
		}

		await new Promise<void>((resolve, reject) => {
			listener = gateway.app.listen(config.TUNNEL_PORT, "127.0.0.1", () => resolve());
			listener.once("error", reject);
		});

		if (stopping) {
			listener?.close();
			return;
		}

		start(
			"ngrok",
			"ngrok",
			[
				"http",
				`http://127.0.0.1:${config.TUNNEL_PORT}`,
				`--url=https://${config.NGROK_DOMAIN}`,
				"--inspect=false",
				"--log=stdout",
				"--log-level=warn",
			],
			environment,
		);

		for (const account of accounts) {
			console.log(`Fitatu ${account}: https://${config.NGROK_DOMAIN}/${account}/mcp`);
		}

		console.log("No authentication. Ctrl+C stops all processes and the public tunnel.");
	} catch (error) {
		await stop(1);
		throw error;
	}
}

async function checkPort(port: number, inUseMessage?: string): Promise<void> {
	await new Promise<void>((resolve, reject) => {
		const server = createServer();
		server.once("error", (error: NodeJS.ErrnoException) => {
			const message =
				error.code === "EADDRINUSE"
					? (inUseMessage ?? `Port ${port} is in use. Inspect it with: lsof -nP -iTCP:${port} -sTCP:LISTEN`)
					: `Cannot bind port ${port} (${error.code ?? "unknown error"}). Check local network permissions.`;

			reject(new Error(message));
		});

		server.listen(port, "127.0.0.1", () => {
			server.close(() => resolve());
		});
	});
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : "Cannot start the development tunnel.");
	process.exitCode = 1;
});
