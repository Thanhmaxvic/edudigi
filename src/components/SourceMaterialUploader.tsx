import React, { useRef, useState } from 'react';
import {
  Upload,
  Camera,
  Trash2,
  Sparkles,
  FileText,
  CheckCircle2,
  FileUp,
  Image as ImageIcon,
  ShieldCheck,
  Eye,
} from 'lucide-react';
import { extractTextFromFile } from '../utils/fileExtractor';
import { TeacherAccount } from '../utils/userAccount';

export interface SgkImageItem {
  id: string;
  name: string;
  mimeType: string;
  data: string;
  previewUrl: string;
}

interface SourceMaterialUploaderProps {
  sgkImages: SgkImageItem[];
  setSgkImages: React.Dispatch<React.SetStateAction<SgkImageItem[]>>;
  oldLessonPlanText: string;
  setOldLessonPlanText: (text: string) => void;
  customNote: string;
  setCustomNote: (text: string) => void;
  teacherAccount?: TeacherAccount | null;
  onOpenAccountModal?: () => void;
  oldPlanImages?: SgkImageItem[];
  setOldPlanImages?: React.Dispatch<React.SetStateAction<SgkImageItem[]>>;
  setOriginalDocxBuffer?: (buffer: ArrayBuffer | null) => void;
}

