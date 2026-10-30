import { formatUnits, getAddress, isAddress, parseUnits } from "viem";

export const number = (value: string | number | undefined, digits = 0) =>
  value === undefined
    ? "—"
    : new Intl.NumberFormat("en-US", {
        maximumFractionDigits: digits,
        minimumFractionDigits: digits,
      }).format(Number(value));
export const short = (address: string) =>
  `${address.slice(0, 6)}…${address.slice(-4)}`;
export const explorer = (hash: string) =>
  `https://sepolia.etherscan.io/tx/${hash}`;
export const tokenNumber = (
  value: string | bigint | undefined,
  decimals = 18,
  digits = 2,
) =>
  value === undefined
    ? "—"
    : number(formatUnits(BigInt(value), decimals), digits);
export const validRecipient = (value: string) =>
  isAddress(value, { strict: false }) &&
  !/^0x0{40}$/i.test(value) &&
  !/^0x0{36}dead$/i.test(value);
export const checksum = (value: string) => getAddress(value.toLowerCase());
export function accentIsReadable(color: string): boolean {
  if (!/^#[0-9a-f]{6}$/i.test(color)) return false;
  const luminance = (hex: string) => {
    const channels = [1, 3, 5]
      .map((index) => parseInt(hex.slice(index, index + 2), 16) / 255)
      .map((channel) =>
        channel <= 0.04045
          ? channel / 12.92
          : ((channel + 0.055) / 1.055) ** 2.4,
      );
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const [light, dark] = [luminance(color), luminance("#0f0f12")].sort(
    (a, b) => b - a,
  );
  return (light + 0.05) / (dark + 0.05) >= 4.5;
}

export function amountUnits(value: string, decimals: number): bigint {
  if (!/^\d+(\.\d+)?$/.test(value.trim()))
    throw new Error("Enter an amount greater than 0.");
  const fraction = value.trim().split(".")[1] ?? "";
  if (fraction.length > decimals)
    throw new Error(`Use up to ${decimals} decimal places.`);
  const units = parseUnits(value.trim(), decimals);
  if (units <= 0n) throw new Error("Enter an amount greater than 0.");
  if (units >= 2n ** 256n) throw new Error("Enter a smaller amount.");
  return units;
}

export function friendlyError(error: unknown): string {
  const e = error as {
    code?: number;
    message?: string;
    shortMessage?: string;
    cause?: unknown;
  };
  if (e?.code === 4001 || /reject|denied/i.test(e?.message ?? ""))
    return "Request declined in your wallet. Nothing was sent. You can try again.";
  if (e?.cause) {
    const message = friendlyError(e.cause);
    if (
      message !==
      "Unable to complete the request. Check your connection and try again."
    )
      return message;
  }
  if (/insufficient funds|gas|balance/i.test(e?.message ?? ""))
    return "Insufficient balance. You need enough SQK for the tip and Sepolia ETH for gas.";
  if (/chain|network/i.test(e?.message ?? ""))
    return "Switch your wallet to Ethereum Sepolia, then try again.";
  return "Unable to complete the request. Check your connection and try again.";
}

export const relativeTime = (timestamp: string, now = Date.now()) => {
  const seconds = Math.max(
    0,
    Math.floor((now - new Date(timestamp).getTime()) / 1000),
  );
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
};
