import assert from "node:assert/strict";
import { test } from "node:test";
import { getSnapshotPriceErrors } from "./snapshot-validation";

const positions = [
  { ticker: "BTC-USD", shares: 0.2 },
  { ticker: "SOL-USD", shares: 4 },
  { ticker: "XRP-USD", shares: 100 },
  { ticker: "MSFT", shares: 2 },
  { ticker: "USDC-USD", shares: 50 },
];
const complete = {
  "BTC-USD": { price: 82000, change: 0 },
  "SOL-USD": { price: 106, change: 0 },
  "XRP-USD": { price: 1.34, change: 0 },
  MSFT: { price: 539, change: 0 },
  "USDC-USD": { price: 1, change: 0 },
};

test("rejects the incident: stock and stable quotes present, crypto feed absent", () => {
  const partial = { MSFT: complete.MSFT, "USDC-USD": complete["USDC-USD"] };
  const errors = getSnapshotPriceErrors(positions, partial, 0.89);
  assert.equal(errors.length, 3);
  for (const ticker of ["BTC-USD", "SOL-USD", "XRP-USD"]) {
    assert.ok(errors.some((e) => e.startsWith(ticker + ":")));
  }
  // A different owner with only stocks and cash can still save.
  assert.deepEqual(getSnapshotPriceErrors(positions.slice(3), partial, 0.89), []);
});

test("accepts complete prices and previously saved quotes merged by UPDATE", () => {
  assert.deepEqual(getSnapshotPriceErrors(positions, complete, 0.89), []);
  const merged = { ...complete, MSFT: { price: 540, change: 1 } };
  assert.deepEqual(getSnapshotPriceErrors(positions, merged, 0.89), []);
});

test("rejects zero, negative and nonfinite quotes even with a previous valuation", () => {
  for (const price of [0, -1, NaN, Infinity]) {
    const invalid = { ...complete, "BTC-USD": { price, change: 0 } };
    assert.equal(getSnapshotPriceErrors(positions, invalid, 0.89).length, 1);
  }
});

test("rejects unavailable or invalid FX instead of saving a made-up total", () => {
  for (const fx of [0, -1, NaN, Infinity]) {
    assert.deepEqual(getSnapshotPriceErrors(positions, complete, fx), ["USD/EUR inválido"]);
  }
});

test("requires prices for short positions, ignores closed positions and deduplicates tickers", () => {
  assert.deepEqual(getSnapshotPriceErrors([{ ticker: "SOLD", shares: 0 }], {}, 0.89), []);
  const shorts = [{ ticker: "MSFT", shares: -1 }, { ticker: "MSFT", shares: 2 }];
  assert.equal(getSnapshotPriceErrors(shorts, {}, 0.89).length, 1);
});

test("allows a cash-only portfolio without market quotes", () => {
  assert.deepEqual(getSnapshotPriceErrors([], {}, 0.89), []);
});
