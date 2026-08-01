// Genera los íconos de la PWA (public/icons) con los colores de marca.
//
// Sin dependencias: dibuja a mano sobre un buffer RGBA y lo comprime con el
// `zlib` de Node. Son cuatro archivos con la misma marca que `BrandMark`
// (components/atoms/icons.tsx) — degradé primary → accent y la "M" en blanco —
// así que si cambia la paleta, esto se vuelve a correr y no quedan íconos con
// los colores viejos:
//
//   npm run icons
//
// Los colores se toman de `--color-primary` y `--color-accent` del tema claro
// en src/app/globals.css. Están duplicados a propósito: un .mjs de build no
// puede leer los tokens de Tailwind sin arrastrar medio toolchain.

import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const FROM = [0x8a, 0x15, 0x38]; // --color-primary
const TO = [0xb8, 0x45, 0x5f]; // --color-accent

/** Misma "M" que el `path` de BrandMark, en su caja de 48×48. */
const GLYPH = [
  [12, 34], [12, 14], [17.2, 14], [24, 23.6], [30.8, 14], [36, 14], [36, 34],
  [30.8, 34], [30.8, 22.6], [26, 29.4], [22, 29.4], [17.2, 22.6], [17.2, 34],
];

const OUTPUT = [
  // Radio 22.5%: la esquina redondeada que espera Android/iOS para un ícono
  // "any". `apple-icon` va con la misma forma porque iOS no recorta.
  { file: "icon-192.png", size: 192, radius: 0.225, glyph: 1 },
  { file: "icon-512.png", size: 512, radius: 0.225, glyph: 1 },
  { file: "apple-icon-180.png", size: 180, radius: 0.225, glyph: 1 },
  // Maskable: cuadrado a sangre y marca más chica, porque Android recorta la
  // forma que quiera y sólo el 80% central está garantizado.
  { file: "icon-maskable-512.png", size: 512, radius: 0, glyph: 0.76 },
];

const SAMPLES = 4; // 4×4 por pixel: suficiente para que no se vean escalones

function insidePolygon(points, x, y) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function insideRoundedRect(size, radius, x, y) {
  if (x < 0 || y < 0 || x > size || y > size) return false;
  if (radius <= 0) return true;
  // Sólo las cuatro esquinas necesitan el test de distancia.
  const cx = x < radius ? radius : x > size - radius ? size - radius : x;
  const cy = y < radius ? radius : y > size - radius ? size - radius : y;
  if (cx === x || cy === y) return true;
  return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
}

function render({ size, radius, glyph }) {
  const r = radius * size;
  const scale = (size / 48) * glyph;
  // La "M" está centrada en (24,24) dentro de su caja de 48.
  const toGlyph = (v) => (v - size / 2) / scale + 24;

  const rgba = Buffer.alloc(size * size * 4);
  const step = 1 / SAMPLES;
  const offset = step / 2;

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let shape = 0;
      let mark = 0;

      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const x = px + offset + sx * step;
          const y = py + offset + sy * step;
          if (!insideRoundedRect(size, r, x, y)) continue;
          shape += 1;
          if (insidePolygon(GLYPH, toGlyph(x), toGlyph(y))) mark += 1;
        }
      }

      const total = SAMPLES * SAMPLES;
      const i = (py * size + px) * 4;
      if (shape === 0) continue;

      // Degradé en diagonal, como el `linearGradient` de BrandMark.
      const t = (px / size + py / size) / 2;
      const white = mark / total;
      for (let c = 0; c < 3; c++) {
        const base = FROM[c] + (TO[c] - FROM[c]) * t;
        rgba[i + c] = Math.round(base + (255 - base) * white);
      }
      rgba[i + 3] = Math.round((shape / total) * 255);
    }
  }

  return rgba;
}

// --- PNG mínimo (color type 6, 8 bits, sin filtros) ---

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const head = Buffer.alloc(4);
  head.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([head, body, crc]);
}

function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bits por canal
  ihdr[9] = 6; // RGBA
  // Un byte de filtro (0 = None) por scanline, como pide el formato.
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const iconsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");

for (const icon of OUTPUT) {
  writeFileSync(join(iconsDir, icon.file), encodePng(icon.size, render(icon)));
  console.log(`✓ ${icon.file} (${icon.size}×${icon.size})`);
}
