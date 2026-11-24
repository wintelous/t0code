import { assert, it } from "@effect/vitest";

import {
  repositoryPathFromRemoteUrl,
  transportSafeSourceControlErrorValue,
} from "./SourceControlProvider.ts";

it("removes URL credentials, query parameters, and fragments from error transport values", () => {
  assert.strictEqual(
    transportSafeSourceControlErrorValue(
      "https://user:secret@example.test/org/repo/pull/42?token=secret#discussion",
    ),
    "https://example.test/org/repo/pull/42",
  );
});

it.each([
  ["git@github.com:T3Tools/t0code.git", "T3Tools/t0code"],
  ["github.com:T3Tools/t0code.git", "T3Tools/t0code"],
  ["gitlab.com:T3Tools/platform/t0code", "T3Tools/platform/t0code"],
  ["https://github.com/T3Tools/t0code.git", "T3Tools/t0code"],
  ["https://github.com/T3Tools/t0code.git?view=compact", "T3Tools/t0code"],
  ["https://github.com/T3Tools/t0code.git#section", "T3Tools/t0code"],
  ["C:/repos/t0code", null],
])("reads the repository path of %s", (remoteUrl, expected) => {
  assert.strictEqual(repositoryPathFromRemoteUrl(remoteUrl), expected);
});
