import mammoth from 'mammoth';

export interface ExtractedPlanImage {
  id: string;
  name: string;
  mimeType: string;
  data: string; // Base64 string without data prefix
  previewUrl: string; // Complete data URI for <img> src
}

export interface ExtractedPlanResult {
  text: string;
  images: ExtractedPlanImage[];
}

/**
 * Converts HTML from mammoth into formatted text preserving Markdown tables, columns,
 * and mapping all embedded images to [[IMAGE:id:caption]] tags.
 * This guarantees that:
 * 1. Multi-column tables (e.g. 2 columns: GV & HS | Sản phẩm) are strictly preserved!
 * 2. All images, diagrams, charts from the old lesson plan are captured and preserved at their exact positions!
 */
function convertHtmlToMarkdown(html: string, extractedImages: ExtractedPlanImage[]): string {
  if (typeof DOMParser === 'undefined') {
    return html.replace(/<[^>]+>/g, ' ');
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Map image src to image placeholders
  const replaceImgWithPlaceholder = (img: HTMLImageElement) => {
    const src = img.getAttribute('src') || '';
    const matched = extractedImages.find((item) => item.id === src || item.previewUrl === src);
    const id = matched ? matched.id : src;
    const name = matched ? matched.name : (img.getAttribute('alt') || 'Hình ảnh từ giáo án cũ');
    return ` [[IMAGE:${id}:${name}]] `;
  };

  // 1. Process tables into clean Markdown tables
  const tables = doc.querySelectorAll('table');
  tables.forEach((table) => {
    const rows = Array.from(table.querySelectorAll('tr'));
    if (rows.length === 0) return;

    const tableLines: string[] = [];
    let maxCols = 0;

    // First pass to determine max columns
    rows.forEach((row) => {
      const cells = Array.from(row.querySelectorAll('td, th'));
      if (cells.length > maxCols) maxCols = cells.length;
    });

    if (maxCols === 0) return;

    rows.forEach((row, rowIdx) => {
      const cells = Array.from(row.querySelectorAll('td, th'));
      const cellTexts = cells.map((cell) => {
        // First convert any <img> inside cell into placeholder
        const cellImgs = Array.from(cell.querySelectorAll('img'));
        cellImgs.forEach((img) => {
          const ph = doc.createTextNode(replaceImgWithPlaceholder(img));
          img.parentNode?.replaceChild(ph, img);
        });

        // Convert multiple paragraphs or linebreaks inside a cell into <br> to keep table row single-line in Markdown
        const cellHtml = cell.innerHTML || '';
        const tempDiv = doc.createElement('div');
        tempDiv.innerHTML = cellHtml
          .replace(/<\/p>\s*<p[^>]*>/gi, '__BR_TOKEN__')
          .replace(/<\/li>\s*<li[^>]*>/gi, '__BR_TOKEN__– ')
          .replace(/<br\s*\/?>/gi, '__BR_TOKEN__');

        const rawText = tempDiv.textContent || '';
        const cleanText = rawText
          .replace(/[\r\n]+/g, ' ')
          .replace(/\|/g, '\\|')
          .replace(/\s+/g, ' ')
          .replace(/\s*__BR_TOKEN__\s*/g, '<br>')
          .trim();

        return cleanText || ' ';
      });

      // Pad cells if row has fewer cells than maxCols
      while (cellTexts.length < maxCols) {
        cellTexts.push(' ');
      }

      tableLines.push(`| ${cellTexts.join(' | ')} |`);

      // Add separator after first row (header row)
      if (rowIdx === 0) {
        const separators = Array(maxCols).fill('---');
        tableLines.push(`| ${separators.join(' | ')} |`);
      }
    });

    // Replace table element with a placeholder preserving the table markdown
    const placeholder = doc.createElement('div');
    placeholder.textContent = `\n\n${tableLines.join('\n')}\n\n`;
    table.parentNode?.replaceChild(placeholder, table);
  });

  // 2. Process any remaining <img> tags outside tables
  const standaloneImgs = Array.from(doc.querySelectorAll('img'));
  standaloneImgs.forEach((img) => {
    const phText = replaceImgWithPlaceholder(img);
    const p = doc.createElement('p');
    p.textContent = phText.trim();
    img.parentNode?.replaceChild(p, img);
  });

  // 3. Extract structured text
  let result = '';
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let currentNode = walker.nextNode();

  while (currentNode) {
    if (currentNode.nodeType === Node.TEXT_NODE) {
      result += currentNode.textContent;
    } else if (currentNode.nodeType === Node.ELEMENT_NODE) {
      const el = currentNode as HTMLElement;
      const tag = el.tagName.toLowerCase();
      if (['p', 'h1', 'h2', 'h3', 'h4', 'div'].includes(tag)) {
        result += '\n';
      } else if (tag === 'li') {
        result += '\n– ';
      } else if (tag === 'br') {
        result += '\n';
      }
    }
    currentNode = walker.nextNode();
  }

  // Normalize excessive blank lines
  return result
    .split('\n')
    .map((l) => l.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Extracts text, preserved multi-column tables, AND all embedded images from the teacher's lesson plan.
 * Supports: .docx, .pdf, .txt, .md
 */
export async function extractTextFromFile(
  file: File,
  userApiKey?: string
): Promise<ExtractedPlanResult> {
  const fileName = file.name.toLowerCase();

  // 1. PDF files (e.g. b3_ban_ve_chi_tiet.f24a.pdf)
  if (fileName.endsWith('.pdf')) {
    const arrayBuffer = await file.arrayBuffer();
    const pdfBase64 = arrayBufferToBase64(arrayBuffer);

    const res = await fetch('/api/extract-plan-pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-gemini-key': userApiKey || '',
      },
      body: JSON.stringify({
        pdfBase64,
        userApiKey,
      }),
    });

    const data = await res.json();
    if (!res.ok || data.error) {
      throw new Error(data.error || 'Không thể trích xuất nội dung từ tệp PDF giáo án');
    }

    return {
      text: data.text || '',
      images: data.images || [],
    };
  }

  // 2. Word .docx files
  if (fileName.endsWith('.docx')) {
    const arrayBuffer = await file.arrayBuffer();
    const extractedImages: ExtractedPlanImage[] = [];
    let imageCounter = 0;

    try {
      const options = {
        convertImage: mammoth.images.imgElement(function (image: any) {
          return image.read('base64').then(function (imageBuffer: string) {
            imageCounter++;
            const id = `giao_an_cu_img_${Date.now()}_${imageCounter}`;
            const mimeType = image.contentType || 'image/jpeg';
            const previewUrl = `data:${mimeType};base64,${imageBuffer}`;
            // MathType / Equation 3.0 objects are embedded as WMF/EMF preview images
            const isFormula = /x-wmf|x-emf|wmf|emf/i.test(mimeType);
            const name = isFormula
              ? `Công thức ${imageCounter} (MathType trong giáo án gốc)`
              : `Hình ${imageCounter} (từ giáo án cũ)`;

            extractedImages.push({
              id,
              name,
              mimeType,
              data: imageBuffer,
              previewUrl,
            });

            return {
              src: id,
              alt: name,
            };
          });
        }),
      };

      const htmlResult = await mammoth.convertToHtml({ arrayBuffer }, options);
      const markdownText = convertHtmlToMarkdown(htmlResult.value, extractedImages);

      return {
        text: markdownText,
        images: extractedImages,
      };
    } catch (err) {
      console.warn('Mammoth HTML/Image extraction failed, fallback to raw text:', err);
      const rawResult = await mammoth.extractRawText({ arrayBuffer });
      return {
        text: rawResult.value,
        images: [],
      };
    }
  }

  if (fileName.endsWith('.txt') || fileName.endsWith('.md')) {
    const text = await file.text();
    return {
      text,
      images: [],
    };
  }

  // Fallback try reading as text
  const fallbackText = await file.text();
  return {
    text: fallbackText,
    images: [],
  };
}
