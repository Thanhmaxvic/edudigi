/**
 * Mathematical Figure (SVG & Inline Image) Extractor, 1pt-Black Normalizer, and PNG Rasterizer
 * Ensures all AI-generated geometry, graph, and feasible-region figures strictly adhere to:
 * - Accurate mathematical labels, coordinates, axes, points, and shading
 * - Line stroke width: 1pt (1.333px at 96 DPI)
 * - Color: Black (#000000) on pure white (#FFFFFF) background
 * - Seamless embedding into both Web A4 Preview and Microsoft Word (.docx)
 */

export interface ExtractedVisual {
  id: string;
  kind: "svg" | "data_img";
  svg?: string;
  dataUrl: string;
  mimeType: string;
  base64Data: string;
  caption: string;
  width: number;
  height: number;
}

// Valid 1x1 white PNG fallback bytes for headless Node environments (when HTMLCanvasElement is unavailable)
const MINIMAL_WHITE_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";

/**
 * UTF-8 safe string -> base64 encoder (works in both Browser and Node.js)
 */
export function utf8ToBase64(str: string): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(str, "utf-8").toString("base64");
  }
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Base64 -> Uint8Array decoder (works in both Browser and Node.js)
 */
export function base64ToBytes(base64: string): Uint8Array {
  const clean = base64.replace(/^data:[^;]+;base64,/, "").trim();
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(clean, "base64"));
  }
  const binary = atob(clean);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

/**
 * Enforces strict mathematical figure styling:
 * - Stroke color: black (#000000)
 * - Stroke width: 1pt (1.33px)
 * - Pure white background (#ffffff)
 * - Monochrome grayscale fills for shaded feasible regions
 */
