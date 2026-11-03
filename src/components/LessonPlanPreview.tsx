import React, { useState, useMemo } from 'react';
import {
  Download,
  Copy,
  Printer,
  Check,
  Edit3,
  Image as ImageIcon,
  FileText,
  CheckCircle2,
  AlertTriangle,
  FileCode2,
} from 'lucide-react';
import {
  exportLessonPlanToDocx,
  cleanLineFormatting,
  preprocessLessonPlanContent,
  splitMarkdownTableRow,
  stripHeadingHashes,
  verifyGeneratedDocxXml,
  FormattingOptions,
  DocxVerificationReport,
} from '../utils/docxExport';
import {
  renderLatexToHtml,
  cleanPlainProseForWord,
  ensureMathAndTagSpacing,
  autoWrapUnwrappedMathForEquation,
  MathOutputFormat,
} from '../utils/mathConverter';
import { extractInlineVisuals } from '../utils/mathSvgRenderer';
import { injectIntoDocxWithReport } from '../utils/docxInjector';
import { DocxTemplateProfile } from '../utils/fileExtractor';
import { LessonPlanGenerationMode } from './SourceMaterialUploader';
import FileSaver from 'file-saver';
const saveAs = (FileSaver as any).saveAs || FileSaver;

export interface SgkImagePreviewItem {
  id: string;
  name: string;
  mimeType: string;
  data: string;
  previewUrl: string;
  width?: number;
  height?: number;
}

interface LessonPlanPreviewProps {
  content: string;
  onChangeContent: (newContent: string) => void;
  lessonTitle: string;
  subject: string;
  grade: string;
  isGenerating?: boolean;
  sgkImages?: SgkImagePreviewItem[];
  originalDocxBuffer?: ArrayBuffer | null;
  templateProfile?: DocxTemplateProfile | null;
  planMode?: LessonPlanGenerationMode;
  preserveOriginalHeader?: boolean;
  formattingOptions?: FormattingOptions;
  onChangeFormattingOptions?: (opts: FormattingOptions) => void;
  lastVerification?: DocxVerificationReport | null;
  onVerificationReport?: (report: DocxVerificationReport) => void;
}

