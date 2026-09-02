const currencyTokens = [
  "$", "€", "£", "¥", "₹", "₩", "₽",
  "USD", "EUR", "GBP", "JPY", "CAD", "AUD", "NZD", "CHF", "CNY", "RMB", "INR", "KRW",
] as const;

const currencyPattern = currencyTokens
  .map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  .join("|");

const amountPattern = "\\d(?:[\\d,.\\s]*\\d)?(?:\\s?[kKmM])?";
const specifiedBudgetPattern = new RegExp(
  `(?:${currencyPattern})\\s*${amountPattern}|${amountPattern}\\s*(?:${currencyPattern})`,
  "i",
);

export function hasSpecifiedBudget(label: string) {
  return specifiedBudgetPattern.test(label);
}

export function formatCurrencyAmount(amount: number, currency?: string) {
  if (!Number.isFinite(amount)) return null;

  const normalizedCurrency = currency?.trim().toUpperCase();
  if (normalizedCurrency && /^[A-Z]{3}$/.test(normalizedCurrency)) {
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: normalizedCurrency,
        currencyDisplay: "code",
        maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
      }).format(amount).replace(/\u00a0/g, " ");
    } catch {
      // Fall through to a neutral amount for unknown ISO-like codes.
    }
  }

  return `${normalizedCurrency || "Salary"} ${amount.toLocaleString("en-US")}`;
}
