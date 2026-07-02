export type HarnessId = "pi";
export type CertifiedRuntimeVersion = "16.2.13";

export interface CertifiedRuntimeRelease {
  readonly harness: HarnessId;
  readonly binary: "omp";
  readonly version: CertifiedRuntimeVersion;
  readonly versionOutput: `omp/${CertifiedRuntimeVersion}`;
  readonly verifiedAt: "2026-07-01";
  readonly evidenceIssue: "LOO-118";
}

export interface RuntimePathOptions {
  readonly garnishRootDir: string;
  readonly platform?: NodeJS.Platform | string;
}

export interface RuntimePaths {
  readonly garnishRootDir: string;
  readonly runtimeDir: string;
  readonly binDir: string;
  readonly binaryPath: string;
  readonly agentDir: string;
  readonly homeDir: string;
  readonly authBrokerSnapshotPath: string;
}

export interface RuntimeExecOptions {
  readonly cwd?: string;
  readonly env?: Readonly<Record<string, string>>;
}

export interface RuntimeExecResult {
  readonly stdout: string;
  readonly stderr?: string;
  readonly exitCode?: number;
}

export interface InstallRuntimeRequest {
  readonly version: CertifiedRuntimeVersion;
  readonly release: CertifiedRuntimeRelease;
  readonly paths: RuntimePaths;
}

export interface RuntimeEffects {
  readonly exists: (path: string) => boolean | Promise<boolean>;
  readonly mkdirp: (path: string) => void | Promise<void>;
  readonly installRuntime: (request: InstallRuntimeRequest) => void | Promise<void>;
  readonly execFile: (
    file: string,
    args: readonly string[],
    options?: RuntimeExecOptions,
  ) => RuntimeExecResult | Promise<RuntimeExecResult>;
}

export interface EnsureRuntimeOptions extends RuntimePathOptions {
  readonly forceInstall?: boolean;
}

export interface RuntimeInfo {
  readonly paths: RuntimePaths;
  readonly version?: string;
  readonly handshake: VersionHandshake;
  readonly installPerformed: boolean;
}

export interface LaunchOptions {
  readonly args?: readonly string[];
  readonly cwd?: string;
  readonly env?: Readonly<Record<string, string>>;
}

export interface LaunchSpec {
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd?: string;
  readonly env: Readonly<Record<string, string>>;
}

export type VersionHandshake =
  | {
      readonly status: "ok";
      readonly certifiedVersion: CertifiedRuntimeVersion;
      readonly reportedVersion: CertifiedRuntimeVersion;
    }
  | {
      readonly status: "paused";
      readonly certifiedVersion: CertifiedRuntimeVersion;
      readonly reportedVersion: string;
      readonly doctor: readonly string[];
    };

export interface HarnessAdapter {
  readonly id: HarnessId;
  readonly certifiedVersion: CertifiedRuntimeVersion;
  readonly release: CertifiedRuntimeRelease;
  readonly runtimePaths: (options: RuntimePathOptions) => RuntimePaths;
  readonly ensureRuntime: (
    effects: RuntimeEffects,
    options: EnsureRuntimeOptions,
  ) => Promise<RuntimeInfo>;
  readonly launch: (paths: RuntimePaths, options?: LaunchOptions) => LaunchSpec;
  readonly handshake: (reportedVersion: string | undefined) => VersionHandshake;
}
