import zlib from 'node:zlib';

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/**
 * A `width` x `height` RGB PNG that looks like something (sky / ground gradient, four coloured blocks, a bright sun) with a
 * little deterministic noise, so it is big enough for "the cropped upload is smaller" checks and easy to judge in a screenshot.
 */
export function makePhotoPng(width = 800, height = 600): Buffer {
  const stride = width * 3 + 1;
  const raw = Buffer.alloc(stride * height);
  let seed = 12345;
  const noise = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return (seed >> 16) % 24;
  };
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  for (let y = 0; y < height; y += 1) {
    raw[y * stride] = 0; // filter: none
    for (let x = 0; x < width; x += 1) {
      const o = y * stride + 1 + x * 3;
      const t = y / height;
      let r = t < 0.62 ? 90 + 80 * t : 70 + 60 * (t - 0.62);
      let g = t < 0.62 ? 150 + 60 * t : 130 - 40 * (t - 0.62);
      let b = t < 0.62 ? 230 - 90 * t : 80;
      const qx = x < width / 2 ? 0 : 1;
      const qy = y < height / 2 ? 0 : 1;
      if (Math.abs(x - width / 2) > 12 && Math.abs(y - height / 2) > 12 && x % 160 > 20 && y % 150 > 20) {
        const tint = [[230, 80, 70], [250, 200, 60], [70, 190, 120], [90, 110, 230]][qy * 2 + qx];
        r = (r + tint[0]) / 2;
        g = (g + tint[1]) / 2;
        b = (b + tint[2]) / 2;
      }
      if ((x - width * 0.78) ** 2 + (y - height * 0.2) ** 2 < (height * 0.09) ** 2) [r, g, b] = [255, 240, 150];
      const n = noise();
      raw[o] = clamp(r + n);
      raw[o + 1] = clamp(g + n);
      raw[o + 2] = clamp(b + n);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
