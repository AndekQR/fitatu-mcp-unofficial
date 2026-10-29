import { execFile } from "node:child_process";
import { realpath } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";

const execute = promisify(execFile);

async function commandOutput(command: string, args: string[]): Promise<string> {
	try {
		return (await execute(command, args)).stdout;
	} catch (error) {
		// Both lsof and ps return 1 when no matching process remains.
		if (error instanceof Error && "code" in error && error.code === 1 && "stdout" in error) {
			return String(error.stdout);
		}

		throw new Error(`Cannot inspect processes with ${command}. Install it and check process permissions.`);
	}
}

async function projectProcesses(root: string): Promise<number[]> {
	const output = await commandOutput("lsof", ["-a", "-u", String(process.getuid!()), "-d", "cwd", "-Fn"]);
	const candidates: number[] = [];
	let pid = 0;

	for (const line of output.split("\n")) {
		if (line.startsWith("p")) {
			pid = Number(line.slice(1));
		} else if (line === `n${root}` && Number.isSafeInteger(pid) && pid > 1 && pid !== process.pid) {
			candidates.push(pid);
		}
	}

	const matches = await Promise.all(
		candidates.map(async (candidate) => {
			const args = (await commandOutput("ps", ["-p", String(candidate), "-o", "args="])).trim();
			// Match entry points, including the former start.ts name for processes running before the rename.
			const server =
				/^(?:\S*\/)?node(?:\s+--(?:watch|env-file=\S+))*\s+src\/(?:index\.ts|development\/(?:startTunnel|start)\.ts)(?:\s|$)/;
			const tunnel = /^(?:\S*\/)?ngrok\s+http\s+http:\/\/127\.0\.0\.1:\d+(?:\s|$)/;
			return server.test(args) || tunnel.test(args) ? candidate : undefined;
		}),
	);

	return matches.filter((candidate): candidate is number => candidate !== undefined);
}

function signal(pid: number, name: NodeJS.Signals): void {
	try {
		process.kill(pid, name);
	} catch (error) {
		if (!(error instanceof Error && "code" in error && error.code === "ESRCH")) {
			throw new Error(`Cannot stop development process ${pid}. Check process permissions.`);
		}
	}
}

async function main(): Promise<void> {
	if (process.platform === "win32" || !process.getuid) {
		throw new Error("dev:stop requires macOS or Linux with lsof and ps installed.");
	}

	const root = await realpath(fileURLToPath(new URL("../../", import.meta.url)));
	const processes = await projectProcesses(root);

	if (processes.length === 0) {
		console.log("No development servers or ngrok tunnel are running for this project.");
		return;
	}

	for (const pid of processes) {
		signal(pid, "SIGTERM");
	}

	const deadline = Date.now() + 5000;
	while (Date.now() < deadline) {
		await delay(200);
		const remaining = await projectProcesses(root);

		if (remaining.length === 0) {
			console.log("Stopped this project's development servers and ngrok tunnel.");
			return;
		}
	}

	// Re-inspect ownership before force-stopping processes that ignored SIGTERM.
	for (const pid of await projectProcesses(root)) {
		signal(pid, "SIGKILL");
	}

	await delay(200);
	if ((await projectProcesses(root)).length > 0) {
		throw new Error("Some development processes are still running. Retry npm run dev:stop.");
	}

	console.log("Stopped this project's development servers and ngrok tunnel (forced shutdown).");
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : "Cannot stop development processes.");
	process.exitCode = 1;
});
