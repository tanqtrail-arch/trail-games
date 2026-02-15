/**
 * Shared math utilities for fraction games.
 *
 * Provides common fraction operations used across:
 *   - bunsu-yugo (分数融合)
 *   - bunsu-buster (分数バスター)
 *   - bunsu-puzzle (分数カードパズル)
 *
 * All functions are exposed as globals so they can be loaded
 * via a plain <script> tag in each game's HTML.
 */

/** Greatest common divisor (iterative, handles negatives). */
function gcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    var t = b;
    b = a % b;
    a = t;
  }
  return a;
}

/** Least common multiple. */
function lcm(a, b) {
  return Math.abs(a * b) / gcd(a, b);
}

/**
 * Simplify a fraction to lowest terms.
 * Normalises the sign so the denominator is always positive.
 * @param {number} n - numerator
 * @param {number} d - denominator
 * @returns {{n: number, d: number}}
 */
function simplify(n, d) {
  var g = gcd(Math.abs(n), Math.abs(d));
  return { n: (d < 0 ? -1 : 1) * n / g, d: Math.abs(d) / g };
}

/** Check whether a fraction can be simplified further. */
function canSimplify(n, d) {
  return d > 1 && gcd(Math.abs(n), Math.abs(d)) > 1;
}

/** Decimal value of a fraction object {n, d}. */
function fracVal(f) {
  return f.n / f.d;
}

/** Check if two fractions represent the same value. */
function fractionsEqual(a, b) {
  var sa = simplify(a.n, a.d);
  var sb = simplify(b.n, b.d);
  return sa.n === sb.n && sa.d === sb.d;
}

/** True when the fraction equals 1 (n === d, d > 0). */
function isOne(f) {
  return f.n === f.d && f.d > 0;
}

/** True when the fraction is exactly 1/1 (already simplified to 1). */
function isS1(f) {
  return f.n === 1 && f.d === 1;
}

/** How close a fraction is to 1 (0 = far, 1 = exact). */
function prox1(f) {
  return Math.max(0, 1 - Math.abs(1 - fracVal(f)));
}

/**
 * Perform an arithmetic operation on two fractions.
 * @param {{n:number, d:number}} a
 * @param {{n:number, d:number}} b
 * @param {string} op  One of '+', '\u2212' (minus), '\u00d7' (times), '\u00f7' (divide)
 * @returns {{n:number, d:number}|null}  null when the operation is invalid
 */
function fracOp(a, b, op) {
  var rn = 0, rd = 1;
  if (op === '+') {
    var cd = lcm(a.d, b.d);
    rn = a.n * (cd / a.d) + b.n * (cd / b.d);
    rd = cd;
  } else if (op === '\u2212') {
    var cd2 = lcm(a.d, b.d);
    rn = a.n * (cd2 / a.d) - b.n * (cd2 / b.d);
    rd = cd2;
  } else if (op === '\u00d7') {
    rn = a.n * b.n;
    rd = a.d * b.d;
  } else if (op === '\u00f7') {
    if (b.n === 0) return null;
    rn = a.n * b.d;
    rd = a.d * b.n;
  } else {
    return null;
  }
  if (rd === 0) return null;
  if (rd < 0) { rn = -rn; rd = -rd; }
  return { n: rn, d: rd };
}

/** Validate that a fraction result is usable (positive numerator & denominator). */
function fracValid(r) {
  return r !== null && r.d > 0 && r.n > 0;
}
