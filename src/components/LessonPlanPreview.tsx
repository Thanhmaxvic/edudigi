import React, { useState } from 'react';
import { Download, Copy, Printer, Check, Edit3, Image as ImageIcon } from 'lucide-react';
import { exportLessonPlanToDocx, cleanLineFormatting, preprocessLessonPlanContent, ImageAttachment, FormattingOptions } from '../utils/docxExport';
import { renderLatexToHtml, latexToUnicode } from '../utils/mathConverter';
import { injectIntoDocxWithReport } from '../utils/docxInjector';
import { saveAs } from 'file-saver';

export interface SgkImagePreviewItem {
  id: string;
  name: string;
  mimeType: string;
  data: string;
  previewUrl: string;
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
  formattingOptions?: FormattingOptions;
}

export const LessonPlanPreview: React.FC<LessonPlanPreviewProps> = ({
  content,
  onChangeContent,
  lessonTitle,
  subject,
  grade,
  isGenerating = false,
  sgkImages = [],
  originalDocxBuffer = null,
  formattingOptions,
}) => {
  const [highlightRed, setHighlightRed] = useState(true);
  const [isCopied, setIsCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Count red highlighted additions
  const redMatchCount = (content.match(/\[\[RED:/g) || []).length;

  const handleCopy = () => {
    // Clean [[RED:...]] tags and [[IMAGE:...]] tags for plain text copying
    const preprocessed = preprocessLessonPlanContent(content);
    const cleanText = preprocessed
      .replace(/\[\[RED:(.*?)\]\]/g, '$1')
      .replace(/\[\[RED:?/g, '')
      .replace(/\]\]/g, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/\[\[IMAGE:[^:\]]+(?:\:(.*?))?\]\]/g, '[$1]');
    navigator.clipboard.writeText(cleanText);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

  const handleExportWord = async () => {
    try {
      setIsExporting(true);
      if (originalDocxBuffer) {
        // Hướng 2: Kiến trúc Bảo toàn nguyên bản (AST Injection)
        const { blob, report } = await injectIntoDocxWithReport(originalDocxBuffer, content);
        saveAs(blob, `[NangLucSo] ${lessonTitle || 'GiaoAn'}.docx`);
        if (report.appended > 0) {
          alert(
            `Đã chèn ${report.injected}/${report.total} nội dung năng lực số vào đúng vị trí.\n` +
              `${report.appended} nội dung chưa xác định được vị trí đã được đưa vào PHỤ LỤC cuối giáo án.`
          );
        }
      } else {
        // Hướng cũ: Rebuild từ Markdown
        await exportLessonPlanToDocx(content, {
          lessonTitle,
          subject,
          grade,
          images: sgkImages,
          formatting: formattingOptions,
        });
      }
    } catch (err: any) {
      console.error('Word export error:', err);
      alert('Có lỗi xảy ra khi tạo tệp Word: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const findMatchingImage = (idOrIndex: string) => {
    // 1. Direct match by id
    const byId = sgkImages.find((img) => img.id === idOrIndex);
    if (byId) return byId;

    // 2. Match by numeric index (e.g. 1 -> sgkImages[0])
    const num = parseInt(idOrIndex, 10);
    if (!isNaN(num) && num > 0 && num <= sgkImages.length) {
      return sgkImages[num - 1];
    }

    // 3. Match by name
    return sgkImages.find((img) => img.name && (img.name === idOrIndex || img.name.includes(idOrIndex))) || null;
  };

  // Helper to parse math ($...$, $$...$$, \(...\), \[...\]) and bold (**...**) inside a text slice
  const renderSegmentWithMathAndBold = (segment: string, isRed: boolean, baseKey: string) => {
    if (!segment) return null;

    // 1. Math regex: $$...$$ or \[...\] or $...$ or \(...\)
    const mathRegex = /(?:\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\$([^$]+?)\$|\\\(([\s\S]+?)\\\))/g;
    const elements: React.ReactNode[] = [];
    let lastIdx = 0;
    let match: RegExpExecArray | null;
    let subIdx = 0;

    const renderTextRuns = (txt: string, runKey: string) => {
      if (!txt) return null;
      // Bold regex
      const boldRegex = /\*\*(.*?)\*\*/g;
      let bLast = 0;
      let bMatch: RegExpExecArray | null;
      const bNodes: React.ReactNode[] = [];
      let bIdx = 0;

      while ((bMatch = boldRegex.exec(txt)) !== null) {
        if (bMatch.index > bLast) {
          const normal = txt.substring(bLast, bMatch.index);
          if (normal) {
            bNodes.push(<span key={`${runKey}_norm_${bIdx++}`}>{latexToUnicode(normal)}</span>);
          }
        }
        const boldContent = bMatch[1];
        if (boldContent) {
          bNodes.push(
            <strong key={`${runKey}_bold_${bIdx++}`} className={isRed ? 'font-normal' : 'font-bold'}>
              {latexToUnicode(boldContent)}
            </strong>
          );
        }
        bLast = boldRegex.lastIndex;
      }

      if (bLast < txt.length) {
        const rem = txt.substring(bLast);
        if (rem) {
          bNodes.push(<span key={`${runKey}_rem_${bIdx++}`}>{latexToUnicode(rem)}</span>);
        }
      }

      return bNodes.length > 0 ? bNodes : latexToUnicode(txt);
    };

    while ((match = mathRegex.exec(segment)) !== null) {
      if (match.index > lastIdx) {
        const textBefore = segment.substring(lastIdx, match.index);
        if (textBefore) {
          elements.push(
            <span key={`${baseKey}_txt_${subIdx++}`}>
              {renderTextRuns(textBefore, `${baseKey}_b_${subIdx}`)}
            </span>
          );
        }
      }

      const displayMath = match[1] || match[2];
      const inlineMath = match[3] || match[4];
      const formula = displayMath || inlineMath;

      if (displayMath) {
        elements.push(
          <span
            key={`${baseKey}_math_${subIdx++}`}
            className="my-1.5 block text-center overflow-x-auto py-1"
            dangerouslySetInnerHTML={{ __html: renderLatexToHtml(formula, true) }}
          />
        );
      } else if (inlineMath) {
        elements.push(
          <span
            key={`${baseKey}_math_${subIdx++}`}
            className="inline-block mx-0.5 align-middle"
            dangerouslySetInnerHTML={{ __html: renderLatexToHtml(formula, false) }}
          />
        );
      }

      lastIdx = mathRegex.lastIndex;
    }

    if (lastIdx < segment.length) {
      const textAfter = segment.substring(lastIdx);
      if (textAfter) {
        elements.push(
          <span key={`${baseKey}_txt_${subIdx++}`}>
            {renderTextRuns(textAfter, `${baseKey}_a_${subIdx}`)}
          </span>
        );
      }
    }

    return elements.length > 0 ? elements : renderTextRuns(segment, `${baseKey}_fallback`);
  };

  // Helper to parse line with [[RED:...]] into React elements
  const renderFormattedText = (text: string) => {
    let clean = cleanLineFormatting(text)
      .replace(/\[\.\.\.\]/g, '')
      .replace(/\[i\]/gi, '')
      .replace(/\[\d+\]/g, '')
      .replace(/&lt;br\s*\/?&gt;\s*[-–]?\s*/gi, ' ')
      .replace(/<br\s*\/?>\s*[-–]?\s*/gi, ' ')
      .replace(/&lt;br\s*\/?&gt;/gi, '')
      .replace(/<br\s*\/?>/gi, '');

    // Normalize case-insensitivity and spacing for [[RED:
    clean = clean.replace(/\[\[\s*red\s*:/gi, '[[RED:');

    // Auto-close unclosed [[RED: if present
    const opens = (clean.match(/\[\[RED:/g) || []).length;
    const closes = (clean.match(/\]\]/g) || []).length;
    if (opens > closes) {
      clean += ']]'.repeat(opens - closes);
    }

    const regex = /\[\[RED:([\s\S]*?)\]\]/gi;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let keyIdx = 0;

    while ((match = regex.exec(clean)) !== null) {
      if (match.index > lastIndex) {
        const preText = clean.substring(lastIndex, match.index).replace(/\[\[\s*RED:?/gi, '').replace(/\]\]/g, '');
        if (preText) {
          parts.push(
            <span key={`text_${keyIdx++}`}>
              {renderSegmentWithMathAndBold(preText, false, `p_${keyIdx}`)}
            </span>
          );
        }
      }

      const redText = match[1].replace(/\[\[\s*RED:?/gi, '').replace(/\]\]/g, '');
      if (redText) {
        parts.push(
          <span
            key={`red_${keyIdx++}`}
            className={highlightRed ? 'edudigi-red-text' : 'text-slate-900 font-normal'}
            title={highlightRed ? 'Nội dung mới tích hợp Năng lực số (chỉ bôi đỏ, không in đậm)' : undefined}
          >
            {renderSegmentWithMathAndBold(redText, true, `r_${keyIdx}`)}
          </span>
        );
      }

      lastIndex = regex.lastIndex;
    }

    if (lastIndex < clean.length) {
      const remText = clean.substring(lastIndex).replace(/\[\[\s*RED:?/gi, '').replace(/\]\]/g, '');
      if (remText) {
        parts.push(
          <span key={`text_${keyIdx++}`}>
            {renderSegmentWithMathAndBold(remText, false, `rem_${keyIdx}`)}
          </span>
        );
      }
    }

    return parts.length > 0 ? parts : renderSegmentWithMathAndBold(clean.replace(/\[\[\s*RED:?/gi, '').replace(/\]\]/g, ''), false, 'full_fallback');
  };

  // Renders cell content, supporting embedded images and multi-paragraph cells inside multi-column tables
  const renderTableCell = (cellText: string) => {
    const subLines = cellText.split(/<br\s*\/?>/i);

    return (
      <div className="space-y-1.5">
        {subLines.map((sub, idx) => {
          let trimmedSub = sub.trim();
          if (!trimmedSub) return null;

          // Strip any leading <br> or <br>- artifacts
          trimmedSub = trimmedSub
            .replace(/^&lt;br\s*\/?&gt;\s*[-–]?\s*/i, '')
            .replace(/^<br\s*\/?>\s*[-–]?\s*/i, '')
            .replace(/&lt;br\s*\/?&gt;/gi, '')
            .replace(/<br\s*\/?>/gi, '');
          if (!trimmedSub) return null;

          const imageMatch = trimmedSub.match(/\[\[IMAGE:([^:\]]+)(?:\:([\s\S]*?))?\]\]/);
          if (imageMatch) {
            const imgId = imageMatch[1];
            const caption = imageMatch[2] || '';
            const imgObj = findMatchingImage(imgId);
            const textWithoutImage = trimmedSub.replace(imageMatch[0], '').trim();

            return (
              <div key={idx} className="space-y-1 my-1">
                {textWithoutImage && <div>{renderFormattedText(textWithoutImage)}</div>}
                {imgObj ? (
                  <div className="my-1.5 text-center bg-slate-50 p-1.5 rounded border border-slate-200">
                    <img
                      src={imgObj.previewUrl || `data:${imgObj.mimeType || 'image/jpeg'};base64,${imgObj.data}`}
                      alt={caption || imgObj.name}
                      className="max-h-44 mx-auto rounded border border-slate-300 shadow-2xs object-contain"
                    />
                    {caption && (
                      <p className="text-[11px] italic font-times text-slate-600 mt-1">
                        {caption}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="my-1.5 p-2 bg-indigo-50/50 rounded border border-dashed border-indigo-200 text-center">
                    <span className="text-[11px] italic font-times font-semibold text-indigo-900">
                      [{caption || `Hình ảnh / Sơ đồ: ${imgId}`}]
                    </span>
                  </div>
                )}
              </div>
            );
          }

          const isBullet = trimmedSub.startsWith('- ') || trimmedSub.startsWith('– ') || trimmedSub.startsWith('+ ');
          return (
            <div key={idx} className={isBullet ? 'pl-2 text-justify' : 'text-justify'}>
              {renderFormattedText(trimmedSub)}
            </div>
          );
        })}
      </div>
    );
  };

  // Render markdown lines, headings, tables, images, and lists
  const renderDocumentBody = () => {
    const preprocessed = preprocessLessonPlanContent(content);
    const lines = preprocessed.split('\n');
    const elements: React.ReactNode[] = [];
    let i = 0;
    let tableRows: string[][] = [];

    const flushTable = (key: string) => {
      if (tableRows.length === 0) return;
      const headers = tableRows[0];
      const dataRows = tableRows.slice(1);

      elements.push(
        <div key={key} className="my-5 overflow-x-auto">
          <table className="min-w-full border-collapse border border-slate-300 text-[13pt] font-times bg-white shadow-2xs">
            <thead>
              <tr className="bg-slate-100">
                {headers.map((h, colIdx) => (
                  <th
                    key={colIdx}
                    className="border border-slate-300 px-3 py-2 text-center font-bold text-slate-900 align-middle"
                  >
                    {renderTableCell(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dataRows.map((row, rowIdx) => (
                <tr key={rowIdx} className="hover:bg-slate-50/50">
                  {row.map((cell, cellIdx) => (
                    <td
                      key={cellIdx}
                      className="border border-slate-300 px-3 py-2.5 align-top text-justify leading-relaxed"
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

      // Check if standalone image tag: [[IMAGE:1:Hình 1. Thí nghiệm...]] or [[IMAGE:old_plan_img_1:...]]
      const imgMatch = trimmed.match(/^\[\[IMAGE:([^:\]]+)(?:\:([\s\S]*?))?\]\]$/);
      if (imgMatch) {
        if (tableRows.length > 0) flushTable(`table_${i}`);
        const imgId = imgMatch[1];
        const caption = imgMatch[2] || '';
        const imgObj = findMatchingImage(imgId);

        elements.push(
          <div key={`img_${i}`} className="my-6 text-center bg-slate-50/70 p-3.5 rounded-xl border border-slate-200">
            {imgObj ? (
              <img
                src={imgObj.previewUrl || `data:${imgObj.mimeType || 'image/jpeg'};base64,${imgObj.data}`}
                alt={caption || imgObj.name}
                className="max-h-80 mx-auto rounded-lg shadow-xs border border-slate-300 object-contain"
              />
            ) : (
              <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg text-indigo-900 text-xs inline-flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-indigo-600" />
                <span className="font-semibold font-times italic text-sm">[{caption || `Hình ảnh / Sơ đồ bài dạy: ${imgId}`}]</span>
              </div>
            )}
            {caption && (
              <p className="text-center text-xs italic font-times text-slate-600 mt-2 font-medium">
                {caption}
              </p>
            )}
          </div>
        );
        i++;
        continue;
      }

      // Check table row: starts and ends with |
      if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        if (/^\|[\s\-:|]+\|$/.test(trimmed)) {
          i++;
          continue;
        }
        const cells = trimmed
          .slice(1, -1)
          .split('|')
          .map((c) => cleanLineFormatting(c.trim(), true));
        tableRows.push(cells);
        i++;
        continue;
      } else if (tableRows.length > 0) {
        flushTable(`table_${i}`);
      }

      if (!trimmed) {
        elements.push(<div key={`blank_${i}`} className="h-2" />);
        i++;
        continue;
      }

      // Title or Heading 1
      if (trimmed.startsWith('# ') || trimmed.startsWith('KẾ HOẠCH BÀI DẠY') || trimmed.startsWith('GIÁO ÁN')) {
        const text = trimmed.replace(/^#\s*/, '');
        elements.push(
          <h1
            key={`h1_${i}`}
            className="text-center font-bold text-lg md:text-xl text-slate-900 my-4 tracking-wide font-times"
          >
            {text}
          </h1>
        );
        i++;
        continue;
      }

      // Main Roman sections (I. MỤC TIÊU, II. THIẾT BỊ, etc.) - no leading '*' or '.'
      if (/^[I|V|XLCDM]+\.\s+/i.test(trimmed) || trimmed.startsWith('## ')) {
        const text = trimmed.replace(/^##\s*/, '');
        elements.push(
          <h2
            key={`h2_${i}`}
            className="font-bold text-[14pt] text-slate-900 mt-4 mb-2 font-times"
          >
            {renderFormattedText(text)}
          </h2>
        );
        i++;
        continue;
      }

      // Subsections (1. Về kiến thức, a) Năng lực chung, ### etc.) - no leading '*' or '.'
      if (/^(\d+\.|[a-z]\))\s+/i.test(trimmed) || /^Hoạt động\s+\d+/i.test(trimmed) || trimmed.startsWith('### ')) {
        const text = trimmed.replace(/^###\s*/, '');
        elements.push(
          <h3
            key={`h3_${i}`}
            className="font-semibold text-[13pt] text-slate-900 mt-2 mb-1.5 font-times"
          >
            {renderFormattedText(text)}
          </h3>
        );
        i++;
        continue;
      }

      // Bullet points (with or without [[RED:...]] wrapper)
      const unwrappedForBullet = trimmed.replace(/^\[\[RED:\s*/i, '');
      const bulletMatch = unwrappedForBullet.match(/^([-–*+])\s+(.*)$/);
      if (bulletMatch) {
        const isRed = trimmed.startsWith('[[RED:');
        const bulletText = isRed ? `[[RED:${bulletMatch[2]}` : bulletMatch[2];
        elements.push(
          <div
            key={`bullet_${i}`}
            className="flex items-start gap-2 pl-6 mb-1 text-justify font-times text-[13pt] leading-relaxed"
          >
            <span className="select-none font-bold text-slate-500">–</span>
            <div className="flex-1">{renderFormattedText(bulletText)}</div>
          </div>
        );
        i++;
        continue;
      }

      // Regular paragraph (indented)
      elements.push(
        <p
          key={`p_${i}`}
          className="indent-8 text-justify font-times text-[13pt] leading-relaxed mb-2"
        >
          {renderFormattedText(trimmed)}
        </p>
      );

      i++;
    }

    if (tableRows.length > 0) {
      flushTable(`table_end`);
    }

    return elements;
  };

  // Check if original content already has school banner
  const first500 = content.slice(0, 500).toUpperCase();
  const hasExistingHeader =
    first500.includes('SỞ GIÁO DỤC') ||
    first500.includes('PHÒNG GD') ||
    first500.includes('TRƯỜNG:') ||
    first500.includes('TRƯỜNG TH') ||
    first500.includes('UBND');

  return (
    <div className="space-y-4">
      {/* Export mode indicator */}
      <div
        className={`no-print p-3 rounded-xl border text-xs ${
          originalDocxBuffer
            ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
            : 'bg-amber-50 border-amber-300 text-amber-900'
        }`}
      >
        {originalDocxBuffer ? (
          <span>
            <b>✔ Chế độ BẢO TOÀN NGUYÊN BẢN đang bật:</b> file Word tải về giữ nguyên 100% công thức, bảng biểu, hình ảnh
            của giáo án gốc, chỉ chèn thêm nội dung năng lực số màu đỏ. (Khung xem trước bên dưới chỉ là bản nháp văn bản,
            công thức/hình có thể hiển thị chưa đúng – file Word tải về mới là bản chuẩn.)
          </span>
        ) : (
          <span>
            <b>⚠ Chế độ DỰNG LẠI (không có file Word gốc):</b> công thức Toán, bảng và hình có thể bị sai lệch. Để giữ nguyên
            100%, hãy quay lại Bước 4 và tải lên giáo án gốc dạng <b>.docx</b> (không dùng PDF), rồi soạn lại.
          </span>
        )}
      </div>
      {/* Control Bar */}
      <div className="no-print bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-700">Chế độ hiển thị:</span>
            <button
              type="button"
              onClick={() => setHighlightRed(true)}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
                highlightRed
                  ? 'bg-red-50 text-red-700 border border-red-200 font-medium'
                  : 'bg-slate-100 text-slate-600 hover:text-slate-900'
              }`}
            >
              Bôi đỏ nội dung mới ({redMatchCount})
            </button>
            <button
              type="button"
              onClick={() => setHighlightRed(false)}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
                !highlightRed
                  ? 'bg-slate-900 text-white font-medium'
                  : 'bg-slate-100 text-slate-600 hover:text-slate-900'
              }`}
            >
              Màu đen đồng nhất (Bản in)
            </button>
          </div>

          <div className="hidden lg:flex items-center text-xs text-slate-500 gap-2 pl-2 border-l border-slate-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            <span>Khổ A4 (Trái 2.5cm, Trên/Dưới/Phải 1.5cm, Số trang ở giữa header)</span>
            {sgkImages.length > 0 && (
              <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full font-medium text-[11px] flex items-center gap-1">
                <ImageIcon className="w-3 h-3" /> Đã gắn {sgkImages.length} ảnh SGK
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
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
            {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
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

          <button
            type="button"
            onClick={handleExportWord}
            disabled={isExporting}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 active:bg-red-800 rounded-lg shadow-sm transition-colors disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isExporting ? 'Đang xuất Word...' : 'Tải file Word (.docx)'}</span>
          </button>
        </div>
      </div>

      {/* Editor or Live Preview */}
      {isEditing ? (
        <div className="no-print bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>
              Chỉnh sửa văn bản trực tiếp (Cú pháp bôi đỏ: <code className="text-red-600 font-mono">[[RED:nội dung]]</code>, chèn ảnh: <code className="text-indigo-600 font-mono">[[IMAGE:1:Hình 1. Chú thích]]</code>)
            </span>
            <button
              onClick={() => setIsEditing(false)}
              className="text-indigo-600 font-medium hover:underline"
            >
              Hoàn tất chỉnh sửa & xem trang A4
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
          <div className="a4-page-simulation">
            {/* Header: Centered page number only */}
            <div className="text-center text-[12pt] font-times text-slate-700 mb-6 select-none font-normal">
              1
            </div>

            {/* School Banner */}
            {!hasExistingHeader && (
              <div className="grid grid-cols-2 text-center text-[12pt] font-times mb-6">
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
        </div>
      )}
    </div>
  );
};