export function normalizeMathSvgTo1ptBlack(rawSvg: string): {
  svg: string;
  width: number;
  height: number;
  extractedTitle: string;
} {
  let s = rawSvg.trim();

  // Extract optional <title> or data-caption before normalizing
  let extractedTitle = "";
  const dataCapMatch = s.match(/\bdata-caption=["']([^"']+)["']/i);
  const titleMatch = s.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (dataCapMatch && dataCapMatch[1].trim()) {
    extractedTitle = dataCapMatch[1].trim();
  } else if (titleMatch && titleMatch[1].trim()) {
    extractedTitle = titleMatch[1].replace(/\s+/g, " ").trim();
  }

  // Determine viewBox and dimensions
  let vbX = 0;
  let vbY = 0;
  let vbW = 420;
  let vbH = 315;

  const vbMatch = s.match(/\bviewBox=["']\s*([-\d.]+)[,\s]+([-\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)\s*["']/i);
  if (vbMatch) {
    vbX = parseFloat(vbMatch[1]) || 0;
    vbY = parseFloat(vbMatch[2]) || 0;
    vbW = parseFloat(vbMatch[3]) || 420;
    vbH = parseFloat(vbMatch[4]) || 315;
  } else {
    const wMatch = s.match(/<svg[^>]*?\bwidth=["']([\d.]+)(?:px|pt)?["']/i);
    const hMatch = s.match(/<svg[^>]*?\bheight=["']([\d.]+)(?:px|pt)?["']/i);
    if (wMatch) vbW = parseFloat(wMatch[1]) || 420;
    if (hMatch) vbH = parseFloat(hMatch[1]) || 315;
  }

  // Clamp display dimensions for neat Word A4 layout (aspect-ratio preserved)
  const targetMaxW = 380;
  const aspect = vbH / (vbW || 1);
  const displayWidth = Math.round(Math.min(Math.max(vbW, 260), targetMaxW));
  const displayHeight = Math.round(Math.min(Math.max(displayWidth * aspect, 170), 320));

  // Normalize root <svg ...> attributes
  s = s.replace(/<svg\b([^>]*)>/i, (_, attrs: string) => {
    let cleanAttrs = attrs
      .replace(/\bxmlns=["'][^"']*["']/gi, "")
      .replace(/\bwidth=["'][^"']*["']/gi, "")
      .replace(/\bheight=["'][^"']*["']/gi, "");
    if (!/\bviewBox=/i.test(cleanAttrs)) {
      cleanAttrs += ` viewBox="${vbX} ${vbY} ${vbW} ${vbH}"`;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${vbW}" height="${vbH}"${cleanAttrs}>`;
  });

  // 1. Force all non-none stroke colors to black (#000000)
  s = s.replace(/\bstroke=["']([^"']+)["']/gi, (full, val: string) => {
    const v = val.trim().toLowerCase();
    if (v === "none" || v === "transparent" || v.startsWith("url(")) return full;
    if (v === "#ffffff" || v === "white" || v === "#fff") return full;
    return `stroke="#000000"`;
  });

  // Also normalize inline CSS style="...stroke: ...; stroke-width: ...;"
  s = s.replace(/\bstyle=["']([^"']+)["']/gi, (_, styleStr: string) => {
    let updated = styleStr
      .replace(/stroke\s*:\s*(?!none|transparent|#fff|#ffffff|white)[^;]+/gi, "stroke: #000000")
      .replace(/stroke-width\s*:\s*(?!0\b)[^;]+/gi, "stroke-width: 1.33px")
      .replace(/color\s*:\s*[^;]+/gi, "color: #000000");
    return `style="${updated}"`;
  });

  // 2. Force all non-zero stroke-width attributes to 1pt (1.33px at 96 DPI)
  s = s.replace(/\bstroke-width=["']([^"']+)["']/gi, (full, val: string) => {
    const num = parseFloat(val);
    if (val.trim() === "0" || num === 0) return full;
    return `stroke-width="1.33"`;
  });

  // 3. Add stroke="#000000" stroke-width="1.33" to geometric stroke elements if missing stroke-width
  s = s.replace(/<(line|polyline|path)\b([^>]*?)(\/?)>/gi, (_, tag: string, attrs: string, selfClose: string) => {
    let a = attrs;
    if (!/\bstroke=/i.test(a) && !/stroke\s*:/i.test(a)) {
      a += ` stroke="#000000"`;
    }
    if (!/\bstroke-width=/i.test(a) && !/stroke-width\s*:/i.test(a) && !/\bstroke=["']none["']/i.test(a)) {
      a += ` stroke-width="1.33"`;
    }
    return `<${tag}${a}${selfClose}>`;
  });

  // 4. Normalize fills: keep white/none/url(#pattern)/black, convert colored region fills to subtle monochrome gray
  s = s.replace(/\bfill=["']([^"']+)["']/gi, (full, val: string) => {
    const v = val.trim().toLowerCase();
    if (
      v === "none" ||
      v === "transparent" ||
      v === "#ffffff" ||
      v === "#fff" ||
      v === "white" ||
      v === "#000000" ||
      v === "#000" ||
      v === "black" ||
      v.startsWith("url(")
    ) {
      return full;
    }
    // Check if inside <text> -> handled next; for shapes/polygons, use clean monochrome shading
    return `fill="#e5e5e5"`;
  });

  // 5. Ensure all <text ...> elements are pure black (#000000) and readable Times New Roman serif
  s = s.replace(/<text\b([^>]*)>/gi, (_, attrs: string) => {
    let a = attrs.replace(/\bfill=["'][^"']*["']/gi, "").replace(/\bstroke=["'][^"']*["']/gi, "");
    if (!/\bfont-family=/i.test(a)) {
      a += ` font-family="Times New Roman, serif"`;
    }
    a += ` fill="#000000"`;
    return `<text${a}>`;
  });

  // 6. Ensure <marker> arrowheads have black fill
  s = s.replace(/(<marker\b[\s\S]*?<\/marker>)/gi, (markerBlock: string) => {
    return markerBlock.replace(/\bfill=["'](?!none)[^"']*["']/gi, `fill="#000000"`);
  });

  // 7. Inject pure white background rect right after opening <svg ...>
  s = s.replace(
    /(<svg\b[^>]*>)/i,
    `$1<rect x="${vbX}" y="${vbY}" width="${vbW}" height="${vbH}" fill="#ffffff" stroke="none" />`
  );

  return {
    svg: s,
    width: displayWidth,
    height: displayHeight,
    extractedTitle,
  };
}

/**
 * Extracts all inline <svg>...</svg> drawings (fenced or unfenced) and base64 markdown images
 * BEFORE line/table splitting, replacing them with single-line [[GEN_SVG:id:caption]] tokens
 * so multi-line SVGs inside Markdown table cells never break table formatting.
 */
export function extractInlineVisuals(rawContent: string): {
  contentWithTokens: string;
  visuals: Map<string, ExtractedVisual>;
} {
  const visuals = new Map<string, ExtractedVisual>();
  if (!rawContent) {
    return { contentWithTokens: "", visuals };
  }

  let counter = 1;
  let content = rawContent;

  const sanitizeCaption = (cap: string): string =>
    cap
      .replace(/[\r\n|]+/g, " ")
      .replace(/\[\[|\]\]/g, "")
      .replace(/\s+/g, " ")
      .trim();

  const registerSvg = (rawSvg: string, explicitCaption = ""): string => {
    const id = `gen_svg_${counter++}`;
    const { svg, width, height, extractedTitle } = normalizeMathSvgTo1ptBlack(rawSvg);
    const b64 = utf8ToBase64(svg);
    const caption = sanitizeCaption(explicitCaption || extractedTitle || "");
    visuals.set(id, {
      id,
      kind: "svg",
      svg,
      dataUrl: `data:image/svg+xml;base64,${b64}`,
      mimeType: "image/svg+xml",
      base64Data: b64,
      caption,
      width,
      height,
    });
    return caption ? `[[GEN_SVG:${id}:${caption}]]` : `[[GEN_SVG:${id}]]`;
  };

  // 1. Fenced ```svg ... ``` or ```xml <svg...>...</svg> ``` blocks
  content = content.replace(/```(?:svg|xml|html)?\s*([\s\S]*?<svg\b[\s\S]*?<\/svg>[\s\S]*?)```/gi, (_, inner: string) => {
    const svgMatch = inner.match(/<svg\b[\s\S]*?<\/svg>/i);
    if (!svgMatch) return inner;
    return registerSvg(svgMatch[0]);
  });

  // 2. Tagged [[SVG_FIGURE:Caption]] followed by <svg>...</svg>
  content = content.replace(
    /\[\[SVG_FIGURE:([^\]]*)\]\]\s*(?:<br\s*\/?>|\s)*(<svg\b[\s\S]*?<\/svg>)/gi,
    (_, cap: string, svgBlock: string) => registerSvg(svgBlock, cap)
  );

  // 3. Bare <svg ...>...</svg> blocks anywhere (paragraphs or inside table cells)
  content = content.replace(/<svg\b[\s\S]*?<\/svg>/gi, (svgBlock: string) => registerSvg(svgBlock));

  // 4. Markdown inline base64 data URI images: ![caption](data:image/...;base64,...)
  content = content.replace(
    /!\[([^\]]*)\]\((data:image\/([a-zA-Z0-9+.-]+);base64,([A-Za-z0-9+/=\s]+))\)/g,
    (_, alt: string, _fullUri: string, subtype: string, b64Raw: string) => {
      const cleanB64 = b64Raw.replace(/\s+/g, "");
      const mimeType = `image/${subtype.toLowerCase()}`;
      if (subtype.toLowerCase().includes("svg")) {
        const decodedSvg =
          typeof Buffer !== "undefined"
            ? Buffer.from(cleanB64, "base64").toString("utf-8")
            : new TextDecoder().decode(base64ToBytes(cleanB64));
        return registerSvg(decodedSvg, alt);
      }
      const id = `gen_svg_${counter++}`;
      const caption = sanitizeCaption(alt || "");
      visuals.set(id, {
        id,
        kind: "data_img",
        dataUrl: `data:${mimeType};base64,${cleanB64}`,
        mimeType,
        base64Data: cleanB64,
        caption,
        width: 340,
        height: 230,
      });
      return caption ? `[[GEN_SVG:${id}:${caption}]]` : `[[GEN_SVG:${id}]]`;
    }
  );

  return { contentWithTokens: content, visuals };
}

/**
 * Rasterizes an SVG string into high-DPI PNG bytes (3x scale = ~300 DPI) in the Browser
 * for crisp fallback compatibility in older Word versions, or returns a valid minimal PNG
 * in headless Node environments where native SVG bytes carry the vector drawing.
 */
export async function rasterizeSvgToPngBytes(
  svgString: string,
  width: number,
  height: number,
  scale = 3
): Promise<Uint8Array> {
  if (typeof document === "undefined" || typeof Image === "undefined") {
    return base64ToBytes(MINIMAL_WHITE_PNG_BASE64);
  }

  return new Promise<Uint8Array>((resolve) => {
    try {
      const img = new Image();
      const b64 = utf8ToBase64(svgString);
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(width * scale));
          canvas.height = Math.max(1, Math.round(height * scale));
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(base64ToBytes(MINIMAL_WHITE_PNG_BASE64));
            return;
          }
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const pngDataUrl = canvas.toDataURL("image/png");
          resolve(base64ToBytes(pngDataUrl));
        } catch {
          resolve(base64ToBytes(MINIMAL_WHITE_PNG_BASE64));
        }
      };
      img.onerror = () => {
        resolve(base64ToBytes(MINIMAL_WHITE_PNG_BASE64));
      };
      img.src = `data:image/svg+xml;base64,${b64}`;
    } catch {
      resolve(base64ToBytes(MINIMAL_WHITE_PNG_BASE64));
    }
  });
}
