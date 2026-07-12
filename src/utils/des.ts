// Self-contained pure-JS DES implementation, bundled from the verified
// `des.js` npm package (v1.1.0, MIT) by `indutny`, with its two dependencies
// (`minimalistic-assert`, `inherits`) inlined. No native crypto required, so
// it runs on React Native. Used to decrypt JioSaavn's `encrypted_media_url`
// (DES-ECB, key "38346591").
//
// Original sources:
//   https://github.com/indutny/des.js

function assert(val: unknown, msg?: string): void {
  if (!val) throw new Error(msg || "Assertion failed");
}
assert.equal = function assertEqual(l: unknown, r: unknown, msg?: string): void {
  // eslint-disable-next-line eqeqeq
  if (l != r) throw new Error(msg || "Assertion failed: " + l + " != " + r);
};

function inherits(ctor: any, superCtor: any): any {
  ctor.super_ = superCtor;
  ctor.prototype = Object.create(superCtor.prototype, {
    constructor: {
      value: ctor,
      enumerable: false,
      writable: true,
      configurable: true,
    },
  });
  return ctor;
}

// ---------------------------------------------------------------------------
// utils
// ---------------------------------------------------------------------------
const utils = {
  readUInt32BE(bytes: number[] | Uint8Array, off: number): number {
    const res =
      (bytes[0 + off] << 24) |
      (bytes[1 + off] << 16) |
      (bytes[2 + off] << 8) |
      bytes[3 + off];
    return res >>> 0;
  },

  writeUInt32BE(bytes: number[] | Uint8Array, value: number, off: number): void {
    bytes[0 + off] = value >>> 24;
    bytes[1 + off] = (value >>> 16) & 0xff;
    bytes[2 + off] = (value >>> 8) & 0xff;
    bytes[3 + off] = value & 0xff;
  },

  ip(inL: number, inR: number, out: number[], off: number): void {
    let outL = 0;
    let outR = 0;
    for (let i = 6; i >= 0; i -= 2) {
      for (let j = 0; j <= 24; j += 8) { outL <<= 1; outL |= (inR >>> (j + i)) & 1; }
      for (let j = 0; j <= 24; j += 8) { outL <<= 1; outL |= (inL >>> (j + i)) & 1; }
    }
    for (let i = 6; i >= 0; i -= 2) {
      for (let j = 1; j <= 25; j += 8) { outR <<= 1; outR |= (inR >>> (j + i)) & 1; }
      for (let j = 1; j <= 25; j += 8) { outR <<= 1; outR |= (inL >>> (j + i)) & 1; }
    }
    out[off + 0] = outL >>> 0;
    out[off + 1] = outR >>> 0;
  },

  rip(inL: number, inR: number, out: number[], off: number): void {
    let outL = 0;
    let outR = 0;
    for (let i = 0; i < 4; i++) {
      for (let j = 24; j >= 0; j -= 8) {
        outL <<= 1; outL |= (inR >>> (j + i)) & 1;
        outL <<= 1; outL |= (inL >>> (j + i)) & 1;
      }
    }
    for (let i = 4; i < 8; i++) {
      for (let j = 24; j >= 0; j -= 8) {
        outR <<= 1; outR |= (inR >>> (j + i)) & 1;
        outR <<= 1; outR |= (inL >>> (j + i)) & 1;
      }
    }
    out[off + 0] = outL >>> 0;
    out[off + 1] = outR >>> 0;
  },

  pc1(inL: number, inR: number, out: number[], off: number): void {
    let outL = 0;
    let outR = 0;
    for (let i = 7; i >= 5; i--) {
      for (let j = 0; j <= 24; j += 8) { outL <<= 1; outL |= (inR >> (j + i)) & 1; }
      for (let j = 0; j <= 24; j += 8) { outL <<= 1; outL |= (inL >> (j + i)) & 1; }
    }
    for (let j = 0; j <= 24; j += 8) { outL <<= 1; outL |= (inR >> j) & 1; }
    for (let i = 1; i <= 3; i++) {
      for (let j = 0; j <= 24; j += 8) { outR <<= 1; outR |= (inR >> (j + i)) & 1; }
      for (let j = 0; j <= 24; j += 8) { outR <<= 1; outR |= (inL >> (j + i)) & 1; }
    }
    for (let j = 0; j <= 24; j += 8) { outR <<= 1; outR |= (inL >> j) & 1; }
    out[off + 0] = outL >>> 0;
    out[off + 1] = outR >>> 0;
  },

  r28shl(num: number, shift: number): number {
    return ((num << shift) & 0xfffffff) | (num >>> (28 - shift));
  },

  pc2(inL: number, inR: number, out: number[], off: number): void {
    const pc2table = [
      14, 11, 17, 4, 27, 23, 25, 0, 13, 22, 7, 18, 5, 9, 16, 24, 2, 20, 12, 21, 1, 8, 15, 26,
      15, 4, 25, 19, 9, 1, 26, 16, 5, 11, 23, 8, 12, 7, 17, 0, 22, 3, 10, 14, 6, 20, 27, 24,
    ];
    let outL = 0;
    let outR = 0;
    const len = pc2table.length >>> 1;
    for (let i = 0; i < len; i++) { outL <<= 1; outL |= (inL >>> pc2table[i]) & 0x1; }
    for (let i = len; i < pc2table.length; i++) { outR <<= 1; outR |= (inR >>> pc2table[i]) & 0x1; }
    out[off + 0] = outL >>> 0;
    out[off + 1] = outR >>> 0;
  },

  expand(r: number, out: number[], off: number): void {
    let outL = 0;
    let outR = 0;
    outL = ((r & 1) << 5) | (r >>> 27);
    for (let i = 23; i >= 15; i -= 4) { outL <<= 6; outL |= (r >>> i) & 0x3f; }
    for (let i = 11; i >= 3; i -= 4) { outR |= (r >>> i) & 0x3f; outR <<= 6; }
    outR |= ((r & 0x1f) << 1) | (r >>> 31);
    out[off + 0] = outL >>> 0;
    out[off + 1] = outR >>> 0;
  },

  substitute(inL: number, inR: number): number {
    const sTable = [
      14,0,4,15,13,7,1,4,2,14,15,2,11,13,8,1,3,10,10,6,6,12,12,11,5,9,9,5,0,3,7,8,
      4,15,1,12,14,8,8,2,13,4,6,9,2,1,11,7,15,5,12,11,9,3,7,14,3,10,10,0,5,6,0,13,
      15,3,1,13,8,4,14,7,6,15,11,2,3,8,4,14,9,12,7,0,2,1,13,10,12,6,0,9,5,11,10,5,
      0,13,14,8,7,10,11,1,10,3,4,15,13,4,1,2,5,11,8,6,12,7,6,12,9,0,3,5,2,14,15,9,
      10,13,0,7,9,0,14,9,6,3,3,4,15,6,5,10,1,2,13,8,12,5,7,14,11,12,4,11,2,15,8,1,
      13,1,6,10,4,13,9,0,8,6,15,9,3,8,0,7,11,4,1,15,2,14,12,3,5,11,10,5,14,2,7,12,
      7,13,13,8,14,11,3,5,0,6,6,15,9,0,10,3,1,4,2,7,8,2,5,12,11,1,12,10,4,14,15,9,
      10,3,6,15,9,0,0,6,12,10,11,1,7,13,13,8,15,9,1,4,3,5,14,11,5,12,2,7,8,2,4,14,
      2,14,12,11,4,2,1,12,7,4,10,7,11,13,6,1,8,5,5,0,3,15,15,10,13,3,0,9,14,8,9,6,
      4,11,2,8,1,12,11,7,10,1,13,14,7,2,8,13,15,6,9,15,12,0,5,9,6,10,3,4,0,5,14,3,
      12,10,1,15,10,4,15,2,9,7,2,12,6,9,8,5,0,6,13,1,3,13,4,14,14,0,7,11,5,3,11,8,
      9,4,14,3,15,2,5,12,2,9,8,5,12,15,3,10,7,11,0,14,4,1,10,7,1,6,13,0,11,8,6,13,
      4,13,11,0,2,11,14,7,15,4,0,9,8,1,13,10,3,14,12,3,9,5,7,12,5,2,10,15,6,8,1,6,
      1,6,4,11,11,13,13,8,12,1,3,4,7,10,14,7,10,9,15,5,6,0,8,15,0,14,5,2,9,3,2,12,
      13,1,2,15,8,13,4,8,6,10,15,3,11,7,1,4,10,12,9,5,3,6,14,11,5,0,0,14,12,9,7,2,
      7,2,11,1,4,14,1,7,9,4,12,10,14,8,2,13,0,15,6,12,10,9,13,0,15,3,3,5,5,6,8,11,
    ];
    let out = 0;
    for (let i = 0; i < 4; i++) { const b = (inL >>> (18 - i * 6)) & 0x3f; out <<= 4; out |= sTable[i * 0x40 + b]; }
    for (let i = 0; i < 4; i++) { const b = (inR >>> (18 - i * 6)) & 0x3f; out <<= 4; out |= sTable[4 * 0x40 + i * 0x40 + b]; }
    return out >>> 0;
  },

  permute(num: number): number {
    const permuteTable = [
      16,25,12,11,3,20,4,15,31,17,9,6,27,14,1,22,
      30,24,8,18,0,5,29,23,13,19,2,26,10,21,28,7,
    ];
    let out = 0;
    for (let i = 0; i < permuteTable.length; i++) { out <<= 1; out |= (num >>> permuteTable[i]) & 0x1; }
    return out >>> 0;
  },
};



