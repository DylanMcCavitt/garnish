import { certifiedRelease, certifiedVersion } from "./runtime";

export const adapterContractEventNames = [
  "session_start",
  "context",
  "tool_call",
  "tool_result",
  "agent_end",
  "tool_approval_requested",
  "tool_approval_resolved",
] as const;

export type AdapterContractEventName = (typeof adapterContractEventNames)[number];

export interface AdapterContract {
  readonly harness: "pi";
  readonly binary: "omp";
  readonly certifiedVersion: typeof certifiedVersion;
  readonly versionCommand: readonly ["--version"];
  readonly versionOutput: typeof certifiedRelease.versionOutput;
  readonly eventNames: readonly string[];
  readonly approvalDenial: {
    readonly observableEvent: "tool_approval_resolved";
    readonly approvedField: false;
    readonly absentEvent: "approval_denied";
  };
  readonly isolation: {
    readonly envVar: "PI_CODING_AGENT_DIR";
    readonly isolates: readonly string[];
    readonly doesNotIsolate: readonly string[];
    readonly mitigation: "launch with Garnish-owned HOME when full ~/.omp isolation matters";
  };
}

export const adapterContract = {
  harness: "pi",
  binary: "omp",
  certifiedVersion,
  versionCommand: ["--version"],
  versionOutput: certifiedRelease.versionOutput,
  eventNames: adapterContractEventNames,
  approvalDenial: {
    observableEvent: "tool_approval_resolved",
    approvedField: false,
    absentEvent: "approval_denied",
  },
  isolation: {
    envVar: "PI_CODING_AGENT_DIR",
    isolates: ["sessions", "config", "auth stores"],
    doesNotIsolate: ["~/.omp/logs"],
    mitigation: "launch with Garnish-owned HOME when full ~/.omp isolation matters",
  },
} as const satisfies AdapterContract;

export function assertAdapterContract(contract: AdapterContract = adapterContract): void {
  assertEqual(contract.harness, "pi", "harness id");
  assertEqual(contract.binary, "omp", "runtime binary name");
  assertEqual(contract.certifiedVersion, certifiedVersion, "certified Pi runtime version");
  assertEqual(contract.versionOutput, `omp/${certifiedVersion}`, "version output shape");

  for (const eventName of adapterContractEventNames) {
    if (!contract.eventNames.includes(eventName)) {
      throw new Error(`Adapter contract is missing event ${eventName}`);
    }
  }

  if (contract.eventNames.includes("approval_denied" as AdapterContractEventName)) {
    throw new Error("Adapter contract must not claim an approval_denied event exists");
  }

  assertEqual(
    contract.approvalDenial.observableEvent,
    "tool_approval_resolved",
    "approval denial event",
  );
  assertEqual(contract.approvalDenial.approvedField, false, "approval denial approved flag");
  assertEqual(contract.approvalDenial.absentEvent, "approval_denied", "absent approval event");

  assertEqual(contract.isolation.envVar, "PI_CODING_AGENT_DIR", "agent-dir env var");
  for (const isolatedSurface of ["sessions", "config", "auth stores"] as const) {
    if (!contract.isolation.isolates.includes(isolatedSurface)) {
      throw new Error(`Adapter contract is missing isolated surface ${isolatedSurface}`);
    }
  }
  if (!contract.isolation.doesNotIsolate.includes("~/.omp/logs")) {
    throw new Error("Adapter contract must preserve the OMP logs isolation caveat");
  }
}

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(`Unexpected ${label}: expected ${String(expected)}, got ${String(actual)}`);
  }
}
