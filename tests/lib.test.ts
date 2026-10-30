import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeFunctionData, erc20Abi } from "viem";
import {
  accentIsReadable,
  amountUnits,
  friendlyError,
  validRecipient,
} from "../src/lib/format";
import {
  logChunks,
  leaderboard,
  recipientTopic,
  transferRequest,
  type Tip,
} from "../src/lib/rpc";
import { ENDPOINTS, normalize } from "../src/lib/data";

// Synthetic addresses are confined to tests; production has no default recipient.
const sender = `0x${"11".repeat(20)}` as const;
const recipient = `0x${"22".repeat(20)}` as const;
const token = `0x${"33".repeat(20)}` as const;

test("amounts retain exact token precision and reject rounding or exponent syntax", () => {
  assert.equal(amountUnits("1", 18), 1000000000000000000n);
  assert.equal(amountUnits("0.000000000000000001", 18), 1n);
  assert.equal(amountUnits("123.456789", 6), 123456789n);
  for (const value of ["0", "-1", "1e18", "NaN", "", "1.0000001"])
    assert.throws(() => amountUnits(value, 6));
  assert.throws(() => amountUnits((2n ** 256n).toString(), 0));
});

test("only a direct, zero-native-value SQK transfer is encoded", () => {
  const tx = transferRequest(token, recipient, "1", 18, sender);
  assert.equal(tx.to, token);
  assert.equal(tx.from, sender);
  assert.equal(tx.value, "0x0");
  assert.equal(tx.chainId, "0xaa36a7");
  const decoded = decodeFunctionData({ abi: erc20Abi, data: tx.data });
  assert.equal(decoded.functionName, "transfer");
  assert.deepEqual(decoded.args, [recipient, 1000000000000000000n]);
  assert.throws(() => transferRequest(token, "", "1", 18, sender));
  assert.equal(validRecipient("0x" + "0".repeat(40)), false);
});

test("6,000-block history uses exactly three non-overlapping 2,000-block chunks", () => {
  assert.deepEqual(logChunks(12000000, 12005999), [
    [12000000, 12001999],
    [12002000, 12003999],
    [12004000, 12005999],
  ]);
  assert.deepEqual(logChunks(8, 7), []);
  assert.deepEqual(logChunks(0, 0), [[0, 0]]);
  assert.equal(recipientTopic(recipient).length, 66);
  assert.equal(recipientTopic(recipient).slice(-40), recipient.slice(2));
});

test("leaderboard sums exact units from the same transfers and sorts descending", () => {
  const base = {
    id: "fixture",
    hash: `0x${"44".repeat(32)}`,
    blockHash: `0x${"55".repeat(32)}`,
    block: 10,
  } as const;
  const tips: Tip[] = [
    { ...base, sender, amount: 1n },
    { ...base, sender: recipient, amount: 10n },
    { ...base, sender, amount: 20n },
  ];
  assert.deepEqual(leaderboard(tips), [
    { sender, total: 21n, count: 2 },
    { sender: recipient, total: 10n, count: 1 },
  ]);
});

test("actual nested Squeekchain schemas normalize without using 7-day sums as lifetime totals", () => {
  const core = normalize(ENDPOINTS.core, {
    core: {
      blockHeight: "4135",
      blockProgress: "35822082",
      settledThroughRound: "540",
    },
    configuration: {
      blockUnitsPerBlock: "1000000000",
      genesisTimestamp: "1793022600",
      roundDuration: "600",
    },
    chain: { chainId: "11155111" },
  });
  assert.ok(
    Math.abs(
      (Number(core.core!.blockProgress) /
        Number(core.core!.blockUnitsPerBlock)) *
        100 -
        3.5822082,
    ) < 1e-12,
  );
  const stats = normalize(ENDPOINTS.stats, {
    lifetime: {
      observedDistanceMm: "40350246",
      acceptedWorkUnits: "45957",
      settlementCount: "497",
      activeDayCount: 4,
    },
    activity: { summary: { observedDistanceMm: "999" } },
  });
  assert.equal(stats.stats!.observedDistanceMm, "40350246");
  assert.throws(() =>
    normalize(ENDPOINTS.core, { core: { blockHeight: "bad" } }),
  );
  assert.throws(() => normalize(ENDPOINTS.core, { chain: { chainId: "1" } }));
  assert.throws(() =>
    normalize(ENDPOINTS.economy, {
      asset: { address: token, symbol: "FAKE", decimals: 18 },
    }),
  );
});

test("wallet rejection and low-funds errors have actionable messages", () => {
  assert.match(friendlyError({ cause: { code: 4001 } }), /declined/);
  assert.match(
    friendlyError({ message: "insufficient funds for gas" }),
    /Sepolia ETH/,
  );
  assert.match(friendlyError({ message: "wrong chain" }), /Sepolia/);
});

test("custom accents retain readable text on the dark panel", () => {
  assert.equal(accentIsReadable("#f2c230"), true);
  assert.equal(accentIsReadable("#5b7cfa"), true);
  assert.equal(accentIsReadable("#35d07f"), true);
  assert.equal(accentIsReadable("#000000"), false);
  assert.equal(accentIsReadable("invalid"), false);
});