// ---------------------------------------------------------------------------
// Cipher base
// ---------------------------------------------------------------------------
class Cipher {
  options: any;
  type: string;
  blockSize = 8;
  buffer: number[];
  bufferOff = 0;
  padding: boolean;

  constructor(options: any) {
    this.options = options;
    this.type = this.options.type;
    this.blockSize = 8;
    this._init();
    this.buffer = new Array(this.blockSize);
    this.bufferOff = 0;
    this.padding = options.padding !== false;
  }

  _init(): void {}

  update(data: number[]): number[] {
    if (data.length === 0) return [];
    if (this.type === "decrypt") return this._updateDecrypt(data);
    return this._updateEncrypt(data);
  }

  _buffer(data: number[], off: number): number {
    const min = Math.min(this.buffer.length - this.bufferOff, data.length - off);
    for (let i = 0; i < min; i++) this.buffer[this.bufferOff + i] = data[off + i];
    this.bufferOff += min;
    return min;
  }

  _flushBuffer(out: number[], off: number): number {
    this._update(this.buffer, 0, out, off);
    this.bufferOff = 0;
    return this.blockSize;
  }

  _updateEncrypt(data: number[]): number[] {
    let inputOff = 0;
    let outputOff = 0;

    const count = ((this.bufferOff + data.length) / this.blockSize) | 0;
    const out = new Array(count * this.blockSize);

    if (this.bufferOff !== 0) {
      inputOff += this._buffer(data, inputOff);
      if (this.bufferOff === this.buffer.length) outputOff += this._flushBuffer(out, outputOff);
    }

    const max = data.length - ((data.length - inputOff) % this.blockSize);
    for (; inputOff < max; inputOff += this.blockSize) {
      this._update(data, inputOff, out, outputOff);
      outputOff += this.blockSize;
    }

    for (; inputOff < data.length; inputOff++, this.bufferOff++) {
      this.buffer[this.bufferOff] = data[inputOff];
    }

    return out;
  }

