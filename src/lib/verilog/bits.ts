// 3-state(0/1/x) 비트 벡터 유틸. 항상 MSB..LSB 순서 배열로 표현한다.
export type Bit = 0 | 1 | "x";

export function widthOf(bits: Bit[]): number {
  return bits.length;
}

export function extendTo(bits: Bit[], width: number): Bit[] {
  if (bits.length === width) return bits;
  if (bits.length > width) return bits.slice(bits.length - width);
  const pad: Bit = 0;
  return Array(width - bits.length).fill(pad).concat(bits);
}

export function zeros(width: number): Bit[] {
  return Array(width).fill(0) as Bit[];
}

export function xs(width: number): Bit[] {
  return Array(width).fill("x") as Bit[];
}

export function bitsEqual(a: Bit[], b: Bit[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

export function toUnsigned(bits: Bit[]): number | null {
  let v = 0;
  for (const b of bits) {
    if (b === "x") return null;
    v = v * 2 + b;
  }
  return v;
}

export function fromUnsigned(value: number, width: number): Bit[] {
  const bits: Bit[] = [];
  for (let b = width - 1; b >= 0; b--) bits.push(((value >> b) & 1) as Bit);
  return bits;
}

function binOp(a: Bit[], b: Bit[], f: (x: Bit, y: Bit) => Bit): Bit[] {
  const w = Math.max(a.length, b.length);
  const ae = extendTo(a, w);
  const be = extendTo(b, w);
  const out: Bit[] = [];
  for (let i = 0; i < w; i++) out.push(f(ae[i], be[i]));
  return out;
}

export function bitAnd(a: Bit[], b: Bit[]): Bit[] {
  return binOp(a, b, (x, y) => {
    if (x === 0 || y === 0) return 0;
    if (x === "x" || y === "x") return "x";
    return 1;
  });
}

export function bitOr(a: Bit[], b: Bit[]): Bit[] {
  return binOp(a, b, (x, y) => {
    if (x === 1 || y === 1) return 1;
    if (x === "x" || y === "x") return "x";
    return 0;
  });
}

export function bitXor(a: Bit[], b: Bit[]): Bit[] {
  return binOp(a, b, (x, y) => {
    if (x === "x" || y === "x") return "x";
    return (x ^ y) as Bit;
  });
}

export function bitXnor(a: Bit[], b: Bit[]): Bit[] {
  return bitXor(a, b).map((v) => (v === "x" ? "x" : v === 0 ? 1 : 0)) as Bit[];
}

export function bitAdd(a: Bit[], b: Bit[]): Bit[] {
  const w = Math.max(a.length, b.length);
  const av = toUnsigned(a);
  const bv = toUnsigned(b);
  if (av === null || bv === null) return xs(w);
  return fromUnsigned((av + bv) % (1 << w), w);
}

export function bitSub(a: Bit[], b: Bit[]): Bit[] {
  const w = Math.max(a.length, b.length);
  const av = toUnsigned(a);
  const bv = toUnsigned(b);
  if (av === null || bv === null) return xs(w);
  const mod = 1 << w;
  const result = ((av - bv) % mod + mod) % mod;
  return fromUnsigned(result, w);
}

export function bitNot(a: Bit[]): Bit[] {
  return a.map((v) => (v === "x" ? "x" : v === 0 ? 1 : 0)) as Bit[];
}

export function reduceAnd(a: Bit[]): Bit {
  let hasX = false;
  for (const b of a) {
    if (b === 0) return 0;
    if (b === "x") hasX = true;
  }
  return hasX ? "x" : 1;
}

export function reduceOr(a: Bit[]): Bit {
  let hasX = false;
  for (const b of a) {
    if (b === 1) return 1;
    if (b === "x") hasX = true;
  }
  return hasX ? "x" : 0;
}

export function reduceXor(a: Bit[]): Bit {
  let v = 0;
  for (const b of a) {
    if (b === "x") return "x";
    v ^= b;
  }
  return v as Bit;
}

export function isAllOnes(a: Bit[]): boolean {
  return a.every((b) => b === 1);
}

export function bitsToString(a: Bit[]): string {
  return a.map((b) => (b === "x" ? "x" : String(b))).join("");
}

export function bitsToHex(a: Bit[]): string {
  let out = "";
  for (let i = 0; i < a.length; i += 4) {
    const nibble = a.slice(i, i + 4);
    if (nibble.some((b) => b === "x")) {
      out += "x";
      continue;
    }
    let v = 0;
    for (const b of nibble) v = v * 2 + (b as number);
    out += v.toString(16);
  }
  return out;
}
