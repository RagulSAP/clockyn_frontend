/** Amount in words, Indian numbering (Thousand, Lakh, Crore) — used on the payslip ("… Rupees Only"). */

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen',
  'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function below1000(n: number): string {
  const parts: string[] = [];
  if (n >= 100) {
    parts.push(`${ONES[Math.floor(n / 100)]} Hundred`);
    n %= 100;
  }
  if (n >= 20) {
    parts.push(TENS[Math.floor(n / 10)]);
    n %= 10;
  }
  if (n > 0) parts.push(ONES[n]);
  return parts.join(' ');
}

/** `numberToWords(125000)` -> `One Lakh Twenty Five Thousand`; `0` -> `Zero`. Negative / non-finite values read `Zero`. */
export function numberToWords(value: number): string {
  let n = Number.isFinite(value) ? Math.floor(value) : 0;
  if (n <= 0) return 'Zero';
  const parts: string[] = [];
  const units: [number, string][] = [
    [10_000_000, 'Crore'],
    [100_000, 'Lakh'],
    [1_000, 'Thousand'],
  ];
  for (const [size, name] of units) {
    if (n >= size) {
      parts.push(`${numberToWords(Math.floor(n / size))} ${name}`);
      n %= size;
    }
  }
  if (n > 0) parts.push(below1000(n));
  return parts.join(' ');
}

/** `{words} Rupees Only` for the whole-rupee part of a net pay (paise ignored). */
export function rupeesInWords(netPay: number): string {
  return `${numberToWords(Math.floor(netPay))} Rupees Only`;
}
