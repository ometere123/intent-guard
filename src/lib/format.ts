/** Presentation helpers. Nothing here decides anything; it only prints. */

const WEI = 1_000_000_000_000_000_000n;

/** Prints a wei-scaled decimal string as GEN, without floating point. */
export function formatGen(wei: string | undefined): string {
  if (!wei) return "0 GEN";
  let value: bigint;
  try {
    value = BigInt(wei);
  } catch {
    return `${wei} GEN`;
  }
  const whole = value / WEI;
  const fraction = value % WEI;
  if (fraction === 0n) return `${whole.toLocaleString("en-US")} GEN`;
  const decimals = fraction.toString().padStart(18, "0").replace(/0+$/, "").slice(0, 4);
  return `${whole.toLocaleString("en-US")}.${decimals} GEN`;
}

export function genToWei(amount: string): bigint {
  const trimmed = (amount ?? "").trim();
  if (!trimmed) return 0n;
  const [whole, fraction = ""] = trimmed.split(".");
  const padded = (fraction + "000000000000000000").slice(0, 18);
  return BigInt(whole || "0") * WEI + BigInt(padded || "0");
}

/** An integer-string u256 printed with thousands separators. */
export function formatCount(value: string | undefined): string {
  if (!value) return "0";
  try {
    return BigInt(value).toLocaleString("en-US");
  } catch {
    return value;
  }
}

export function shortenHex(value: string | undefined, head = 6, tail = 4): string {
  if (!value) return "—";
  const trimmed = value.trim();
  if (trimmed.length <= head + tail + 2) return trimmed;
  return `${trimmed.slice(0, head)}…${trimmed.slice(-tail)}`;
}

export function displayTime(value: string | undefined): string {
  if (!value) return "not recorded";
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return value;
  return new Date(parsed).toISOString().replace("T", " ").slice(0, 16) + "Z";
}

/** Citation marks. Real numbers doing real work: clause ① authorises action ①. */
const MARKS = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩"];

export function citationMark(index: number): string {
  return MARKS[index] ?? `(${index + 1})`;
}

/** Screen-reader form of a citation mark, since ① is read inconsistently. */
export function citationWord(index: number): string {
  return `action ${index + 1}`;
}

export function toIndex(value: string | number | undefined): number {
  if (value === undefined) return 0;
  if (typeof value === "number") return value;
  try {
    return Number(BigInt(value));
  } catch {
    return 0;
  }
}

/** Splits a mandate's markdown into readable paragraphs, keeping order. */
export function mandateParagraphs(markdown: string): string[] {
  return markdown
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
}

/** The first markdown heading, the same deterministic rule the contract uses. */
export function extractTitle(markdown: string): string {
  for (const line of markdown.split("\n")) {
    const match = /^#{1,6}\s+(.*)$/.exec(line.trim());
    if (match) return match[1].trim();
  }
  return "";
}

/** Strips the leading hashes off a stored `mandate_title` for display. */
export function titleText(title: string): string {
  return (title ?? "").replace(/^#+\s*/, "").trim();
}