export const LessonPlanPreview: React.FC<LessonPlanPreviewProps> = ({
  content,
  onChangeContent,
  lessonTitle,
  subject,
  grade,
  sgkImages = [],
  originalDocxBuffer = null,
  templateProfile = null,
  planMode = 'new_cv5512',
  preserveOriginalHeader = false,
  formattingOptions,
  onChangeFormattingOptions,
  lastVerification = null,
  onVerificationReport,
}) => {
  const [highlightRed, setHighlightRed] = useState(true);
  const [isCopied, setIsCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [localVerification, setLocalVerification] = useState<DocxVerificationReport | null>(null);

  const activeMathFormat: MathOutputFormat =
    formattingOptions?.mathFormat === 'latex' ? 'latex' : 'equation';
  const activeFontName = formattingOptions?.fontName || 'Times New Roman';
  const activeFontPt = (formattingOptions?.fontSize || 26) / 2;
  const activeLineHeight = Number(
    (((formattingOptions?.lineSpacing || 240) / 240) * 1.25).toFixed(2)
  );
  const activeParaAfterPt = (formattingOptions?.paraSpacing ?? 120) / 20;
  const activePageNumber = formattingOptions?.pageNumber || 'bottom-center';
  const isNarrowMargin = formattingOptions?.margins?.left === 720;

  const verificationReport = lastVerification || localVerification;

  // Extract inline <svg>...</svg> & inline base64 images into single-line [[GEN_SVG:id:caption]] tokens
  const { contentWithTokens, visuals } = useMemo(() => extractInlineVisuals(content), [content]);

  // Count red highlighted additions and embedded figures
  const redMatchCount = (content.match(/\[\[\s*RED:/gi) || []).length;
  const sgkTagCount = (contentWithTokens.match(/\[\[IMAGE:[^\]]+\]\]/g) || []).length;
  const generatedSvgCount = visuals.size;
  const totalVisualCount = sgkTagCount + generatedSvgCount;

  // In 'preserve_old' mode with an uploaded .docx file and red NLS blocks, primary export preserves 100% of original .docx!
  const preferDirectDocxInjection =
    planMode === 'preserve_old' && Boolean(originalDocxBuffer) && redMatchCount > 0;

  const handleSwitchMathFormat = (mode: MathOutputFormat) => {
    if (!onChangeFormattingOptions || !formattingOptions) return;
    onChangeFormattingOptions({
      ...formattingOptions,
      mathFormat: mode,
    });
  };

  const handleCopy = () => {
    const preprocessed = preprocessLessonPlanContent(contentWithTokens, activeMathFormat);
    const cleanText = preprocessed
      .replace(/\[\[RED:(.*?)\]\]/g, '$1')
      .replace(/\[\[RED:?/g, '')
      .replace(/\]\]/g, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/\[\[GEN_SVG:[^:\]]+(?::(.*?))?\]\]/g, '[$1]')
      .replace(/\[\[IMAGE:[^:\]]+(?::(.*?))?\]\]/g, '[$1]');
    navigator.clipboard.writeText(cleanText);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

  const handleExportRebuiltWord = async () => {
    try {
      setIsExporting(true);
      const report = await exportLessonPlanToDocx(content, {
        lessonTitle,
        subject,
        grade,
        images: sgkImages,
        formatting: formattingOptions,
        templateProfile,
        preserveOriginalHeader,
      });
      setLocalVerification(report);
      if (onVerificationReport) {
        onVerificationReport(report);
      }
    } catch (err: any) {
      console.error('Word export error:', err);
      alert('Có lỗi xảy ra khi tạo tệp Word: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportInjectedWord = async () => {
    if (!originalDocxBuffer) return;
    try {
      setIsExporting(true);
      const { blob, report } = await injectIntoDocxWithReport(originalDocxBuffer, content, {
        mathFormat: activeMathFormat,
      });
      const xmlVerification = await verifyGeneratedDocxXml(blob, activeMathFormat);
      setLocalVerification(xmlVerification);
      if (onVerificationReport) {
        onVerificationReport(xmlVerification);
      }

      const safeTitle = (lessonTitle || 'GiaoAn')
        .replace(/[<>:"/\\|?*]+/g, '_')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 70);
      const modeTag = activeMathFormat === 'latex' ? 'LaTeX' : 'Equation';
      saveAs(blob, `[NangLucSo_Goc_${modeTag}] ${safeTitle}.docx`);

      if (report.appended > 0 && report.injected === 0) {
        alert(
          `Đã giữ nguyên 100% định dạng file gốc và bổ sung ${report.appended} mục năng lực số vào cuối giáo án.`
        );
      }
    } catch (err: any) {
      console.error('Word export error:', err);
      alert('Có lỗi xảy ra khi chèn vào tệp Word gốc: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrimaryExportWord = async () => {
    if (preferDirectDocxInjection) {
      await handleExportInjectedWord();
    } else {
      await handleExportRebuiltWord();
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const findMatchingImage = (idOrIndex: string) => {
    const clean = idOrIndex.trim().toLowerCase();
    const byId = sgkImages.find((img) => img.id && img.id.toLowerCase() === clean);
    if (byId) return byId;

    const num = parseInt(clean, 10);
    if (!isNaN(num) && num > 0 && num <= sgkImages.length) {
      return sgkImages[num - 1];
    }

    const trailingIdxMatch = clean.match(/(?:hinh|img|image)[_\-\s]*(\d+)$/i);
    if (trailingIdxMatch) {
      const idx = parseInt(trailingIdxMatch[1], 10);
      if (!isNaN(idx) && idx > 0 && idx <= sgkImages.length) {
        return sgkImages[idx - 1];
      }
    }

    return (
      sgkImages.find(
        (img) =>
          img.name && (img.name.toLowerCase() === clean || img.name.toLowerCase().includes(clean))
      ) || null
    );
  };

  /**
   * Unified Stateful Inline Renderer for A4 Live Preview:
   * - Coordinates [[RED:...]], math ($...$, $$...$$, \(...\), \[...\], \begin{cases}), ***bold-italic***, **bold**, *italic*
   * - Preserves 100% of spaces ("không dính chữ") and strips stray Markdown '*' / '#'
   */
  const renderFormattedText = (text: string) => {
    let sanitized = cleanLineFormatting(text, false)
      .replace(/\[\.\.\.\]/g, '')
      .replace(/\[i\]/gi, '')
      .replace(/\[\[\s*red\s*:/gi, '[[RED:');

    const opens = (sanitized.match(/\[\[RED:/g) || []).length;
    const closes = (sanitized.match(/\]\]/g) || []).length;
    if (opens > closes) {
      sanitized += ']]'.repeat(opens - closes);
    }
    sanitized = ensureMathAndTagSpacing(sanitized);

    if (activeMathFormat === 'equation') {
      const atomicSplitRegex =
        /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$[^$]+?\$|\\\([\s\S]+?\\\)|\\begin\{(?:cases|aligned|matrix|pmatrix|bmatrix|vmatrix)\}[\s\S]+?\\end\{(?:cases|aligned|matrix|pmatrix|bmatrix|vmatrix)\}|\[\[RED:|\]\])/gi;
      let rebuilt = '';
      let last = 0;
      let m: RegExpExecArray | null;
      while ((m = atomicSplitRegex.exec(sanitized)) !== null) {
        if (m.index > last) {
          rebuilt += autoWrapUnwrappedMathForEquation(sanitized.slice(last, m.index));
        }
        rebuilt += m[0];
        last = atomicSplitRegex.lastIndex;
      }
      if (last < sanitized.length) {
        rebuilt += autoWrapUnwrappedMathForEquation(sanitized.slice(last));
      }
      sanitized = ensureMathAndTagSpacing(rebuilt);
    }

    type PreviewToken =
      | { type: 'red_open' }
      | { type: 'red_close' }
      | { type: 'math'; raw: string; formula: string; isDisplay: boolean }
      | { type: 'text'; value: string };

    const streamTokens: PreviewToken[] = [];
    const masterRegex =
      activeMathFormat === 'latex'
        ? /(\[\[RED:)|(\]\])|(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g
        : /(\[\[RED:)|(\]\])|(?:\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\$([^$]+?)\$|\\\(([\s\S]+?)\\\)|(\\begin\{(?:cases|aligned|matrix|pmatrix|bmatrix|vmatrix)\}[\s\S]+?\\end\{(?:cases|aligned|matrix|pmatrix|bmatrix|vmatrix)\}))/g;

    let ptr = 0;
    let tm: RegExpExecArray | null;
    let openRedDepth = 0;

    while ((tm = masterRegex.exec(sanitized)) !== null) {
      if (tm.index > ptr) {
        streamTokens.push({ type: 'text', value: sanitized.slice(ptr, tm.index) });
      }
      if (tm[1]) {
        openRedDepth++;
        streamTokens.push({ type: 'red_open' });
      } else if (tm[2]) {
        if (openRedDepth > 0) {
          openRedDepth--;
          streamTokens.push({ type: 'red_close' });
        }
      } else if (activeMathFormat === 'latex' && tm[3]) {
        const isDisp = tm[3].startsWith('$$') && tm[3].endsWith('$$');
        streamTokens.push({ type: 'math', raw: tm[3], formula: tm[3], isDisplay: isDisp });
      } else {
        const displayFormula = tm[3] || tm[4] || tm[7] || '';
        const inlineFormula = tm[5] || tm[6] || '';
        streamTokens.push({
          type: 'math',
          raw: tm[0],
          formula: displayFormula || inlineFormula,
          isDisplay: Boolean(displayFormula),
        });
      }
      ptr = masterRegex.lastIndex;
    }
    if (ptr < sanitized.length) {
      streamTokens.push({ type: 'text', value: sanitized.slice(ptr) });
    }

    const combinedPlain = streamTokens
      .filter((t): t is { type: 'text'; value: string } => t.type === 'text')
      .map((t) => t.value)
      .join('');

    const hasBalancedDoubleStar = (combinedPlain.match(/\*\*/g) || []).length >= 2;
    const textWithoutDoubleStars = combinedPlain.replace(/\*{2,}/g, '');
    const singleStarCount = (textWithoutDoubleStars.match(/\*/g) || []).length;
    const allowItalicToggle = singleStarCount >= 2 && singleStarCount % 2 === 0;

    let isRed = false;
    let isBold = false;
    let isItalic = false;
    let nodeIdx = 0;
    const nodes: React.ReactNode[] = [];

    const pushPlainSpan = (rawStr: string) => {
      const cleaned = cleanPlainProseForWord(rawStr).replace(/`/g, '');
      if (!cleaned) return;
      const cls = [
        isRed && highlightRed ? 'edudigi-red-text' : '',
        !isRed && isBold ? 'font-bold' : '',
        isItalic ? 'italic' : '',
      ]
        .filter(Boolean)
        .join(' ');
      nodes.push(
        <span key={`pt_${nodeIdx++}`} className={cls || undefined}>
          {cleaned}
        </span>
      );
    };

    for (const tok of streamTokens) {
      if (tok.type === 'red_open') {
        isRed = true;
        continue;
      }
      if (tok.type === 'red_close') {
        isRed = false;
        continue;
      }
      if (tok.type === 'math') {
        const redCls = isRed && highlightRed ? 'edudigi-red-text' : '';
        if (activeMathFormat === 'latex') {
          nodes.push(
            <span
              key={`pm_${nodeIdx++}`}
              className={`${
                tok.isDisplay ? 'my-1.5 block text-center font-normal' : 'inline font-normal'
              } ${redCls}`}
            >
              {tok.raw}
            </span>
          );
        } else if (tok.formula) {
          nodes.push(
            <span
              key={`pm_${nodeIdx++}`}
              className={`${
                tok.isDisplay
                  ? 'my-1.5 block text-center overflow-x-auto py-1'
                  : 'inline-block mx-0.5 align-middle'
              } ${redCls}`}
              dangerouslySetInnerHTML={{
                __html: renderLatexToHtml(tok.formula, tok.isDisplay),
              }}
            />
          );
        }
        continue;
      }

      const s = tok.value;
      let buf = '';
      let idx = 0;
      while (idx < s.length) {
        if (s.startsWith('***', idx)) {
          if (buf) {
            pushPlainSpan(buf);
            buf = '';
          }
          if (hasBalancedDoubleStar) isBold = !isBold;
          if (allowItalicToggle) isItalic = !isItalic;
          idx += 3;
          continue;
        }
        if (s.startsWith('**', idx)) {
          if (buf) {
            pushPlainSpan(buf);
            buf = '';
          }
          if (hasBalancedDoubleStar) isBold = !isBold;
          idx += 2;
          continue;
        }
        if (s[idx] === '*') {
          if (buf) {
            pushPlainSpan(buf);
            buf = '';
          }
          if (allowItalicToggle) isItalic = !isItalic;
          idx += 1;
          continue;
        }
        buf += s[idx];
        idx++;
      }
      if (buf) {
        pushPlainSpan(buf);
      }
    }

    return nodes;
  };

  // Renders an extracted 1pt black mathematical SVG visual block
  const renderGeneratedVisualBlock = (visId: string, captionOverride: string, compact = false) => {
    const vis = visuals.get(visId);
    if (!vis) return null;
    const finalCaption = captionOverride || vis.caption;

    return (
      <div
        className={`${
          compact ? 'my-2 p-2' : 'my-4 p-3'
        } text-center bg-white rounded border border-slate-300`}
      >
        <img
          src={vis.dataUrl}
          alt={finalCaption || 'Hình vẽ toán học 1pt black'}
          style={{
            maxWidth: compact ? '270px' : `${vis.width}px`,
            width: '100%',
            height: 'auto',
          }}
          className="mx-auto block bg-white object-contain"
        />
        {finalCaption && (
          <p className="text-[11pt] italic text-slate-800 mt-1.5 text-center">
            {renderFormattedText(finalCaption)}
          </p>
        )}
      </div>
    );
  };

  // Renders cell content, supporting embedded SGK/old-plan images, generated 1pt black SVG graphs, and multi-line cells
  const renderTableCell = (cellText: string) => {
    const subLines = cellText.split(/<br\s*\/?>/i);

    return (
      <div className="space-y-1.5">
        {subLines.map((sub, idx) => {
          let trimmedSub = sub.trim();
          if (!trimmedSub) return null;

          trimmedSub = trimmedSub
            .replace(/^&lt;br\s*\/?&gt;\s*[-–]?\s*/i, '')
            .replace(/^<br\s*\/?>\s*[-–]?\s*/i, '')
            .replace(/&lt;br\s*\/?&gt;/gi, ' ')
            .replace(/<br\s*\/?>/gi, ' ');

          const strippedHash = stripHeadingHashes(trimmedSub);
          const isCellSubHeading = strippedHash.level > 0;
          trimmedSub = strippedHash.text;
          if (!trimmedSub) return null;

          // 1. Check for generated mathematical figure [[GEN_SVG:id:caption]] inside cell
          const genSvgMatch = trimmedSub.match(/\[\[GEN_SVG:([^:\]]+)(?::([\s\S]*?))?\]\]/);
          if (genSvgMatch) {
            const visId = genSvgMatch[1].trim();
            const caption = (genSvgMatch[2] || '').trim();
            const textBefore = trimmedSub.slice(0, genSvgMatch.index || 0).trim();
            const textAfter = trimmedSub
              .slice((genSvgMatch.index || 0) + genSvgMatch[0].length)
              .trim();

            return (
              <div key={idx} className="space-y-1.5 my-1">
                {textBefore && <div className="text-justify">{renderFormattedText(textBefore)}</div>}
                {renderGeneratedVisualBlock(visId, caption, true)}
                {textAfter && <div className="text-justify">{renderFormattedText(textAfter)}</div>}
              </div>
            );
          }

          // 2. Check for uploaded textbook/sample image [[IMAGE:id:caption]] inside cell
          const imageMatch = trimmedSub.match(/\[\[IMAGE:([^:\]]+)(?::([\s\S]*?))?\]\]/);
          if (imageMatch) {
            const imgId = imageMatch[1];
            const caption = imageMatch[2] || '';
            const imgObj = findMatchingImage(imgId);
            const textWithoutImage = trimmedSub.replace(imageMatch[0], '').trim();

            return (
              <div key={idx} className="space-y-1 my-1">
                {textWithoutImage && <div>{renderFormattedText(textWithoutImage)}</div>}
                {imgObj ? (
                  <div className="my-1.5 text-center bg-white p-1.5 rounded border border-slate-200">
                    <img
                      src={
                        imgObj.previewUrl ||
                        `data:${imgObj.mimeType || 'image/jpeg'};base64,${imgObj.data}`
                      }
                      alt={caption || imgObj.name}
                      className="max-h-48 mx-auto rounded border border-slate-300 object-contain"
                    />
                    {caption && (
                      <p className="text-[11pt] italic text-slate-700 mt-1">{caption}</p>
                    )}
                  </div>
                ) : (
                  <div className="my-1.5 p-2 bg-indigo-50/50 rounded border border-dashed border-indigo-200 text-center">
                    <span className="text-[11pt] italic font-semibold text-indigo-900">
                      [{caption || `Hình ảnh / Sơ đồ: ${imgId}`}]
                    </span>
                  </div>
                )}
              </div>
            );
          }

          const isBullet =
            trimmedSub.startsWith('- ') ||
            trimmedSub.startsWith('– ') ||
            trimmedSub.startsWith('+ ') ||
            trimmedSub.startsWith('* ');
          const cleanBulletLine = trimmedSub.startsWith('* ')
            ? '– ' + trimmedSub.slice(2)
            : trimmedSub;

          return (
            <div
              key={idx}
              className={`${isBullet ? 'pl-2' : ''} ${
                isCellSubHeading ? 'font-bold' : ''
              } text-justify`}
            >
              {renderFormattedText(cleanBulletLine)}
            </div>
          );
        })}
      </div>
    );
  };

  // Render markdown lines, headings, tables, images, generated SVGs, and lists
  const renderDocumentBody = () => {
    const preprocessed = preprocessLessonPlanContent(contentWithTokens, activeMathFormat);
    const lines = preprocessed.split('\n');
    const elements: React.ReactNode[] = [];
    let i = 0;
    let tableRows: string[][] = [];

    const flushTable = (key: string) => {
      if (tableRows.length === 0) return;
      const colCount = Math.max(1, ...tableRows.map((r) => r.length));
      const firstRowJoined = (tableRows[0] || []).join(' ').toUpperCase();
      const isSingleColBox = colCount === 1;
      const isSchoolBanner =
        tableRows.length <= 2 &&
        colCount === 2 &&
        /(?:TRƯỜNG|SỞ\s+GD|PHÒNG\s+GD|TỔ\s*:|TỔ\s+CHUYÊN\s+MÔN|HỌ\s+VÀ\s+TÊN\s+GIÁO\s+VIÊN)/i.test(
          firstRowJoined
        );
      const hasSemanticHeader = tableRows.length >= 2 && !isSingleColBox && !isSchoolBanner;

      const headers = hasSemanticHeader ? tableRows[0] : [];
      const dataRows = hasSemanticHeader ? tableRows.slice(1) : tableRows;

      elements.push(
        <div key={key} className="my-4 overflow-x-auto">
          <table className="min-w-full border-collapse border border-slate-400 bg-white">
            {hasSemanticHeader && (
              <thead>
                <tr className="bg-slate-100">
                  {headers.map((h, colIdx) => (
                    <th
                      key={colIdx}
                      className="border border-slate-400 px-3 py-2 text-center font-bold text-slate-900 align-middle"
                    >
                      {renderTableCell(h)}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {dataRows.map((row, rowIdx) => (
                <tr key={rowIdx} className="hover:bg-slate-50/40">
                  {row.map((cell, cellIdx) => (
                    <td
                      key={cellIdx}
                      className="border border-slate-400 px-3 py-2 align-top text-justify"
                    >
                      {renderTableCell(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableRows = [];
    };

    while (i < lines.length) {
      const line = lines[i];
      const cleaned = cleanLineFormatting(line);
      const trimmed = cleaned.trim();

      // Skip horizontal divider rules (***, ---, ___)
      if (/^(?:\*{3,}|-{3,}|_{3,})$/.test(trimmed)) {
        i++;
        continue;
      }

      // 1. Standalone generated mathematical SVG tag: [[GEN_SVG:gen_svg_1:Hình 1...]]
      const genSvgMatch = trimmed.match(/^\[\[GEN_SVG:([^:\]]+)(?::([\s\S]*?))?\]\]$/);
      if (genSvgMatch) {
        if (tableRows.length > 0) flushTable(`table_${i}`);
        elements.push(
          <div key={`gensvg_${i}`}>
            {renderGeneratedVisualBlock(
              genSvgMatch[1].trim(),
              (genSvgMatch[2] || '').trim(),
              false
            )}
          </div>
        );
        i++;
        continue;
      }

      // 2. Standalone uploaded image tag: [[IMAGE:1:Hình 1...]]
      const imgMatch = trimmed.match(/^\[\[IMAGE:([^:\]]+)(?::([\s\S]*?))?\]\]$/);
      if (imgMatch) {
        if (tableRows.length > 0) flushTable(`table_${i}`);
        const imgId = imgMatch[1];
        const caption = imgMatch[2] || '';
        const imgObj = findMatchingImage(imgId);

        elements.push(
          <div
            key={`img_${i}`}
            className="my-5 text-center bg-white p-3 rounded-lg border border-slate-200"
          >
            {imgObj ? (
              <img
                src={
                  imgObj.previewUrl ||
                  `data:${imgObj.mimeType || 'image/jpeg'};base64,${imgObj.data}`
                }
                alt={caption || imgObj.name}
                className="max-h-80 mx-auto rounded border border-slate-300 object-contain"
              />
            ) : (
              <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg text-indigo-900 text-xs inline-flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-indigo-600" />
                <span className="font-semibold italic text-sm">
                  [{caption || `Hình ảnh / Sơ đồ bài dạy: ${imgId}`}]
                </span>
              </div>
            )}
            {caption && (
              <p className="text-center text-[11pt] italic text-slate-700 mt-2">{caption}</p>
            )}
          </div>
        );
        i++;
        continue;
      }

      // 3. Markdown Table row: starts and ends with |
      if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        if (/^\|[\s\-:|]+\|$/.test(trimmed)) {
          i++;
          continue;
        }
        const cells = splitMarkdownTableRow(trimmed).map((c) => cleanLineFormatting(c.trim(), true));
        tableRows.push(cells);
        i++;
        continue;
      } else if (tableRows.length > 0) {
        flushTable(`table_${i}`);
      }

      if (!trimmed) {
        elements.push(<div key={`blank_${i}`} className="h-1.5" />);
        i++;
        continue;
      }

      // 4. Inline [[GEN_SVG:...]] embedded inside a non-table paragraph
      if (/\[\[GEN_SVG:[^:\]]+(?::[\s\S]*?)?\]\]/.test(trimmed)) {
        const inlineMatch = trimmed.match(/\[\[GEN_SVG:([^:\]]+)(?::([\s\S]*?))?\]\]/)!;
        const before = trimmed.slice(0, inlineMatch.index || 0).trim();
        const after = trimmed.slice((inlineMatch.index || 0) + inlineMatch[0].length).trim();
        elements.push(
          <div key={`p_svg_${i}`} className="my-2">
            {before && (
              <p
                className="indent-8 text-justify"
                style={{ marginBottom: `${activeParaAfterPt}pt` }}
              >
                {renderFormattedText(before)}
              </p>
            )}
            {renderGeneratedVisualBlock(
              inlineMatch[1].trim(),
              (inlineMatch[2] || '').trim(),
              false
            )}
            {after && (
              <p
                className="indent-8 text-justify"
                style={{ marginBottom: `${activeParaAfterPt}pt` }}
              >
                {renderFormattedText(after)}
              </p>
            )}
          </div>
        );
        i++;
        continue;
      }

      // Strip any leading Markdown heading hashes (# through ######)
      const { level: hashLevel, text: noHashText } = stripHeadingHashes(trimmed);

      // 5. Title or Heading 1
      if (
        hashLevel === 1 ||
        noHashText.startsWith('KẾ HOẠCH BÀI DẠY') ||
        noHashText.startsWith('GIÁO ÁN') ||
        /^BÀI\s+\d+[:.\s]/i.test(noHashText) ||
        /^CHỦ\s+ĐỀ\s+\d*[:.\s]/i.test(noHashText)
      ) {
        elements.push(
          <h1
            key={`h1_${i}`}
            className="text-center font-bold text-slate-900 my-3 tracking-wide"
            style={{ fontSize: `${activeFontPt + 2}pt` }}
          >
            {renderFormattedText(noHashText)}
          </h1>
        );
        i++;
        continue;
      }

      // 6. Main Roman sections (I. MỤC TIÊU, II. THIẾT BỊ, V. PHỤ LỤC, etc.)
      if (/^[IVXLCDM]+\.\s+/i.test(noHashText) || hashLevel === 2) {
        elements.push(
          <h2
            key={`h2_${i}`}
            className="font-bold text-slate-900 mt-4 mb-2"
            style={{ fontSize: `${activeFontPt + 1}pt` }}
          >
            {renderFormattedText(noHashText)}
          </h2>
        );
        i++;
        continue;
      }

      // 7. Subsections (1. Về kiến thức, a) Năng lực chung, Hoạt động 1, Phiếu học tập, ###, ####...)
      if (
        /^(\d+(\.\d+)?\.|[a-z][.)])\s+/i.test(noHashText) ||
        /^Hoạt động\s+\d+/i.test(noHashText) ||
        /^PHIẾU HỌC TẬP/i.test(noHashText) ||
        /^BẢNG RUBRIC/i.test(noHashText) ||
        hashLevel >= 3
      ) {
        elements.push(
          <h3 key={`h3_${i}`} className="font-bold text-slate-900 mt-2.5 mb-1.5">
            {renderFormattedText(noHashText)}
          </h3>
        );
        i++;
        continue;
      }

      // 8. Bullet points (with or without [[RED:...]] wrapper)
      const unwrappedForBullet = noHashText.replace(/^\[\[RED:\s*/i, '');
      const bulletMatch = unwrappedForBullet.match(/^([-–*+•])\s+(.*)$/);
      if (bulletMatch) {
        const isRed = /^\[\[RED:/i.test(noHashText);
        const bulletText = isRed ? `[[RED:${bulletMatch[2]}` : bulletMatch[2];
        elements.push(
          <div
            key={`bullet_${i}`}
            className="flex items-start gap-2 pl-5 text-justify"
            style={{ marginBottom: `${Math.max(2, activeParaAfterPt / 2)}pt` }}
          >
            <span className="select-none font-bold text-slate-600">–</span>
            <div className="flex-1">{renderFormattedText(bulletText)}</div>
          </div>
        );
        i++;
        continue;
      }

      // 9. Standalone display math equation ($$...$$ or \[...\])
      const unwrappedMath = noHashText.replace(/^\[\[RED:\s*/i, '').replace(/\]\]$/, '').trim();
      if (/^(\$\$[\s\S]+\$\$|\\\[[\s\S]+\\\])$/.test(unwrappedMath)) {
        elements.push(
          <div
            key={`math_${i}`}
            className="my-2.5 text-center overflow-x-auto py-1"
            style={{ marginBottom: `${activeParaAfterPt}pt` }}
          >
            {renderFormattedText(noHashText)}
          </div>
        );
        i++;
        continue;
      }

      // 10. Regular paragraph (indented)
      elements.push(
        <p
          key={`p_${i}`}
          className="indent-8 text-justify"
          style={{ marginBottom: `${activeParaAfterPt}pt` }}
        >
          {renderFormattedText(noHashText)}
        </p>
      );

      i++;
    }

    if (tableRows.length > 0) {
      flushTable('table_end');
    }

    return elements;
  };

  // Check if original content already has school banner
  const first800 = content.slice(0, 800).toUpperCase();
  const hasExistingHeader =
    preserveOriginalHeader ||
    Boolean(templateProfile?.hasSchoolHeader) ||
    first800.includes('SỞ GIÁO DỤC') ||
    first800.includes('PHÒNG GD') ||
    first800.includes('TRƯỜNG:') ||
    first800.includes('TRƯỜNG TH') ||
    first800.includes('TỔ:') ||
    first800.includes('TỔ CHUYÊN MÔN') ||
    first800.includes('UBND');

  return (
    <div className="space-y-4">
      {/* Export mode & XML Verification Status Banner */}
      <div className="no-print p-3.5 rounded-xl border text-xs bg-emerald-50 border-emerald-300 text-emerald-950 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              <b>Chế độ xuất Word (.docx) đang chọn:</b>{' '}
              {activeMathFormat === 'equation' ? (
                <span className="font-semibold text-indigo-800">
                  Equation (100% đối tượng OMML &lt;m:oMath&gt; chỉnh sửa trực tiếp trong Word)
                </span>
              ) : (
                <span className="font-semibold text-amber-900">
                  LaTeX (100% mã LaTeX thô $...$ nội dòng, $$...$$ riêng dòng căn giữa, không ký tự Unicode toán)
                </span>
              )}{' '}
              · Font <b>{activeFontName}</b> {activeFontPt}pt · Khổ A4 (
              {isNarrowMargin ? 'Lề hẹp 1,27 cm' : 'Trái 2,5 cm, Trên/Dưới/Phải 1,5 cm'})
              {preferDirectDocxInjection
                ? ' · Bảo toàn nguyên bản file Word gốc (.docx) 100%.'
                : ' · Hình vẽ 1pt Black.'}
            </span>
          </div>
        </div>

        {verificationReport && (
          <div
            className={`p-2.5 rounded-lg border flex flex-wrap items-center justify-between gap-2 text-[11px] ${
              verificationReport.passed
                ? 'bg-white border-emerald-300 text-emerald-900'
                : 'bg-amber-50 border-amber-300 text-amber-950'
            }`}
          >
            <div className="flex items-center gap-2">
              {verificationReport.passed ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              )}
              <span>
                <b>Kết quả kiểm tra XML thực tế (word/document.xml):</b> {verificationReport.summary}
              </span>
            </div>
            <div className="flex items-center gap-2 font-mono text-[10px]">
              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800">
                OMML: {verificationReport.ommlEquationCount}
              </span>
              {verificationReport.mathFormat === 'latex' && (
                <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900">
                  LaTeX:{' '}
                  {verificationReport.rawInlineLatexCount + verificationReport.rawDisplayLatexCount}
                </span>
              )}
              <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-800">
                Hình vẽ/Ảnh: {verificationReport.embeddedImageCount}
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800">
                Bảng: {verificationReport.tableCount}
              </span>
              <span className="px-2 py-0.5 rounded bg-red-50 text-red-700">
                NLS đỏ: {verificationReport.redRunCount}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Control Bar */}
      <div className="no-print bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Red highlight switcher */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-700">Màu NLS:</span>
            <button
              type="button"
              onClick={() => setHighlightRed(true)}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
                highlightRed
                  ? 'bg-red-50 text-red-700 border border-red-200'
                  : 'bg-slate-100 text-slate-600 hover:text-slate-900'
              }`}
            >
              Bôi đỏ ({redMatchCount})
            </button>
            <button
              type="button"
              onClick={() => setHighlightRed(false)}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
                !highlightRed
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:text-slate-900'
              }`}
            >
              Đen đồng nhất
            </button>
          </div>

          {/* 2-Choice Equation vs LaTeX Switcher */}
          {onChangeFormattingOptions && formattingOptions && (
            <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200">
              <FileCode2 className="w-3.5 h-3.5 text-indigo-600" />
              <span className="text-xs font-semibold text-slate-700">Công thức Toán:</span>
              <button
                type="button"
                onClick={() => handleSwitchMathFormat('equation')}
                className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${
                  activeMathFormat === 'equation'
                    ? 'bg-indigo-600 text-white font-semibold shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                }`}
                title="Xuất 100% công thức thành đối tượng Equation OMML chỉnh sửa trực tiếp trong Microsoft Word"
              >
                Equation (OMML)
              </button>
              <button
                type="button"
                onClick={() => handleSwitchMathFormat('latex')}
                className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${
                  activeMathFormat === 'latex'
                    ? 'bg-amber-600 text-white font-semibold shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                }`}
                title="Xuất 100% công thức dưới dạng mã LaTeX thô $...$ và $$...$$ (không tạo OMML, không ký tự Unicode toán)"
              >
                LaTeX ($...$)
              </button>
            </div>
          )}

          {/* Embedded Visuals Counter */}
          {totalVisualCount > 0 ? (
            <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full font-semibold text-[11px] flex items-center gap-1">
              <ImageIcon className="w-3 h-3" /> Đã chèn {totalVisualCount} hình vẽ &amp; đồ thị
            </span>
          ) : sgkImages.length > 0 ? (
            <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full font-medium text-[11px] flex items-center gap-1">
              <ImageIcon className="w-3 h-3" /> Đã nạp {sgkImages.length} tài liệu hình ảnh
            </span>
          ) : null}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsEditing(!isEditing)}
            className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              isEditing
                ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>{isEditing ? 'Xem trang A4' : 'Chỉnh sửa'}</span>
          </button>

          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
          >
            {isCopied ? (
              <Check className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            <span>{isCopied ? 'Đã chép' : 'Sao chép'}</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>In A4</span>
          </button>

          {originalDocxBuffer &&
            (preferDirectDocxInjection ? (
              <button
                type="button"
                onClick={handleExportRebuiltWord}
                disabled={isExporting}
                title="Dựng lại thành tệp Word mới chuẩn hóa khổ A4 theo các tùy chọn font/lề đã chọn"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors disabled:opacity-50"
              >
                <FileText className="w-3.5 h-3.5 text-indigo-600" />
                <span>Tải bản dựng mới A4</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleExportInjectedWord}
                disabled={isExporting}
                title="Giữ nguyên 100% file Word gốc đã tải lên (bố cục, bảng, ảnh, Equation, Phiếu học tập) và chỉ chèn thêm nội dung Năng lực số màu đỏ"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors disabled:opacity-50"
              >
                <FileText className="w-3.5 h-3.5 text-indigo-600" />
                <span>Chèn vào file Word gốc</span>
              </button>
            ))}

          <button
            type="button"
            onClick={handlePrimaryExportWord}
            disabled={isExporting}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 active:bg-red-800 rounded-lg shadow-sm transition-colors disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>
              {isExporting
                ? 'Đang kiểm tra XML & xuất Word...'
                : preferDirectDocxInjection
                ? `Tải Word giữ nguyên gốc (${activeMathFormat === 'latex' ? 'LaTeX' : 'Equation'})`
                : `Tải Word (${activeMathFormat === 'latex' ? 'LaTeX' : 'Equation'})`}
            </span>
          </button>
        </div>
      </div>

      {/* Editor or Live A4 Preview */}
      {isEditing ? (
        <div className="no-print bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>
              Chỉnh sửa văn bản trực tiếp (Bôi đỏ:{' '}
              <code className="text-red-600 font-mono">[[RED:nội dung]]</code>, chèn ảnh:{' '}
              <code className="text-indigo-600 font-mono">[[IMAGE:1:Chú thích]]</code>, hoặc khối
              hình vẽ <code className="text-emerald-700 font-mono">&lt;svg&gt;...&lt;/svg&gt;</code>)
            </span>
            <button
              onClick={() => setIsEditing(false)}
              className="text-indigo-600 font-medium hover:underline"
            >
              Hoàn tất chỉnh sửa &amp; xem trang A4
            </button>
          </div>
          <textarea
            rows={28}
            value={content}
            onChange={(e) => onChangeContent(e.target.value)}
            className="w-full text-xs font-mono p-4 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 leading-relaxed"
          />
        </div>
      ) : (
        <div className="py-6 px-2 sm:px-4 bg-slate-200/60 rounded-2xl overflow-x-auto flex justify-center">
          <div
            className="a4-page-simulation flex flex-col justify-between"
            style={{
              fontFamily: `"${activeFontName}", 'Tinos', Times, serif`,
              fontSize: `${activeFontPt}pt`,
              lineHeight: activeLineHeight,
              padding: isNarrowMargin ? '1.27cm' : '1.5cm 1.5cm 1.5cm 2.5cm',
            }}
          >
            <div>
              {/* Top-center Header Page Number (when selected) */}
              {activePageNumber === 'top-center' && (
                <div
                  className="text-center text-slate-700 mb-5 select-none font-normal"
                  style={{ fontSize: `${Math.max(11, activeFontPt - 1)}pt` }}
                >
                  1
                </div>
              )}

              {/* School Banner */}
              {!hasExistingHeader && (
                <div
                  className="grid grid-cols-2 text-center mb-6"
                  style={{ fontSize: `${Math.max(11, activeFontPt - 1)}pt` }}
                >
                  <div>
                    <p className="font-bold uppercase">SỞ GIÁO DỤC VÀ ĐÀO TẠO .....</p>
                    <p className="font-bold">TRƯỜNG: .....................................</p>
                    <div className="w-24 h-0.5 bg-slate-400 mx-auto my-1" />
                  </div>
                  <div>
                    <p className="font-bold">TỔ CHUYÊN MÔN: ................................</p>
                    <p className="italic">GIÁO VIÊN: ................................</p>
                    <div className="w-24 h-0.5 bg-slate-400 mx-auto my-1" />
                  </div>
                </div>
              )}

              {/* Document Body */}
              {renderDocumentBody()}
            </div>

            {/* Bottom Footer Page Number (when selected) */}
            {(activePageNumber === 'bottom-center' || activePageNumber === 'bottom-right') && (
              <div
                className={`mt-8 pt-3 border-t border-slate-100 text-slate-600 select-none font-normal ${
                  activePageNumber === 'bottom-right' ? 'text-right' : 'text-center'
                }`}
                style={{ fontSize: `${Math.max(11, activeFontPt - 1)}pt` }}
              >
                1
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
