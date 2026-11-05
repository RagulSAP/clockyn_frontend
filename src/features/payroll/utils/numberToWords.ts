const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
const TEENS = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

/** Indian-system words of a whole number: 125000 -> "One Lakh Twenty Five Thousand", 0 -> "Zero". */
export function numberToWords(value: number): string {
  const n = Math.floor(Number.isFinite(value) ? Math.abs(value) : 0);
  if (n === 0) return 'Zero';
  const words = wordsOf(n);
  return value < 0 ? `Minus ${words}` : words;
}

function wordsOf(n: number): string {
  if (n === 0) return '';
  if (n < 10) return ONES[n];
  if (n < 20) return TEENS[n - 10];
  if (n < 100) return `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ''}`;
  if (n < 1000) return `${ONES[Math.floor(n / 100)]} Hundred${n % 100 ? ` ${wordsOf(n % 100)}` : ''}`;
  if (n < 100000) return `${wordsOf(Math.floor(n / 1000))} Thousand${n % 1000 ? ` ${wordsOf(n % 1000)}` : ''}`;
  if (n < 10000000) return `${wordsOf(Math.floor(n / 100000))} Lakh${n % 100000 ? ` ${wordsOf(n % 100000)}` : ''}`;
  return `${wordsOf(Math.floor(n / 10000000))} Crore${n % 10000000 ? ` ${wordsOf(n % 10000000)}` : ''}`;
}

/** Net pay in words for the payslip preview: `{words} Rupees Only` (paise are dropped, as in v1). */
export function rupeesInWords(netPay: number): string {
  return `${numberToWords(netPay)} Rupees Only`;
}
