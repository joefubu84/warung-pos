/**
 * Pure TypeScript RFC 1321 MD5 implementation.
 * Safe in Node.js, Browsers, Deno, and Cloudflare Workers without node:crypto.
 */

function rotateLeft(value: number, shiftBits: number): number {
  return (value << shiftBits) | (value >>> (32 - shiftBits));
}

function addUnsigned(x: number, y: number): number {
  return ((x | 0) + (y | 0)) | 0;
}

function fFunc(x: number, y: number, z: number): number {
  return (x & y) | (~x & z);
}

function gFunc(x: number, y: number, z: number): number {
  return (x & z) | (y & ~z);
}

function hFunc(x: number, y: number, z: number): number {
  return x ^ y ^ z;
}

function iFunc(x: number, y: number, z: number): number {
  return y ^ (x | ~z);
}

function ff(a: number, b: number, c: number, d: number, x: number, s: number, ac: number): number {
  const next = addUnsigned(a, addUnsigned(addUnsigned(fFunc(b, c, d), x), ac));
  return addUnsigned(rotateLeft(next, s), b);
}

function gg(a: number, b: number, c: number, d: number, x: number, s: number, ac: number): number {
  const next = addUnsigned(a, addUnsigned(addUnsigned(gFunc(b, c, d), x), ac));
  return addUnsigned(rotateLeft(next, s), b);
}

function hh(a: number, b: number, c: number, d: number, x: number, s: number, ac: number): number {
  const next = addUnsigned(a, addUnsigned(addUnsigned(hFunc(b, c, d), x), ac));
  return addUnsigned(rotateLeft(next, s), b);
}

function ii(a: number, b: number, c: number, d: number, x: number, s: number, ac: number): number {
  const next = addUnsigned(a, addUnsigned(addUnsigned(iFunc(b, c, d), x), ac));
  return addUnsigned(rotateLeft(next, s), b);
}

function encodeUtf8Bytes(input: string): Uint8Array {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(input);
  }
  const bytes: number[] = [];
  for (let i = 0; i < input.length; i++) {
    let code = input.charCodeAt(i);
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0xd800 || code >= 0xe000) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      i++;
      const low = i < input.length ? input.charCodeAt(i) : 0;
      code = 0x10000 + (((code & 0x3ff) << 10) | (low & 0x3ff));
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    }
  }
  return new Uint8Array(bytes);
}

function convertBytesToWordArray(bytes: Uint8Array): number[] {
  const byteLength = bytes.length;
  const wordBlocks = Math.floor((byteLength + 8) / 64);
  const numberOfWords = (wordBlocks + 1) * 16;
  const words = new Array<number>(numberOfWords).fill(0);

  let byteCount = 0;
  while (byteCount < byteLength) {
    const wordIdx = Math.floor(byteCount / 4);
    const bitOffset = (byteCount % 4) * 8;
    const byteVal = bytes[byteCount] ?? 0;
    words[wordIdx] = (words[wordIdx] ?? 0) | (byteVal << bitOffset);
    byteCount++;
  }

  const endWordIdx = Math.floor(byteCount / 4);
  const endBitOffset = (byteCount % 4) * 8;
  words[endWordIdx] = (words[endWordIdx] ?? 0) | (0x80 << endBitOffset);
  words[numberOfWords - 2] = (byteLength << 3) >>> 0;
  words[numberOfWords - 1] = byteLength >>> 29;

  return words;
}

function wordToHex(value: number): string {
  let out = '';
  for (let i = 0; i <= 3; i++) {
    const byteVal = (value >>> (i * 8)) & 255;
    out += byteVal.toString(16).padStart(2, '0');
  }
  return out;
}

