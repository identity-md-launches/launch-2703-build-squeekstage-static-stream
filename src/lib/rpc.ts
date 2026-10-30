import { encodeFunctionData, erc20Abi, type Address, type Hex } from "viem";
import { amountUnits, checksum, validRecipient } from "./format";

export const CHAIN_ID = 11155111;
export const RPC_URLS = [
  "https://ethereum-sepolia-rpc.publicnode.com",
  "https://1rpc.io/sepolia",
];
export const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const verified = new Set<string>();
let requestId = 0;
async function call(
  url: string,
  method: string,
  params: unknown[],
): Promise<any> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++requestId, method, params }),
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error("Public RPC unavailable");
  const body = await response.json();
  if (body.error || body.result === undefined)
    throw new Error(body.error?.message ?? "Invalid RPC response");
  return body.result;
}
export async function rpc<T = any>(
  method: string,
  params: unknown[] = [],
): Promise<T> {
  for (const url of RPC_URLS) {
    try {
      if (!verified.has(url)) {
        if (Number(BigInt(await call(url, "eth_chainId", []))) !== CHAIN_ID)
          throw new Error("Unexpected RPC chain");
        verified.add(url);
      }
      return (await call(url, method, params)) as T;
    } catch {
      /* Try the independent public endpoint. */
    }
  }
  throw new Error("Public Sepolia RPC is unavailable. Retrying automatically.");
}
export interface TransferLog {
  address: string;
  topics: string[];
  data: Hex;
  blockNumber: Hex;
  blockHash: Hex;
  transactionHash: Hex;
  logIndex: Hex;
  removed?: boolean;
}
export interface Tip {
  id: string;
  sender: string;
  amount: bigint;
  hash: Hex;
  block: number;
  blockHash: Hex;
}
export const recipientTopic = (address: string) =>
  `0x${address.toLowerCase().slice(2).padStart(64, "0")}`;
export function logChunks(from: number, to: number): [number, number][] {
  const ranges: [number, number][] = [];
  for (let start = from; start <= to; start += 2000)
    ranges.push([start, Math.min(start + 1999, to)]);
  return ranges;
}
export async function fetchTips(
  token: Address,
  recipient: string,
  from: number,
  to: number,
): Promise<Tip[]> {
  if (!validRecipient(recipient)) return [];
  const chunks = await Promise.all(
    logChunks(from, to).map(async ([start, end]) => {
      const logs = await rpc<TransferLog[]>("eth_getLogs", [
        {
          address: token,
          fromBlock: `0x${start.toString(16)}`,
          toBlock: `0x${end.toString(16)}`,
          topics: [TRANSFER_TOPIC, null, recipientTopic(recipient)],
        },
      ]);
      return logs
        .filter(
          (log) =>
            !log.removed &&
            log.address.toLowerCase() === token.toLowerCase() &&
            log.topics.length === 3 &&
            log.topics[0].toLowerCase() === TRANSFER_TOPIC &&
            log.topics[2].toLowerCase() === recipientTopic(recipient),
        )
        .map((log) => ({
          id: `${log.transactionHash}:${log.logIndex}`,
          sender: checksum(`0x${log.topics[1].slice(-40)}`),
          amount: BigInt(log.data),
          hash: log.transactionHash,
          block: Number(BigInt(log.blockNumber)),
          blockHash: log.blockHash,
        }))
        .filter((tip) => tip.amount > 0n);
    }),
  );
  return [...new Map(chunks.flat().map((tip) => [tip.id, tip])).values()].sort(
    (a, b) => b.block - a.block,
  );
}
export const leaderboard = (tips: Tip[]) => {
  const grouped = new Map<
    string,
    { sender: string; total: bigint; count: number }
  >();
  for (const tip of tips) {
    const previous = grouped.get(tip.sender.toLowerCase());
    grouped.set(tip.sender.toLowerCase(), {
      sender: tip.sender,
      total: (previous?.total ?? 0n) + tip.amount,
      count: (previous?.count ?? 0) + 1,
    });
  }
  return [...grouped.values()].sort((a, b) =>
    a.total === b.total ? 0 : a.total > b.total ? -1 : 1,
  );
};
export function transferRequest(
  token: Address,
  recipient: string,
  amount: string,
  decimals: number,
  sender: Address,
) {
  if (!validRecipient(recipient))
    throw new Error("The streamer needs to set a valid recipient in Setup.");
  const units = amountUnits(amount, decimals);
  return {
    from: sender,
    to: token,
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: "transfer",
      args: [checksum(recipient), units],
    }),
    value: "0x0" as Hex,
    chainId: "0xaa36a7" as Hex,
  };
}
export async function readBalance(
  token: Address,
  owner: Address,
): Promise<bigint> {
  const data = encodeFunctionData({
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [owner],
  });
  return BigInt(await rpc<Hex>("eth_call", [{ to: token, data }, "latest"]));
}
