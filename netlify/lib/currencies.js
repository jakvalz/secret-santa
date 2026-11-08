/** ISO 4217 codes offered for gift budget limits. */
export const CURRENCIES = [
  { code: "USD", label: "US Dollar" },
  { code: "EUR", label: "Euro" },
  { code: "GBP", label: "British Pound" },
  { code: "CAD", label: "Canadian Dollar" },
  { code: "MXN", label: "Mexican Peso" },
  { code: "COP", label: "Colombian Peso" },
  { code: "ARS", label: "Argentine Peso" },
  { code: "CLP", label: "Chilean Peso" },
  { code: "PEN", label: "Peruvian Sol" },
  { code: "BRL", label: "Brazilian Real" },
  { code: "UYU", label: "Uruguayan Peso" },
  { code: "CRC", label: "Costa Rican Colón" },
  { code: "DOP", label: "Dominican Peso" },
  { code: "GTQ", label: "Guatemalan Quetzal" },
  { code: "AUD", label: "Australian Dollar" },
  { code: "NZD", label: "New Zealand Dollar" },
  { code: "CHF", label: "Swiss Franc" },
  { code: "JPY", label: "Japanese Yen" },
  { code: "INR", label: "Indian Rupee" },
  { code: "PHP", label: "Philippine Peso" },
];

const CODE_SET = new Set(CURRENCIES.map((c) => c.code));

export function isValidCurrency(code) {
  return CODE_SET.has(String(code || "").toUpperCase());
}

/**
 * Normalize budget from request body.
 * @returns {{ amount: number, currency: string } | null}
 */
export function normalizeBudget(raw) {
  if (raw == null || raw === false || raw === "") return null;
  if (typeof raw === "object" && raw.enabled === false) return null;

  const amount = Number(raw.amount ?? raw);
  const currency = String(raw.currency || "USD").toUpperCase();

  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000) {
    const err = new Error("invalid_budget");
    err.code = "invalid_budget";
    throw err;
  }
  if (!isValidCurrency(currency)) {
    const err = new Error("invalid_currency");
    err.code = "invalid_currency";
    throw err;
  }
  // Keep whole units for JPY-like, otherwise 2 decimals
  const rounded = ["JPY", "CLP", "COP", "KRW"].includes(currency)
    ? Math.round(amount)
    : Math.round(amount * 100) / 100;
  return { amount: rounded, currency };
}