export function md5(input: string): string {
  const words = convertBytesToWordArray(encodeUtf8Bytes(input));

  let a = 0x67452301;
  let b = 0xefcdab89;
  let c = 0x98badcfe;
  let d = 0x10325476;

  const S11 = 7, S12 = 12, S13 = 17, S14 = 22;
  const S21 = 5, S22 = 9, S23 = 14, S24 = 20;
  const S31 = 4, S32 = 11, S33 = 16, S34 = 23;
  const S41 = 6, S42 = 10, S43 = 15, S44 = 21;

  for (let k = 0; k < words.length; k += 16) {
    const aa = a;
    const bb = b;
    const cc = c;
    const dd = d;

    const w = (offset: number): number => words[k + offset] ?? 0;

    a = ff(a, b, c, d, w(0), S11, 0xd76aa478);
    d = ff(d, a, b, c, w(1), S12, 0xe8c7b756);
    c = ff(c, d, a, b, w(2), S13, 0x242070db);
    b = ff(b, c, d, a, w(3), S14, 0xc1bdceee);
    a = ff(a, b, c, d, w(4), S11, 0xf57c0faf);
    d = ff(d, a, b, c, w(5), S12, 0x4787c62a);
    c = ff(c, d, a, b, w(6), S13, 0xa8304613);
    b = ff(b, c, d, a, w(7), S14, 0xfd469501);
    a = ff(a, b, c, d, w(8), S11, 0x698098d8);
    d = ff(d, a, b, c, w(9), S12, 0x8b44f7af);
    c = ff(c, d, a, b, w(10), S13, 0xffff5bb1);
    b = ff(b, c, d, a, w(11), S14, 0x895cd7be);
    a = ff(a, b, c, d, w(12), S11, 0x6b901122);
    d = ff(d, a, b, c, w(13), S12, 0xfd987193);
    c = ff(c, d, a, b, w(14), S13, 0xa679438e);
    b = ff(b, c, d, a, w(15), S14, 0x49b40821);

    a = gg(a, b, c, d, w(1), S21, 0xf61e2562);
    d = gg(d, a, b, c, w(6), S22, 0xc040b340);
    c = gg(c, d, a, b, w(11), S23, 0x265e5a51);
    b = gg(b, c, d, a, w(0), S24, 0xe9b6c7aa);
    a = gg(a, b, c, d, w(5), S21, 0xd62f105d);
    d = gg(d, a, b, c, w(10), S22, 0x02441453);
    c = gg(c, d, a, b, w(15), S23, 0xd8a1e681);
    b = gg(b, c, d, a, w(4), S24, 0xe7d3fbc8);
    a = gg(a, b, c, d, w(9), S21, 0x21e1cde6);
    d = gg(d, a, b, c, w(14), S22, 0xc33707d6);
    c = gg(c, d, a, b, w(3), S23, 0xf4d50d87);
    b = gg(b, c, d, a, w(8), S24, 0x455a14ed);
    a = gg(a, b, c, d, w(13), S21, 0xa9e3e905);
    d = gg(d, a, b, c, w(2), S22, 0xfcefa3f8);
    c = gg(c, d, a, b, w(7), S23, 0x676f02d9);
    b = gg(b, c, d, a, w(12), S24, 0x8d2a4c8a);

    a = hh(a, b, c, d, w(5), S31, 0xfffa3942);
    d = hh(d, a, b, c, w(8), S32, 0x8771f681);
    c = hh(c, d, a, b, w(11), S33, 0x6d9d6122);
    b = hh(b, c, d, a, w(14), S34, 0xfde5380c);
    a = hh(a, b, c, d, w(1), S31, 0xa4beea44);
    d = hh(d, a, b, c, w(4), S32, 0x4bdecfa9);
    c = hh(c, d, a, b, w(7), S33, 0xf6bb4b60);
    b = hh(b, c, d, a, w(10), S34, 0xbebfbc70);
    a = hh(a, b, c, d, w(13), S31, 0x289b7ec6);
    d = hh(d, a, b, c, w(0), S32, 0xeaa127fa);
    c = hh(c, d, a, b, w(3), S33, 0xd4ef3085);
    b = hh(b, c, d, a, w(6), S34, 0x04881d05);
    a = hh(a, b, c, d, w(9), S31, 0xd9d4d039);
    d = hh(d, a, b, c, w(12), S32, 0xe6db99e5);
    c = hh(c, d, a, b, w(15), S33, 0x1fa27cf8);
    b = hh(b, c, d, a, w(2), S34, 0xc4ac5665);

    a = ii(a, b, c, d, w(0), S41, 0xf4292244);
    d = ii(d, a, b, c, w(7), S42, 0x432aff97);
    c = ii(c, d, a, b, w(14), S43, 0xab9423a7);
    b = ii(b, c, d, a, w(5), S44, 0xfc93a039);
    a = ii(a, b, c, d, w(12), S41, 0x655b59c3);
    d = ii(d, a, b, c, w(3), S42, 0x8f0ccc92);
    c = ii(c, d, a, b, w(10), S43, 0xffeff47d);
    b = ii(b, c, d, a, w(1), S44, 0x85845dd1);
    a = ii(a, b, c, d, w(8), S41, 0x6fa87e4f);
    d = ii(d, a, b, c, w(15), S42, 0xfe2ce6e0);
    c = ii(c, d, a, b, w(6), S43, 0xa3014314);
    b = ii(b, c, d, a, w(13), S44, 0x4e0811a1);
    a = ii(a, b, c, d, w(4), S41, 0xf7537e82);
    d = ii(d, a, b, c, w(11), S42, 0xbd3af235);
    c = ii(c, d, a, b, w(2), S43, 0x2ad7d2bb);
    b = ii(b, c, d, a, w(9), S44, 0xeb86d391);

    a = addUnsigned(a, aa);
    b = addUnsigned(b, bb);
    c = addUnsigned(c, cc);
    d = addUnsigned(d, dd);
  }

  return (wordToHex(a) + wordToHex(b) + wordToHex(c) + wordToHex(d)).toLowerCase();
}
