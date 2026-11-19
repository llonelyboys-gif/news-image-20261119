// A tiny deterministic RGB raster + PNG encoder, Node standard library only.
// No network, no clock, no randomness: the same input always writes the same bytes.

import { deflateSync } from 'node:zlib';

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export function rgb(r: number, g: number, b: number): RGB {
  return { r, g, b };
}

// CRC-32 (ISO 3309), table built once from the polynomial.
const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i += 1) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  const crcInput = new Uint8Array(4 + data.length);
  crcInput.set(out.subarray(4, 8 + data.length), 0);
  view.setUint32(8 + data.length, crc32(crcInput));
  return out;
}

export class Canvas {
  readonly width: number;
  readonly height: number;
  private readonly px: Uint8Array;

  constructor(width: number, height: number, bg: RGB) {
    this.width = width;
    this.height = height;
    this.px = new Uint8Array(width * height * 3);
    this.fill(bg);
  }

  fill(c: RGB): void {
    for (let i = 0; i < this.px.length; i += 3) {
      this.px[i] = c.r;
      this.px[i + 1] = c.g;
      this.px[i + 2] = c.b;
    }
  }

  set(x: number, y: number, c: RGB): void {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = (y * this.width + x) * 3;
    this.px[i] = c.r;
    this.px[i + 1] = c.g;
    this.px[i + 2] = c.b;
  }

  rect(x: number, y: number, w: number, h: number, c: RGB): void {
    const x0 = Math.max(0, x);
    const y0 = Math.max(0, y);
    const x1 = Math.min(this.width, x + w);
    const y1 = Math.min(this.height, y + h);
    for (let yy = y0; yy < y1; yy += 1) {
      for (let xx = x0; xx < x1; xx += 1) this.set(xx, yy, c);
    }
  }

  /** 1px outline rectangle. */
  frame(x: number, y: number, w: number, h: number, c: RGB): void {
    this.rect(x, y, w, 1, c);
    this.rect(x, y + h - 1, w, 1, c);
    this.rect(x, y, 1, h, c);
    this.rect(x + w - 1, y, 1, h, c);
  }

  /** 2px outline rectangle. */
  frame2(x: number, y: number, w: number, h: number, c: RGB): void {
    this.frame(x, y, w, h, c);
    this.frame(x + 1, y + 1, w - 2, h - 2, c);
  }

  line(x0: number, y0: number, x1: number, y1: number, c: RGB): void {
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    let x = x0;
    let y = y0;
    for (;;) {
      this.set(x, y, c);
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }
  }

  /** Filled circle. */
  disc(cx: number, cy: number, r: number, c: RGB): void {
    for (let y = -r; y <= r; y += 1) {
      const half = Math.floor(Math.sqrt(r * r - y * y));
      for (let x = -half; x <= half; x += 1) this.set(cx + x, cy + y, c);
    }
  }

  /** Circle outline, 1px. */
  ring(cx: number, cy: number, r: number, c: RGB): void {
    const steps = Math.max(24, r * 6);
    for (let i = 0; i < steps; i += 1) {
      const a = (i / steps) * Math.PI * 2;
      this.set(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), c);
    }
  }

  /** Filled triangle. */
  triangle(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: RGB): void {
    const minX = Math.max(0, Math.min(x0, x1, x2));
    const maxX = Math.min(this.width - 1, Math.max(x0, x1, x2));
    const minY = Math.max(0, Math.min(y0, y1, y2));
    const maxY = Math.min(this.height - 1, Math.max(y0, y1, y2));
    const d = (x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0);
    if (d === 0) return;
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const a = ((x1 - x) * (y2 - y) - (y1 - y) * (x2 - x)) / d;
        const b = ((x2 - x) * (y0 - y) - (y2 - y) * (x0 - x)) / d;
        const cc = 1 - a - b;
        if (a >= 0 && b >= 0 && cc >= 0) this.set(x, y, c);
      }
    }
  }

  /** Encode the raster as a PNG (color type 2, 8-bit RGB). Deterministic bytes. */
  toPNG(): Uint8Array {
    const ihdr = new Uint8Array(13);
    const v = new DataView(ihdr.buffer);
    v.setUint32(0, this.width);
    v.setUint32(4, this.height);
    ihdr[8] = 8; // bit depth
    ihdr[9] = 2; // color type RGB
    ihdr[10] = 0; // compression
    ihdr[11] = 0; // filter
    ihdr[12] = 0; // interlace

    const stride = this.width * 3;
    const raw = new Uint8Array(this.height * (stride + 1));
    for (let y = 0; y < this.height; y += 1) {
      raw[y * (stride + 1)] = 0; // filter: none
      raw.set(this.px.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
    }
    const idat = deflateSync(raw, { level: 9 });

    const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    const parts = [sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', new Uint8Array(0))];
    const total = parts.reduce((n, p) => n + p.length, 0);
    const out = new Uint8Array(total);
    let at = 0;
    for (const p of parts) {
      out.set(p, at);
      at += p.length;
    }
    return out;
  }
}
