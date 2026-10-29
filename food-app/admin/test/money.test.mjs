import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMoney, formatMoney } from '../src/money.js';

test('entry turns AED text into fils without rounding errors', () => {
  assert.equal(parseMoney('12.50', 2), 1250);
  assert.equal(parseMoney('0.1', 2), 10);
  assert.equal(parseMoney('7', 2), 700);
  assert.equal(parseMoney('1,234.05', 2), 123405);
  assert.equal(parseMoney('12.345', 2), null, 'too many decimals for AED');
  assert.equal(parseMoney('abc', 2), null);
  assert.equal(parseMoney('12.345', 3), 12345, 'OMR has three decimals');
});

test('display groups thousands and keeps the currency code', () => {
  assert.equal(formatMoney(123405, 2, 'AED'), 'AED 1,234.05');
  assert.equal(formatMoney(5, 2, 'AED'), 'AED 0.05');
});
