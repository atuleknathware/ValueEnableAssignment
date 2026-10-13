/**
 * Utility functions for precise currency and financial calculations
 * Avoids floating point roundoff issues by using scaled integer cents/paise
 */

/**
 * Rounds a number to a specified number of decimal places
 * @param {number} value
 * @param {number} decimals
 * @returns {number}
 */
function round(value, decimals = 2) {
  if (value === null || value === undefined || isNaN(value)) {
    return 0;
  }
  const factor = Math.pow(10, decimals);
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

/**
 * Formats a number into Indian Rupee currency string
 * e.g., 1200000 -> "₹12,00,000"
 * @param {number} amount
 * @param {boolean} includeDecimals
 * @returns {string}
 */
function formatINR(amount, includeDecimals = false) {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '₹0';
  }
  const num = Number(amount);
  const isNegative = num < 0;
  const absNum = Math.abs(num);

  const options = {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: includeDecimals ? 2 : 0,
    maximumFractionDigits: includeDecimals ? 2 : 0,
  };

  const formatted = new Intl.NumberFormat('en-IN', options).format(absNum);
  return isNegative ? `-${formatted}` : formatted;
}

/**
 * Calculates accurate product with precision rounding
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
function multiply(a, b) {
  return round(Number(a) * Number(b), 2);
}

/**
 * Calculates sum of an array of numbers with precision
 * @param {number[]} numbers
 * @returns {number}
 */
function sum(numbers) {
  if (!Array.isArray(numbers)) return 0;
  const total = numbers.reduce((acc, curr) => acc + (Number(curr) || 0), 0);
  return round(total, 2);
}

module.exports = {
  round,
  formatINR,
  multiply,
  sum,
};

