export type TokenType =
  | "ident"
  | "number"
  | "keyword"
  | "punct"
  | "eof";

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  col: number;
}

const KEYWORDS = new Set([
  "module", "endmodule", "input", "output", "wire", "reg",
  "assign", "always", "begin", "end", "if", "else", "case", "endcase",
  "default", "posedge", "negedge",
  "and", "or", "not", "nand", "nor", "xor", "xnor", "buf",
  "parameter", "initial",
]);

const PUNCT_MULTI = [
  "<=", "==", "!=", "&&", "||", "~^", "^~", "<<", ">>",
];

export class TokenizeError extends Error {
  line: number;
  col: number;
  constructor(message: string, line: number, col: number) {
    super(message);
    this.line = line;
    this.col = col;
  }
}

export function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let line = 1;
  let col = 1;
  const n = src.length;

  function advance(count = 1) {
    for (let k = 0; k < count; k++) {
      if (src[i] === "\n") {
        line++;
        col = 1;
      } else {
        col++;
      }
      i++;
    }
  }

  while (i < n) {
    const c = src[i];

    // whitespace
    if (c === " " || c === "\t" || c === "\r" || c === "\n") {
      advance();
      continue;
    }

    // line comment
    if (c === "/" && src[i + 1] === "/") {
      while (i < n && src[i] !== "\n") advance();
      continue;
    }

    // block comment
    if (c === "/" && src[i + 1] === "*") {
      const startLine = line;
      const startCol = col;
      advance(2);
      let closed = false;
      while (i < n) {
        if (src[i] === "*" && src[i + 1] === "/") {
          advance(2);
          closed = true;
          break;
        }
        advance();
      }
      if (!closed) throw new TokenizeError("닫히지 않은 블록 주석", startLine, startCol);
      continue;
    }

    const startLine = line;
    const startCol = col;

    // identifiers / keywords
    if (/[a-zA-Z_]/.test(c)) {
      let j = i;
      while (j < n && /[a-zA-Z0-9_$]/.test(src[j])) j++;
      const word = src.slice(i, j);
      advance(j - i);
      tokens.push({
        type: KEYWORDS.has(word) ? "keyword" : "ident",
        value: word,
        line: startLine,
        col: startCol,
      });
      continue;
    }

    // numbers: 4'b1010, 8'hFF, 3'd5, 12, 2'b01
    if (/[0-9]/.test(c)) {
      let j = i;
      while (j < n && /[0-9]/.test(src[j])) j++;
      // sized literal like 4'b1010
      if (src[j] === "'") {
        let k = j + 1;
        // optional signed marker (s) - skip if present
        if (src[k] === "s" || src[k] === "S") k++;
        const base = src[k];
        if (!/[bBhHdDoO]/.test(base)) {
          throw new TokenizeError(`알 수 없는 진법 지정자 '${base}'`, line, col);
        }
        k++;
        let m = k;
        while (m < n && /[0-9a-fA-FxXzZ_]/.test(src[m])) m++;
        const full = src.slice(i, m);
        advance(m - i);
        tokens.push({ type: "number", value: full, line: startLine, col: startCol });
        continue;
      }
      const full = src.slice(i, j);
      advance(j - i);
      tokens.push({ type: "number", value: full, line: startLine, col: startCol });
      continue;
    }

    // multi-char punctuation
    const two = src.slice(i, i + 2);
    if (PUNCT_MULTI.includes(two)) {
      advance(2);
      tokens.push({ type: "punct", value: two, line: startLine, col: startCol });
      continue;
    }

    // single-char punctuation
    if ("()[]{};,.:#@&|^~!?=*+-".includes(c)) {
      advance(1);
      tokens.push({ type: "punct", value: c, line: startLine, col: startCol });
      continue;
    }

    throw new TokenizeError(`알 수 없는 문자 '${c}'`, line, col);
  }

  tokens.push({ type: "eof", value: "", line, col });
  return tokens;
}