  _updateDecrypt(data: number[]): number[] {
    let inputOff = 0;
    let outputOff = 0;

    let count = Math.ceil((this.bufferOff + data.length) / this.blockSize) - 1;
    const out = new Array(count * this.blockSize);

    for (; count > 0; count--) {
      inputOff += this._buffer(data, inputOff);
      outputOff += this._flushBuffer(out, outputOff);
    }

    inputOff += this._buffer(data, inputOff);

    return out;
  }

  final(buffer?: number[]): number[] {
    const first = buffer ? this.update(buffer) : [];
    const last = this.type === "encrypt" ? this._finalEncrypt() : this._finalDecrypt();
    if (first.length) return first.concat(last);
    return last;
  }

  _pad(buffer: number[], off: number): boolean {
    if (off === 0) return false;
    while (off < buffer.length) buffer[off++] = 0;
    return true;
  }

  _finalEncrypt(): number[] {
    if (!this._pad(this.buffer, this.bufferOff)) return [];
    const out = new Array(this.blockSize);
    this._update(this.buffer, 0, out, 0);
    return out;
  }

  _unpad(buffer: number[]): number[] {
    return buffer;
  }

  _finalDecrypt(): number[] {
    assert.equal(this.bufferOff, this.blockSize, "Not enough data to decrypt");
    const out = new Array(this.blockSize);
    this._flushBuffer(out, 0);
    return this._unpad(out);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _update(_inp: number[], _inOff: number, _out: number[], _outOff: number): void {
    throw new Error("not implemented");
  }
}

// ---------------------------------------------------------------------------
// DES
// ---------------------------------------------------------------------------
const shiftTable = [
  1, 1, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 1,
];

class DESState {
  tmp = new Array(2);
  keys: number[] | null = null;
}

class DES extends Cipher {
  _desState: DESState;

