import { expect, test } from "bun:test";

import {
  adapterContract,
  adapterContractEventNames,
  assertAdapterContract,
  type AdapterContract,
  type AdapterContractEventName,
} from "../../src/adapter/contract";
import { certifiedRelease, certifiedVersion } from "../../src/adapter/runtime";

test("adapter contract pins the Pi runtime metadata, event stream, denial mapping, and logs caveat", () => {
  assertAdapterContract(adapterContract);

  expect(adapterContract).toEqual({
    harness: "pi",
    binary: "omp",
    certifiedVersion,
    versionCommand: ["--version"],
    versionOutput: certifiedRelease.versionOutput,
    eventNames: [
      "session_start",
      "context",
      "tool_call",
      "tool_result",
      "agent_end",
      "tool_approval_requested",
      "tool_approval_resolved",
    ],
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
  });
  expect(adapterContract.certifiedVersion).toBe("16.2.13");
  expect(adapterContractEventNames).toEqual(adapterContract.eventNames);
  expect(adapterContract.eventNames).not.toContain("approval_denied");
});

test("assertAdapterContract rejects contracts that invent an approval_denied event", () => {
  const contractWithInventedEvent: AdapterContract = {
    ...adapterContract,
    eventNames: [
      ...adapterContractEventNames,
      "approval_denied" as AdapterContractEventName,
    ],
  };

  expect(() => assertAdapterContract(contractWithInventedEvent)).toThrow(
    "approval_denied event",
  );
});

test("assertAdapterContract rejects contracts that drop the OMP logs isolation caveat", () => {
  const contractWithoutLogsCaveat: AdapterContract = {
    ...adapterContract,
    isolation: {
      ...adapterContract.isolation,
      doesNotIsolate: [],
    },
  };

  expect(() => assertAdapterContract(contractWithoutLogsCaveat)).toThrow(
    "OMP logs isolation caveat",
  );
});
