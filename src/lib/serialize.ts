/**
 * Recursively converts Prisma-specific types to plain JSON-safe values:
 *   Decimal  → number
 *   BigInt   → number
 *   Date     → ISO string
 *
 * Safe to use on arrays, nested objects, and pagination wrappers.
 */
export function serializePrisma<T>(data: T): T {
  if (data === null || data === undefined) return data;

  // Decimal (Prisma) — has a toNumber() method and constructor name "Decimal" or "Decimal2"
  if (
    typeof data === "object" &&
    data !== null &&
    /^Decimal/.test(
      (data as unknown as { constructor: { name: string } }).constructor?.name ?? ""
    )
  ) {
    return parseFloat((data as unknown as { toString(): string }).toString()) as unknown as T;
  }

  // BigInt
  if (typeof data === "bigint") {
    return Number(data) as unknown as T;
  }

  // Date
  if (data instanceof Date) {
    return data.toISOString() as unknown as T;
  }

  // Array
  if (Array.isArray(data)) {
    return data.map(serializePrisma) as unknown as T;
  }

  // Plain object
  if (typeof data === "object") {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(data as object)) {
      result[key] = serializePrisma((data as Record<string, unknown>)[key]);
    }
    return result as T;
  }

  return data;
}
