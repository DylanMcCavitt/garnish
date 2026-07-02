import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, isAbsolute, join, relative, resolve } from "node:path";

import {
  certifiedRelease,
  certifiedVersion,
  createLaunchSpec,
  ensureRuntime,
  handshake,
  parseOmpVersion,
  runtimePaths,
  runtimeStorageDirs,
} from "../../src/adapter/runtime";
import type {
  InstallRuntimeRequest,
  RuntimeEffects,
  RuntimeExecOptions,
  RuntimeExecResult,
  RuntimePaths,
} from "../../src/adapter/types";

const tempRoots: string[] = [];
const originalPath = process.env.PATH;

afterEach(() => {
  process.env.PATH = originalPath;

  for (const tempRoot of tempRoots.splice(0)) {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("runtimePaths keeps every adapter-owned path under the Garnish root", () => {
  const root = tempRoot();
  const paths = runtimePaths({ garnishRootDir: root, platform: "darwin" });

  expect(paths).toEqual({
    garnishRootDir: resolve(root),
    runtimeDir: join(resolve(root), "runtime", "pi", `omp-${certifiedVersion}`),
    binDir: join(resolve(root), "runtime", "pi", `omp-${certifiedVersion}`, "bin"),
    binaryPath: join(resolve(root), "runtime", "pi", `omp-${certifiedVersion}`, "bin", "omp"),
    agentDir: join(resolve(root), "agent"),
    homeDir: join(resolve(root), "home"),
    authBrokerSnapshotPath: join(resolve(root), "auth", "omp-auth-broker-snapshot.enc"),
  });

  expect(isAbsolute(paths.binaryPath)).toBe(true);
  expect(runtimeStorageDirs(paths)).toEqual([
    paths.garnishRootDir,
    paths.runtimeDir,
    paths.binDir,
    paths.agentDir,
    paths.homeDir,
    join(paths.garnishRootDir, "auth"),
  ]);

  for (const adapterPath of [
    ...runtimeStorageDirs(paths),
    paths.binaryPath,
    paths.authBrokerSnapshotPath,
  ]) {
    expect(isInside(paths.garnishRootDir, adapterPath)).toBe(true);
  }
});

test("parseOmpVersion accepts Pi version output variants and rejects unrelated semver text", () => {
  expect(parseOmpVersion("omp/16.2.13")).toBe("16.2.13");
  expect(parseOmpVersion("omp v16.2.13")).toBe("16.2.13");
  expect(parseOmpVersion("pi runtime ready")).toBeUndefined();
  expect(parseOmpVersion("Node: v24.3.0")).toBeUndefined();
  expect(parseOmpVersion("error: requires omp v16.2.13")).toBeUndefined();
});

test("handshake accepts the certified runtime and pauses mismatches with actionable doctor output", () => {
  expect(handshake("omp/16.2.13")).toEqual({
    status: "ok",
    certifiedVersion: "16.2.13",
    reportedVersion: "16.2.13",
  });

  const mismatch = handshake("omp/16.2.12");

  expect(mismatch).toEqual({
    status: "paused",
    certifiedVersion: "16.2.13",
    reportedVersion: "16.2.12",
    doctor: expect.any(Array),
  });

  if (mismatch.status !== "paused") {
    throw new Error("Expected mismatched runtime to pause");
  }

  const doctor = mismatch.doctor.join("\n");
  expect(doctor).toContain("16.2.13");
  expect(doctor).toMatch(/reinstall|doctor/i);
  expect(doctor).toMatch(/PATH/i);
  expect(doctor).toMatch(/absolute path/i);
});

test("ensureRuntime installs a missing runtime and verifies the installed binary by absolute path", async () => {
  const root = tempRoot();
  const paths = runtimePaths({ garnishRootDir: root });
  const effects = new FakeRuntimeEffects({
    installed: false,
    versionOutput: certifiedRelease.versionOutput,
  });

  const runtime = await ensureRuntime(effects, { garnishRootDir: root });

  expect(runtime.installPerformed).toBe(true);
  expect(runtime.version).toBe(certifiedVersion);
  expect(runtime.handshake).toEqual({
    status: "ok",
    certifiedVersion,
    reportedVersion: certifiedVersion,
  });
  expect(effects.installs).toHaveLength(1);
  expect(effects.installs[0]).toMatchObject({
    version: certifiedVersion,
    release: certifiedRelease,
  });
  expect(effects.installs[0]?.paths).toEqual(paths);
  expect(effects.existsCalls).toEqual([paths.binaryPath]);
  expect(effects.execs).toHaveLength(1);
  expect(effects.execs[0]).toEqual({
    file: paths.binaryPath,
    args: ["--version"],
    options: { cwd: paths.garnishRootDir, env: {} },
  });
  expect(isAbsolute(effects.execs[0]?.file ?? "")).toBe(true);
  expect(effects.mkdirCalls).toEqual([...runtimeStorageDirs(paths)]);

  for (const touchedPath of effects.touchedPaths()) {
    expect(isInside(paths.garnishRootDir, touchedPath)).toBe(true);
  }
});

test("ensureRuntime reinstalls an existing non-certified runtime and verifies the replacement", async () => {
  const root = tempRoot();
  const paths = runtimePaths({ garnishRootDir: root });
  const effects = new FakeRuntimeEffects({
    installed: true,
    versionOutput: "omp/16.2.12",
    versionOutputAfterInstall: certifiedRelease.versionOutput,
  });

  const runtime = await ensureRuntime(effects, { garnishRootDir: root });

  expect(runtime.installPerformed).toBe(true);
  expect(runtime.version).toBe(certifiedVersion);
  expect(runtime.handshake).toEqual({
    status: "ok",
    certifiedVersion,
    reportedVersion: certifiedVersion,
  });
  expect(effects.installs).toHaveLength(1);
  expect(effects.installs[0]).toMatchObject({
    version: certifiedVersion,
    release: certifiedRelease,
  });
  expect(effects.installs[0]?.paths).toEqual(paths);
  expect(effects.existsCalls).toEqual([paths.binaryPath]);
  expect(effects.execs).toHaveLength(2);
  expect(effects.execs.map((exec) => exec.file)).toEqual([paths.binaryPath, paths.binaryPath]);
});

test("ensureRuntime is idempotent when an existing certified runtime already verifies", async () => {
  const root = tempRoot();
  const paths = runtimePaths({ garnishRootDir: root });
  const effects = new FakeRuntimeEffects({
    installed: true,
    versionOutput: "omp/16.2.13",
  });

  const first = await ensureRuntime(effects, { garnishRootDir: root });
  const second = await ensureRuntime(effects, { garnishRootDir: root });

  expect(first.installPerformed).toBe(false);
  expect(second.installPerformed).toBe(false);
  expect(effects.installs).toHaveLength(0);
  expect(effects.existsCalls).toEqual([paths.binaryPath, paths.binaryPath]);
  expect(effects.execs.map((exec) => exec.file)).toEqual([paths.binaryPath, paths.binaryPath]);
  expect(effects.execs.every((exec) => exec.file === paths.binaryPath)).toBe(true);
});

test("ensureRuntime ignores PATH omp entries and executes only the certified binary path", async () => {
  const root = tempRoot();
  const globalBinDir = tempRoot("garnish-global-bin-");
  const globalOmp = join(globalBinDir, "omp");
  writeFileSync(globalOmp, "#!/bin/sh\necho omp/0.0.0\n", { mode: 0o755 });
  process.env.PATH = `${globalBinDir}${delimiter}${originalPath ?? ""}`;

  const paths = runtimePaths({ garnishRootDir: root });
  const effects = new FakeRuntimeEffects({
    installed: true,
    versionOutput: certifiedRelease.versionOutput,
  });

  await ensureRuntime(effects, { garnishRootDir: root });

  expect(effects.existsCalls).toEqual([paths.binaryPath]);
  expect(effects.execs).toHaveLength(1);
  expect(effects.execs[0]?.file).toBe(paths.binaryPath);
  expect(effects.execs[0]?.file).not.toBe("omp");
  expect(effects.execs[0]?.file).not.toBe(globalOmp);
});

test("createLaunchSpec launches the certified binary with Garnish-owned isolation env", () => {
  const root = tempRoot();
  const paths = runtimePaths({ garnishRootDir: root });

  const launch = createLaunchSpec(paths, {
    args: ["run", "quest"],
    cwd: join(paths.garnishRootDir, "workspace"),
    env: { EXISTING: "kept", HOME: "/outside/home" },
  });

  expect(launch).toEqual({
    command: paths.binaryPath,
    args: ["run", "quest"],
    cwd: join(paths.garnishRootDir, "workspace"),
    env: {
      EXISTING: "kept",
      HOME: paths.homeDir,
      OMP_AUTH_BROKER_SNAPSHOT_CACHE: paths.authBrokerSnapshotPath,
      PI_CODING_AGENT_DIR: paths.agentDir,
    },
  });
  expect(isAbsolute(launch.command)).toBe(true);

  for (const envPath of [
    launch.env.HOME,
    launch.env.OMP_AUTH_BROKER_SNAPSHOT_CACHE,
    launch.env.PI_CODING_AGENT_DIR,
  ]) {
    expect(isInside(paths.garnishRootDir, envPath)).toBe(true);
  }
});

class FakeRuntimeEffects implements RuntimeEffects {
  readonly mkdirCalls: string[] = [];
  readonly existsCalls: string[] = [];
  readonly installs: InstallRuntimeRequest[] = [];
  readonly execs: Array<{
    readonly file: string;
    readonly args: readonly string[];
    readonly options?: RuntimeExecOptions;
  }> = [];

  #installed: boolean;
  #versionOutput: string;

  constructor(
    private readonly options: {
      readonly installed: boolean;
      readonly versionOutput: string;
      readonly versionOutputAfterInstall?: string;
    },
  ) {
    this.#installed = options.installed;
    this.#versionOutput = options.versionOutput;
  }

  exists(path: string): boolean {
    this.existsCalls.push(path);
    return this.#installed;
  }

  mkdirp(path: string): void {
    this.mkdirCalls.push(path);
  }

  installRuntime(request: InstallRuntimeRequest): void {
    this.installs.push(request);
    this.#installed = true;
    this.#versionOutput = this.options.versionOutputAfterInstall ?? this.options.versionOutput;
  }

  execFile(
    file: string,
    args: readonly string[],
    options?: RuntimeExecOptions,
  ): RuntimeExecResult {
    this.execs.push({ file, args: [...args], options });

    return {
      stdout: this.#versionOutput,
      stderr: "",
      exitCode: 0,
    };
  }

  touchedPaths(): string[] {
    return [
      ...this.mkdirCalls,
      ...this.installs.flatMap((install) => [
        install.paths.garnishRootDir,
        install.paths.runtimeDir,
        install.paths.binDir,
        install.paths.binaryPath,
        install.paths.agentDir,
        install.paths.homeDir,
        install.paths.authBrokerSnapshotPath,
      ]),
      ...this.execs.map((exec) => exec.file),
    ];
  }

  private currentPaths(): RuntimePaths | undefined {
    return this.installs.at(-1)?.paths;
  }
}

function tempRoot(prefix = "garnish-adapter-"): string {
  const root = mkdtempSync(join(tmpdir(), prefix));
  tempRoots.push(root);
  return root;
}

function isInside(root: string, candidate: string | undefined): boolean {
  if (candidate === undefined) {
    return false;
  }

  const relativePath = relative(resolve(root), resolve(candidate));
  return relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath));
}
