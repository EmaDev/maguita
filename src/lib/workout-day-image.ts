/** Sólo se usa desde componentes cliente (usa `document`/`canvas` del browser). */

import { splitDetail } from "@/lib/workout-model";

/**
 * Imagen compartible del plan de un día. **No es un screenshot de la
 * pantalla**: se dibuja en un canvas desde cero, y eso es a propósito.
 *
 * Un screenshot del DOM (html2canvas y compañía) traería tres problemas que acá
 * no existen: una dependencia nueva de ~200 KB; el tema del usuario metido en la
 * imagen (una card oscura sobre fondo oscuro es ilegible en el visor de
 * WhatsApp, que no sabe nada de temas); y la fidelidad dudosa de Tailwind v4,
 * que resuelve colores con `oklch()` y variables CSS. Dibujarla a mano cuesta
 * este archivo y a cambio da una pieza diseñada para el destino: fondo claro
 * siempre, ancho fijo, tipografía grande y legible en un chat.
 *
 * Misma técnica que `scripts/generate-icons.mjs` con los íconos de la PWA:
 * cuando la salida es una imagen con un diseño propio, conviene dibujarla.
 */

/* ------------------------------------------------------------------ *
 * Diseño
 *
 * Los colores son los tokens claros de la marca (`globals.css`) escritos a
 * mano: el canvas no lee CSS, y la imagen tiene que verse igual la comparta
 * alguien en claro o en oscuro.
 * ------------------------------------------------------------------ */

const WIDTH = 1080;
const PADDING = 72;

const COLORS = {
  background: "#ffffff",
  band: "#8a1538",
  bandText: "#ffffff",
  bandMuted: "rgba(255, 255, 255, 0.72)",
  foreground: "#1b1013",
  muted: "#6d5a60",
  bullet: "#b09aa1",
  badgeBackground: "rgba(138, 21, 56, 0.10)",
  badgeText: "#8a1538",
  border: "#ebdde1",
};

/** Alto máximo del canvas. iOS Safari corta por área total (~16,7 M px); a 1080 de ancho esto deja 10,8 M, con margen. Si el día se pasa, el diseño se escala en vez de recortarse. */
const MAX_HEIGHT = 10_000;

const NUMBER_SIZE = 46;
const NUMBER_GAP = 26;

interface TextStyle {
  size: number;
  weight: number;
  lineHeight: number;
  color: string;
}

const STYLES = {
  eyebrow: { size: 27, weight: 600, lineHeight: 38, color: COLORS.bandMuted },
  weekday: { size: 64, weight: 700, lineHeight: 74, color: COLORS.bandText },
  dayTitle: { size: 37, weight: 500, lineHeight: 48, color: COLORS.bandText },
  exercise: { size: 37, weight: 600, lineHeight: 48, color: COLORS.foreground },
  movement: { size: 31, weight: 400, lineHeight: 44, color: COLORS.muted },
  footer: { size: 26, weight: 500, lineHeight: 34, color: COLORS.muted },
} satisfies Record<string, TextStyle>;

export interface RoutineDayImageInput {
  /** Nombre de la rutina, como bajada arriba del día. */
  routineName: string;
  /** Ej. "🤸 CrossFit". El emoji lo dibuja la fuente de emoji del sistema. */
  typeLabel: string;
  /** Ej. "Martes". */
  weekdayLabel: string;
  /** Qué toca ese día, ej. "Power Snatch & Conditioning". */
  dayTitle: string;
  exercises: { name: string; detail: string | null }[];
}

/* ------------------------------------------------------------------ *
 * Layout
 *
 * Dos pasadas: primero se mide y se parte todo el texto en renglones para
 * saber cuánto alto ocupa, y después se dibuja. Un canvas no se puede
 * redimensionar sin borrar lo dibujado, así que el alto tiene que estar
 * resuelto antes del primer trazo.
 * ------------------------------------------------------------------ */

interface Line {
  text: string;
  style: TextStyle;
  /** Sangría respecto del margen izquierdo del bloque. */
  indent: number;
  /** Punto de lista al principio del renglón (sólo los movimientos de un bloque). */
  bullet: boolean;
}

interface ExerciseBlock {
  index: number;
  lines: Line[];
  height: number;
}