  constructor(options: any) {
    super(options);
    const state = new DESState();
    this._desState = state;
    this.deriveKeys(state, options.key);
  }

  static create(options: any): DES {
    return new DES(options);
  }

  deriveKeys(state: DESState, key: number[]): void {
    state.keys = new Array(16 * 2);
    assert.equal(key.length, this.blockSize, "Invalid key length");

    const kL = utils.readUInt32BE(key, 0);
    const kR = utils.readUInt32BE(key, 4);

    utils.pc1(kL, kR, state.tmp, 0);
    let l = state.tmp[0];
    let r = state.tmp[1];
    for (let i = 0; i < state.keys.length; i += 2) {
      const shift = shiftTable[i >>> 1];
      l = utils.r28shl(l, shift);
      r = utils.r28shl(r, shift);
      utils.pc2(l, r, state.keys, i);
    }
  }

  _update(inp: number[], inOff: number, out: number[], outOff: number): void {
    const state = this._desState;
    const l = utils.readUInt32BE(inp, inOff);
    const r = utils.readUInt32BE(inp, inOff + 4);

    utils.ip(l, r, state.tmp, 0);
    let left = state.tmp[0];
    let right = state.tmp[1];

    if (this.type === "encrypt") this._encrypt(state, left, right, state.tmp, 0);
    else this._decrypt(state, right, left, state.tmp, 0);

    left = state.tmp[0];
    right = state.tmp[1];

    utils.writeUInt32BE(out, left, outOff);
    utils.writeUInt32BE(out, right, outOff + 4);
  }

  _encrypt(state: DESState, lStart: number, rStart: number, out: number[], off: number): void {
    let l = lStart;
    let r = rStart;
    for (let i = 0; i < state.keys!.length; i += 2) {
      const keyL = state.keys![i];
      const keyR = state.keys![i + 1];
      utils.expand(r, state.tmp, 0);
      const kl = keyL ^ state.tmp[0];
      const kr = keyR ^ state.tmp[1];
      const s = utils.substitute(kl, kr);
      const f = utils.permute(s);
      const t = r;
      r = (l ^ f) >>> 0;
      l = t;
    }
    utils.rip(r, l, out, off);
  }

  _decrypt(state: DESState, lStart: number, rStart: number, out: number[], off: number): void {
    let l = rStart;
    let r = lStart;
    for (let i = state.keys!.length - 2; i >= 0; i -= 2) {
      const keyL = state.keys![i];
      const keyR = state.keys![i + 1];
      utils.expand(l, state.tmp, 0);
      const kl = keyL ^ state.tmp[0];
      const kr = keyR ^ state.tmp[1];
      const s = utils.substitute(kl, kr);
      const f = utils.permute(s);
      const t = l;
      l = (r ^ f) >>> 0;
      r = t;
    }
    utils.rip(l, r, out, off);
  }
}

// ---------------------------------------------------------------------------
// Public helpers for JioSaavn
// ---------------------------------------------------------------------------
function base64ToBytes(b64: string): number[] {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const lookup: Record<string, number> = {};
  for (let i = 0; i < chars.length; i++) lookup[chars[i]] = i;
  const clean = b64.replace(/=+$/, "");
  const bytes: number[] = [];
  let bits = 0;
  let val = 0;
  for (const c of clean) {
    if (!(c in lookup)) continue;
    val = (val << 6) | lookup[c];
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((val >>> bits) & 0xff);
    }
  }
  return bytes;
}

const JIOSAAVN_DES_KEY = "38346591";

/**
 * Decrypt a JioSaavn `encrypted_media_url` (base64 DES-ECB) into a plain
 * audio CDN URL. PKCS5 padding is stripped.
 */
export function decryptSaavnUrl(encrypted: string): string {
  const keyBytes: number[] = [];
  for (let i = 0; i < JIOSAAVN_DES_KEY.length; i++) {
    keyBytes.push(JIOSAAVN_DES_KEY.charCodeAt(i) & 0xff);
  }

  let input = base64ToBytes(encrypted);
  // DES operates on 8-byte blocks; pad with zeros if needed.
  while (input.length % 8 !== 0) input.push(0);

  const cipher = DES.create({ key: keyBytes, type: "decrypt", padding: true });
  const decrypted = cipher.final(input);

  let s = "";
  for (let i = 0; i < decrypted.length; i++) s += String.fromCharCode(decrypted[i]);
  return s;
}

export { DES };

export const desKey = JIOSAAVN_DES_KEY;