export const SourceMaterialUploader: React.FC<SourceMaterialUploaderProps> = ({
  sgkImages,
  setSgkImages,
  oldLessonPlanText,
  setOldLessonPlanText,
  customNote,
  setCustomNote,
  teacherAccount,
  onOpenAccountModal,
  oldPlanImages = [],
  setOldPlanImages,
  setOriginalDocxBuffer,
}) => {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const planFileInputRef = useRef<HTMLInputElement>(null);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [planFileName, setPlanFileName] = useState<string | null>(null);
  const [isReadingPlan, setIsReadingPlan] = useState(false);

  // Local fallback if setOldPlanImages is not passed
  const [localOldPlanImages, setLocalOldPlanImages] = useState<SgkImageItem[]>([]);
  const effectiveOldPlanImages = setOldPlanImages ? oldPlanImages : localOldPlanImages;
  const updateOldPlanImages = setOldPlanImages || setLocalOldPlanImages;

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1200;
          const MAX_HEIGHT = 1600;
          let width = img.width;
          let height = img.height;
  
          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.6));
          } else {
            resolve(event.target?.result as string);
          }
        };
        img.onerror = error => reject(error);
      };
      reader.onerror = error => reject(error);
    });
  };

  const addSgkImageFiles = async (files: File[], source: 'upload' | 'paste') => {
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      
      try {
        const fullBase64 = await compressImage(file);
        const commaIndex = fullBase64.indexOf(',');
        const rawBase64 = commaIndex !== -1 ? fullBase64.substring(commaIndex + 1) : fullBase64;
  
        setSgkImages((prev) => {
          const nextIndex = prev.length + 1;
          const cleanName =
            source === 'paste' ? 'Ảnh dán trực tiếp' : file.name.replace(/\.[^/.]+$/, '');
          return [
            ...prev,
            {
              id: `${Date.now()}_sgk_${Math.random().toString(36).substr(2, 7)}`,
              name: `Trang SGK ${nextIndex}: ${cleanName}`,
              mimeType: 'image/jpeg',
              data: rawBase64,
              previewUrl: fullBase64,
            },
          ];
        });
      } catch (err) {
        console.error('Error compressing image:', err);
      }
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    addSgkImageFiles(Array.from(files), 'upload');

    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
  };

  // Paste images directly from clipboard (Ctrl+V: screenshot, copied image...)
  const [pasteNotice, setPasteNotice] = useState<string | null>(null);
  const handlePasteImages = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = Array.from(e.clipboardData?.items || []);
    const files = items
      .filter((it) => it.kind === 'file' && it.type.startsWith('image/'))
      .map((it) => it.getAsFile())
      .filter((f): f is File => !!f);

    e.preventDefault();
    if (files.length === 0) {
      setPasteNotice('Bộ nhớ tạm không có hình ảnh. Hãy chụp màn hình hoặc sao chép (Copy) một hình ảnh rồi dán lại.');
      return;
    }
    addSgkImageFiles(files, 'paste');
    setPasteNotice(`Đã dán ${files.length} ảnh thành công.`);
    setTimeout(() => setPasteNotice(null), 2500);
  };

  const handlePlanFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsReadingPlan(true);
      const result = await extractTextFromFile(file, teacherAccount?.apiKey);
      setOldLessonPlanText(result.text);
      setPlanFileName(file.name);
      
      if (file.name.toLowerCase().endsWith('.docx') && setOriginalDocxBuffer) {
        const buffer = await file.arrayBuffer();
        setOriginalDocxBuffer(buffer);
      } else if (setOriginalDocxBuffer) {
        setOriginalDocxBuffer(null);
      }

      // Preserve all images from the old lesson plan
      if (result.images && result.images.length > 0) {
        updateOldPlanImages(result.images);
      } else {
        updateOldPlanImages([]);
      }
    } catch (err: any) {
      alert('Không thể đọc file bài soạn: ' + err.message);
    } finally {
      setIsReadingPlan(false);
      if (planFileInputRef.current) planFileInputRef.current.value = '';
    }
  };

  const removeSgkImage = (id: string) => {
    setSgkImages((prev) => prev.filter((img) => img.id !== id));
  };

  const removeOldPlanImage = (id: string) => {
    updateOldPlanImages((prev) => prev.filter((img) => img.id !== id));
    // Also remove tag from text
    setOldLessonPlanText(oldLessonPlanText.replace(new RegExp(`\\[\\[IMAGE:${id}:.*?\\]\\]`, 'g'), ''));
  };

  const analyzeSgkImages = async () => {
    if (sgkImages.length === 0) return;
    if (!teacherAccount && onOpenAccountModal) {
      if (
        window.confirm(
          'Để phân tích ảnh SGK mà không tiêu tốn tài nguyên tín dụng của tác giả, Thầy/Cô vui lòng kết nối tài khoản Gmail của mình. Bấm OK để mở hướng dẫn kết nối.'
        )
      ) {
        onOpenAccountModal();
      }
      return;
    }

    try {
      setIsAnalyzing(true);
      setAnalysisResult(null);

      const response = await fetch('/api/analyze-sgk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-gemini-key': teacherAccount?.apiKey || '',
        },
        body: JSON.stringify({
          userApiKey: teacherAccount?.apiKey,
          images: sgkImages.map((img) => ({ mimeType: img.mimeType, data: img.data })),
        }),
      });

      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || 'Lỗi phân tích SGK từ máy chủ');
      }

      setAnalysisResult(data.analysis);
    } catch (err: any) {
      alert('Lỗi đối chiếu nội dung SGK: ' + err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-6">
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Tài liệu tham khảo của giáo viên: Bài soạn mẫu &amp; ảnh chụp SGK đối chiếu
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Hệ thống bảo đảm: <b>1.</b> Giữ nguyên 100% cấu trúc chia cột của giáo án cũ; <b>2.</b> Giữ nguyên 100% các hình ảnh từ giáo án gốc tại đúng vị trí ban đầu; <b>3.</b> Tích hợp mã chỉ báo năng lực số được chọn &amp; diễn giải (bôi đỏ); <b>4.</b> Ảnh SGK tải lên dùng để AI đối chiếu nội dung kiến thức không bị sai lệch so với sách giáo khoa, không đưa ảnh trang sách vào giáo án.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Previous Lesson Plan / Teacher Sample Lesson Plan */}
        <div className="space-y-3 p-4 bg-slate-50/70 border border-slate-200 rounded-xl flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-indigo-600" />
                  Bài soạn mẫu / giáo án gốc của giáo viên (.docx)
                </label>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  (Giữ nguyên 100% định dạng chia cột và bảo toàn mọi hình ảnh từ giáo án gốc)
                </p>
              </div>

              {oldLessonPlanText.trim() && (
                <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Đã nạp ({oldLessonPlanText.trim().length} ký tự)
                </span>
              )}
            </div>

            {/* Hidden file input for lesson plan */}
            <input
              type="file"
              ref={planFileInputRef}
              onChange={handlePlanFileUpload}
              accept=".docx"
              className="hidden"
            />

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => planFileInputRef.current?.click()}
                disabled={isReadingPlan}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 shadow-2xs"
              >
                <FileUp className="w-3.5 h-3.5" />
                <span>{isReadingPlan ? 'Đang đọc & trích xuất file Word...' : 'Tải file Word (.docx) giáo án gốc'}</span>
              </button>

              {planFileName && (
                <span className="text-xs text-slate-700 truncate max-w-[220px] font-medium bg-slate-100 px-2 py-1 rounded">
                  📄 {planFileName}
                </span>
              )}

              {oldLessonPlanText.trim() && (
                <button
                  type="button"
                  onClick={() => {
                    setOldLessonPlanText('');
                    setPlanFileName(null);
                    updateOldPlanImages([]);
                    if (setOriginalDocxBuffer) setOriginalDocxBuffer(null);
                  }}
                  className="text-slate-400 hover:text-red-600 p-1 text-xs ml-auto transition-colors"
                  title="Xóa nội dung bài soạn"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <textarea
              rows={8}
              value={oldLessonPlanText}
              onChange={(e) => setOldLessonPlanText(e.target.value)}
              placeholder="Dán bài soạn mẫu hoặc tải tệp Word (.docx). Nếu bài soạn của thầy/cô có bảng chia 2 cột, 3 cột (GV - HS, Sản phẩm...) và hình ảnh minh họa, hệ thống sẽ bảo đảm giữ nguyên 100% định dạng chia cột và giữ nguyên mọi hình ảnh trong bản xuất bản..."
              className="w-full text-xs font-mono p-3 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 leading-relaxed"
            />

            {/* Preserved images from original lesson plan */}
            {effectiveOldPlanImages.length > 0 && (
              <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-indigo-600" />
                    Hình ảnh từ giáo án gốc được bảo toàn ({effectiveOldPlanImages.length} hình):
                  </span>
                  <span className="text-[11px] text-indigo-700 font-medium">
                    Tự động giữ nguyên tại đúng vị trí trong giáo án xuất bản
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-1">
                  {effectiveOldPlanImages.map((img, idx) => (
                    <div
                      key={img.id}
                      className="relative group w-20 h-20 rounded-lg overflow-hidden border border-indigo-200 bg-white shadow-2xs"
                    >
                      <img
                        src={img.previewUrl}
                        alt={img.name}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button
                          type="button"
                          onClick={() => removeOldPlanImage(img.id)}
                          className="p-1 rounded-full bg-red-600 text-white hover:bg-red-700"
                          title="Xóa hình này khỏi giáo án"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="absolute bottom-0 inset-x-0 bg-slate-900/70 px-1 py-0.5 text-[9px] text-white truncate text-center font-medium">
                        Hình {idx + 1}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="pt-2">
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Ghi chú thêm về yêu cầu tổ chức dạy học:
            </label>
            <input
              type="text"
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              placeholder="Nhập hoặc chọn gợi ý bên dưới..."
              className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 mb-2"
            />
            
            <div className="space-y-2">
              <div className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Thêm năng lực số nhưng giữ nguyên:</div>
              <div className="flex flex-wrap gap-1.5">
                {['Cấu trúc', 'Bố cục', 'Nội dung', 'Hình ảnh', 'Công thức toán học', 'Phiếu học tập'].map((opt) => (
                  <button
                    key={'giu_nguyen_'+opt}
                    type="button"
                    onClick={() => setCustomNote(customNote ? `${customNote}, giữ nguyên ${opt.toLowerCase()}` : `Giữ nguyên ${opt.toLowerCase()}`)}
                    className="px-2 py-1 text-[10px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors"
                  >
                    + {opt}
                  </button>
                ))}
              </div>

              <div className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mt-2">Soạn mới bám sát giáo án cũ:</div>
              <div className="flex flex-wrap gap-1.5">
                {['Cấu trúc', 'Bố cục', 'Nội dung', 'Hình ảnh', 'Công thức toán học', 'Phiếu học tập'].map((opt) => (
                  <button
                    key={'bam_sat_'+opt}
                    type="button"
                    onClick={() => setCustomNote(customNote ? `${customNote}, bám sát ${opt.toLowerCase()} cũ` : `Bám sát ${opt.toLowerCase()} cũ`)}
                    className="px-2 py-1 text-[10px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors"
                  >
                    + {opt}
                  </button>
                ))}
              </div>

              <div className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mt-2">Soạn mới hoàn toàn bám sát SGK & CV5512:</div>
              <div className="flex flex-wrap gap-1.5">
                {['Dạng 2 cột', 'Không chia cột'].map((opt) => (
                  <button
                    key={'kieu_'+opt}
                    type="button"
                    onClick={() => setCustomNote(customNote ? `${customNote}, soạn mới hoàn toàn dạng ${opt.toLowerCase()}` : `Soạn mới hoàn toàn dạng ${opt.toLowerCase()}`)}
                    className="px-2 py-1 text-[10px] font-medium bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded border border-indigo-200 transition-colors"
                  >
                    + {opt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Textbook Photos for Reference / Verification */}
        <div className="space-y-3 p-4 bg-slate-50/70 border border-slate-200 rounded-xl flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-emerald-600" />
                  Ảnh chụp các trang SGK để AI đối chiếu kiến thức
                </label>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  (Dùng để đối chiếu kiến thức không bị sai lệch so với SGK - <b>Không đưa ảnh này vào giáo án</b>)
                </p>
              </div>
              <span className="text-xs text-slate-500 font-medium">({sgkImages.length} trang)</span>
            </div>

            <input
              type="file"
              ref={imageInputRef}
              onChange={handleImageUpload}
              accept="image/*"
              multiple
              className="hidden"
            />

            <div
              onClick={() => imageInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-emerald-400 hover:bg-emerald-50/20 rounded-xl p-4 text-center cursor-pointer transition-colors"
            >
              <div className="flex flex-col items-center justify-center gap-1.5">
                <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Upload className="w-4.5 h-4.5" />
                </div>
                <div className="text-xs font-semibold text-slate-800">
                  Nhấp để tải lên ảnh chụp các trang SGK bài học (JPG, PNG)
                </div>
                <span className="text-[11px] text-slate-400 max-w-sm mx-auto">
                  AI đọc các trang sách này để so sánh thuật ngữ, số liệu và câu hỏi, đảm bảo giáo án chuẩn xác với SGK
                </span>
              </div>
            </div>

            {/* Paste images directly (Ctrl+V) */}
            <div
              tabIndex={0}
              onPaste={handlePasteImages}
              onClick={(e) => (e.currentTarget as HTMLDivElement).focus()}
              className="min-h-[180px] border-2 border-dashed border-indigo-300 bg-indigo-50/30 rounded-xl p-4 flex flex-col items-center justify-center text-center gap-1.5 cursor-text outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 focus:bg-indigo-50/60 transition-colors"
              title="Bấm vào đây rồi nhấn Ctrl + V để dán ảnh"
            >
              <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center">
                <ImageIcon className="w-4.5 h-4.5" />
              </div>
              <div className="text-xs font-semibold text-slate-800">Dán ảnh trực tiếp (Ctrl + V)</div>
              <span className="text-[11px] text-slate-500 max-w-sm">
                Bấm chuột vào khung này, sau đó nhấn <b>Ctrl + V</b> để dán ảnh chụp màn hình (Win + Shift + S) hoặc ảnh
                đã sao chép từ Zalo, Word, trình duyệt...
              </span>
              {pasteNotice && (
                <span
                  className={`mt-1 text-[11px] font-semibold px-2 py-0.5 rounded ${
                    pasteNotice.startsWith('Đã dán')
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-900'
                  }`}
                >
                  {pasteNotice}
                </span>
              )}
            </div>

            {/* List of uploaded SGK pages */}
            {sgkImages.length > 0 && (
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-700">Các trang SGK đã nạp để đối chiếu ({sgkImages.length}):</span>
                  <button
                    type="button"
                    onClick={analyzeSgkImages}
                    disabled={isAnalyzing}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{isAnalyzing ? 'Đang đối chiếu...' : 'AI đọc & so sánh với SGK'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto p-1">
                  {sgkImages.map((img, idx) => (
                    <div
                      key={img.id}
                      className="relative group rounded-lg overflow-hidden border border-slate-200 bg-slate-100 aspect-3/4 shadow-2xs"
                    >
                      <img
                        src={img.previewUrl}
                        alt={img.name}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button
                          type="button"
                          onClick={() => removeSgkImage(img.id)}
                          className="p-1 rounded-full bg-red-600 text-white hover:bg-red-700"
                          title="Xóa trang này"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="absolute bottom-0 inset-x-0 bg-black/60 px-1 py-0.5 text-[10px] text-white truncate text-center">
                        Trang {idx + 1}
                      </div>
                    </div>
                  ))}
                </div>

                {analysisResult && (
                  <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-lg text-xs space-y-1 text-slate-700">
                    <div className="flex items-center gap-1.5 font-semibold text-emerald-900">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                      Kết quả AI đối chiếu nội dung từ trang SGK:
                    </div>
                    <div className="whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto text-[11px]">
                      {analysisResult}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