/**
 * La familia tipográfica real del documento. La app carga su fuente con
 * `next/font`, que genera un nombre de familia propio y lo expone en
 * `--font-app-sans`: leerlo del `body` ya computado es lo que hace que la
 * imagen use la misma tipografía que la pantalla, sin hardcodear un nombre
 * generado en build.
 */
function resolveFontFamily(): string {
  const computed = getComputedStyle(document.body).fontFamily;
  return computed || "system-ui, sans-serif";
}

const fontOf = (style: TextStyle, family: string) =>
  `${style.weight} ${style.size}px ${family}`;

/** Parte un texto en renglones que entren en `maxWidth`. Una palabra más larga que el ancho se deja sola en su renglón: cortarla al medio sería peor. */
function wrap(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  style: TextStyle,
  family: string
): string[] {
  ctx.font = fontOf(style, family);
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const lines: string[] = [];
  let current = words[0]!;
  for (const word of words.slice(1)) {
    const candidate = `${current} ${word}`;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  lines.push(current);
  return lines;
}

function layoutExercises(
  ctx: CanvasRenderingContext2D,
  input: RoutineDayImageInput,
  family: string
): ExerciseBlock[] {
  const textLeft = NUMBER_SIZE + NUMBER_GAP;
  const nameWidth = WIDTH - PADDING * 2 - textLeft;
  /* Los movimientos van con sangría propia y su punto de lista: el ancho
     disponible baja lo mismo que la sangría. */
  const movementIndent = textLeft + 26;
  const movementWidth = WIDTH - PADDING * 2 - movementIndent;

  return input.exercises.map((exercise, index) => {
    const lines: Line[] = wrap(ctx, exercise.name, nameWidth, STYLES.exercise, family).map(
      (text) => ({ text, style: STYLES.exercise, indent: textLeft, bullet: false })
    );

    /* Mismo criterio que la pantalla: un detalle que `splitDetail` no parte va
       como un renglón corrido, y uno partido va como lista de movimientos. */
    const parts = exercise.detail ? splitDetail(exercise.detail) : [];
    const asList = parts.length > 1;
    for (const part of parts) {
      const indent = asList ? movementIndent : textLeft;
      const width = asList ? movementWidth : nameWidth;
      const wrapped = wrap(ctx, part, width, STYLES.movement, family);
      wrapped.forEach((text, lineIndex) => {
        lines.push({
          text,
          style: STYLES.movement,
          indent,
          // El punto va sólo en el primer renglón del movimiento: los de
          // continuación cuelgan alineados debajo del texto, no del punto.
          bullet: asList && lineIndex === 0,
        });
      });
    }

    const height = lines.reduce((total, line) => total + line.style.lineHeight, 0);
    return { index, lines, height };
  });
}

/* ------------------------------------------------------------------ *
 * Dibujo
 * ------------------------------------------------------------------ */

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

/**
 * Dibuja el plan de un día y lo devuelve como PNG.
 *
 * PNG y no JPEG: el diseño es texto plano sobre fondos lisos, donde el JPEG
 * ensucia los bordes de las letras y no ahorra casi nada.
 */
export async function renderRoutineDayImage(input: RoutineDayImageInput): Promise<Blob> {
  /* Sin esto se mide (y a veces se dibuja) con la fuente de fallback, porque
     `next/font` la carga de forma asíncrona: la imagen saldría con otra
     tipografía y con los renglones cortados en otro lugar. */
  if (document.fonts?.ready) await document.fonts.ready;

  const measure = document.createElement("canvas").getContext("2d");
  if (!measure) throw new Error("No se pudo generar la imagen.");

  const family = resolveFontFamily();
  const contentWidth = WIDTH - PADDING * 2;

  const eyebrowLines = wrap(
    measure,
    `${input.typeLabel} · ${input.routineName}`,
    contentWidth,
    STYLES.eyebrow,
    family
  );
  const weekdayLines = wrap(
    measure,
    input.weekdayLabel.toUpperCase(),
    contentWidth,
    STYLES.weekday,
    family
  );
  const titleLines = wrap(measure, input.dayTitle, contentWidth, STYLES.dayTitle, family);

  const bandHeight =
    PADDING +
    eyebrowLines.length * STYLES.eyebrow.lineHeight +
    18 +
    weekdayLines.length * STYLES.weekday.lineHeight +
    6 +
    titleLines.length * STYLES.dayTitle.lineHeight +
    PADDING;

  const blocks = layoutExercises(measure, input, family);
  const BLOCK_GAP = 38;
  const bodyHeight = blocks.length
    ? blocks.reduce((total, block) => total + block.height, 0) +
      BLOCK_GAP * blocks.length +
      PADDING
    : PADDING + STYLES.movement.lineHeight + PADDING;

  const footerHeight = PADDING / 2 + STYLES.footer.lineHeight + PADDING / 2;
  const height = bandHeight + bodyHeight + footerHeight;

  /* Si un día muy cargado se pasa del alto máximo, se achica el diseño entero
     en vez de recortarlo: perder nitidez es aceptable, perder ejercicios no. */
  const scale = height > MAX_HEIGHT ? MAX_HEIGHT / height : 1;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(WIDTH * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo generar la imagen.");
  ctx.scale(scale, scale);
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, WIDTH, height);

  /* Banda de marca con el día. Es lo que hace que la imagen se reconozca de un
     vistazo en una lista de chats, donde se ve chiquita. */
  ctx.fillStyle = COLORS.band;
  ctx.fillRect(0, 0, WIDTH, bandHeight);

  let y = PADDING;
  const drawLines = (lines: string[], style: TextStyle, x = PADDING) => {
    ctx.font = fontOf(style, family);
    ctx.fillStyle = style.color;
    for (const line of lines) {
      // El baseline se corre dentro del alto del renglón para que el texto
      // quede centrado en su caja, no pegado al borde de arriba.
      ctx.fillText(line, x, y + style.size * 0.82);
      y += style.lineHeight;
    }
  };

  drawLines(eyebrowLines, STYLES.eyebrow);
  y += 18;
  drawLines(weekdayLines, STYLES.weekday);
  y += 6;
  drawLines(titleLines, STYLES.dayTitle);

  y = bandHeight + PADDING;

  if (blocks.length === 0) {
    drawLines(["Sin ejercicios cargados."], STYLES.movement);
  }

  for (const block of blocks) {
    const blockTop = y;

    /* Separador entre bloques, no arriba del primero: la banda ya separa. */
    if (block.index > 0) {
      ctx.strokeStyle = COLORS.border;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(PADDING, blockTop - BLOCK_GAP / 2);
      ctx.lineTo(WIDTH - PADDING, blockTop - BLOCK_GAP / 2);
      ctx.stroke();
    }

    /* Número del ejercicio: es el orden de ejecución, igual que en la
       pantalla, así que va en la imagen y no es decoración. */
    ctx.fillStyle = COLORS.badgeBackground;
    roundedRect(ctx, PADDING, blockTop + 2, NUMBER_SIZE, NUMBER_SIZE, NUMBER_SIZE / 2);
    ctx.fill();
    ctx.fillStyle = COLORS.badgeText;
    ctx.font = `700 24px ${family}`;
    ctx.textAlign = "center";
    ctx.fillText(String(block.index + 1), PADDING + NUMBER_SIZE / 2, blockTop + 2 + 31);
    ctx.textAlign = "left";

    for (const line of block.lines) {
      ctx.font = fontOf(line.style, family);
      ctx.fillStyle = line.style.color;
      const baseline = y + line.style.size * 0.82;
      if (line.bullet) {
        ctx.fillStyle = COLORS.bullet;
        ctx.fillText("•", PADDING + line.indent - 24, baseline);
        ctx.fillStyle = line.style.color;
      }
      ctx.fillText(line.text, PADDING + line.indent, baseline);
      y += line.style.lineHeight;
    }

    y += BLOCK_GAP;
  }

  const count = input.exercises.length;
  ctx.font = fontOf(STYLES.footer, family);
  ctx.fillStyle = STYLES.footer.color;
  ctx.fillText(
    `Maguita · ${count} ${count === 1 ? "ejercicio" : "ejercicios"}`,
    PADDING,
    height - PADDING / 2 - 8
  );

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("No se pudo generar la imagen.");
  return blob;
}
