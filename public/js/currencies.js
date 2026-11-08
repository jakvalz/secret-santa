/** Keep in sync with netlify/lib/currencies.js */
export const CURRENCIES = [
  { code: "USD", label: "US Dollar ($)" },
  { code: "EUR", label: "Euro (€)" },
  { code: "GBP", label: "British Pound (£)" },
  { code: "CAD", label: "Canadian Dollar (CA$)" },
  { code: "MXN", label: "Mexican Peso (MX$)" },
  { code: "COP", label: "Colombian Peso (COL$)" },
  { code: "ARS", label: "Argentine Peso (AR$)" },
  { code: "CLP", label: "Chilean Peso (CLP$)" },
  { code: "PEN", label: "Peruvian Sol (S/)" },
  { code: "BRL", label: "Brazilian Real (R$)" },
  { code: "UYU", label: "Uruguayan Peso ($U)" },
  { code: "CRC", label: "Costa Rican Colón (₡)" },
  { code: "DOP", label: "Dominican Peso (RD$)" },
  { code: "GTQ", label: "Guatemalan Quetzal (Q)" },
  { code: "AUD", label: "Australian Dollar (A$)" },
  { code: "NZD", label: "New Zealand Dollar (NZ$)" },
  { code: "CHF", label: "Swiss Franc (CHF)" },
  { code: "JPY", label: "Japanese Yen (¥)" },
  { code: "INR", label: "Indian Rupee (₹)" },
  { code: "PHP", label: "Philippine Peso (₱)" },
];

export function currencyOptionsHtml(selected = "USD") {
  return CURRENCIES.map(
    (c) =>
      `<option value="${c.code}" ${c.code === selected ? "selected" : ""}>${c.code} — ${c.label}</option>`
  ).join("");
}

export function formatBudget(budget, lang = "en") {
  if (!budget?.amount || !budget?.currency) return "";
  try {
    return new Intl.NumberFormat(lang === "es" ? "es" : "en", {
      style: "currency",
      currency: budget.currency,
      maximumFractionDigits: 2,
    }).format(budget.amount);
  } catch {
    return `${budget.amount} ${budget.currency}`;
  }
}
