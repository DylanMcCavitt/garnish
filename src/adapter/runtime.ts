import { dirname, isAbsolute, join, relative, resolve } from "node:path";

import type {
  CertifiedRuntimeRelease,
  CertifiedRuntimeVersion,
  EnsureRuntimeOptions,
  HarnessAdapter,
  LaunchOptions,
  LaunchSpec,
  RuntimeEffects,
  RuntimeInfo,
  RuntimePathOptions,
  RuntimePaths,
  VersionHandshake,
} from "./types";

export const certifiedVersion = "16.2.13" as const satisfies CertifiedRuntimeVersion;

export const certifiedRelease = {
  harness: "pi",
  binary: "omp",
  version: certifiedVersion,
  versionOutput: `omp/${certifiedVersion}`,
  verifiedAt: "2026-07-01",
  evidenceIssue: "LOO-118",
} as const satisfies CertifiedRuntimeRelease;

const ompVersionLinePattern = /^\s*omp(?:\/|\s+v)(\d+\.\d+\.\d+)\s*$/m;
const exactVersionPattern = /^\s*(\d+\.\d+\.\d+)\s*$/;

export function parseOmpVersion(output: string | undefined): string | undefined {
  const match = output?.match(ompVersionLinePattern);
  return match?.[1];
}

export function runtimePaths(options: RuntimePathOptions): RuntimePaths {
  const garnishRootDir = resolve(options.garnishRootDir);
  const runtimeDir = join(garnishRootDir, "runtime", "pi", `omp-${certifiedVersion}`);
  const binDir = join(runtimeDir, "bin");
  const binaryName = (options.platform ?? process.platform) === "win32" ? "omp.exe" : "omp";

  return {
    garnishRootDir,
    runtimeDir,
    binDir,
    binaryPath: join(binDir, binaryName),
    agentDir: join(garnishRootDir, "agent"),
    homeDir: join(garnishRootDir, "home"),
    authBrokerSnapshotPath: join(garnishRootDir, "auth", "omp-auth-broker-snapshot.enc"),
  };
}

export function runtimeStorageDirs(paths: RuntimePaths): readonly string[] {
  return [
    paths.garnishRootDir,
    paths.runtimeDir,
    paths.binDir,
    paths.agentDir,
    paths.homeDir,
    dirname(paths.authBrokerSnapshotPath),
  ];
}

export function assertGarnishOwnedPaths(paths: RuntimePaths): void {
  for (const candidate of [
    ...runtimeStorageDirs(paths),
    paths.binaryPath,
    paths.authBrokerSnapshotPath,
  ]) {
    if (!isUnderRoot(paths.garnishRootDir, candidate)) {
      throw new Error(`Runtime path escapes Garnish root: ${candidate}`);
    }
  }
}

export function handshake(reportedVersion: string | undefined): VersionHandshake {
  const normalizedVersion =
    parseOmpVersion(reportedVersion) ??
    reportedVersion?.match(exactVersionPattern)?.[1] ??
    reportedVersion?.trim() ??
    "unknown";

  if (normalizedVersion === certifiedVersion) {
    return {
      status: "ok",
      certifiedVersion,
      reportedVersion: certifiedVersion,
    };
  }

  return {
    status: "paused",
    certifiedVersion,
    reportedVersion: normalizedVersion.length > 0 ? normalizedVersion : "unknown",
    doctor: runtimeMismatchDoctor(normalizedVersion),
  };
}

export function createLaunchSpec(paths: RuntimePaths, options: LaunchOptions = {}): LaunchSpec {
  assertGarnishOwnedPaths(paths);

  return {
    command: paths.binaryPath,
    args: [...(options.args ?? [])],
    cwd: options.cwd,
    env: {
      ...(options.env ?? {}),
      HOME: paths.homeDir,
      OMP_AUTH_BROKER_SNAPSHOT_CACHE: paths.authBrokerSnapshotPath,
      PI_CODING_AGENT_DIR: paths.agentDir,
    },
  };
}

export async function ensureRuntime(
  effects: RuntimeEffects,
  options: EnsureRuntimeOptions,
): Promise<RuntimeInfo> {
  const paths = runtimePaths(options);
  assertGarnishOwnedPaths(paths);

  for (const dir of runtimeStorageDirs(paths)) {
    await effects.mkdirp(dir);
  }

  if (!options.forceInstall && (await effects.exists(paths.binaryPath))) {
    const preinstall = await tryVerifyInstalledRuntime(effects, paths);
    if (preinstall?.handshake.status === "ok") {
      return {
        paths,
        version: preinstall.version,
        handshake: preinstall.handshake,
        installPerformed: false,
      };
    }
  }

  await effects.installRuntime({
    version: certifiedVersion,
    release: certifiedRelease,
    paths,
  });

  const verified = await verifyInstalledRuntime(effects, paths);

  return {
    paths,
    version: verified.version,
    handshake: verified.handshake,
    installPerformed: true,
  };
}

export const piHarnessAdapter = {
  id: "pi",
  certifiedVersion,
  release: certifiedRelease,
  runtimePaths,
  ensureRuntime,
  launch: createLaunchSpec,
  handshake,
} as const satisfies HarnessAdapter;

async function tryVerifyInstalledRuntime(
  effects: RuntimeEffects,
  paths: RuntimePaths,
): Promise<Pick<RuntimeInfo, "handshake" | "version"> | undefined> {
  try {
    return await verifyInstalledRuntime(effects, paths);
  } catch {
    return undefined;
  }
}

async function verifyInstalledRuntime(
  effects: RuntimeEffects,
  paths: RuntimePaths,
): Promise<Pick<RuntimeInfo, "handshake" | "version">> {
  const result = await effects.execFile(paths.binaryPath, ["--version"], {
    cwd: paths.garnishRootDir,
    env: {},
  });

  if (typeof result.exitCode === "number" && result.exitCode !== 0) {
    throw new Error(
      `Certified Pi runtime version check failed with exit code ${result.exitCode}`,
    );
  }

  const versionOutput = `${result.stdout}\n${result.stderr ?? ""}`.trim();
  const version = parseOmpVersion(versionOutput);

  return {
    version,
    handshake: handshake(version ?? versionOutput),
  };
}


function runtimeMismatchDoctor(reportedVersion: string): readonly string[] {
  const readableVersion = reportedVersion.trim().length > 0 ? reportedVersion : "unknown";

  return [
    `Garnish quests are paused because Pi reported ${readableVersion}, but this Garnish release is certified for ${certifiedVersion}.`,
    "Re-run `garnish init` or `garnish doctor` to reinstall the certified Pi runtime before continuing quests.",
    "Launch Pi through Garnish so it uses the certified binary by absolute path instead of an `omp` found on PATH.",
  ];
}

function isUnderRoot(root: string, candidate: string): boolean {
  const resolvedRoot = resolve(root);
  const resolvedCandidate = resolve(candidate);
  const relativePath = relative(resolvedRoot, resolvedCandidate);

  return (
    relativePath === "" ||
    (!relativePath.startsWith("..") && !isAbsolute(relativePath))
  );
}
