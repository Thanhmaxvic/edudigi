import React from 'react';
import { FileText, CheckCircle2, ShieldAlert, Award, FileCode, Check, ArrowRight } from 'lucide-react';

import { FormattingOptions } from '../utils/docxExport';

interface StandardsViewProps {
  onGoToEditor: () => void;
  formattingOptions: FormattingOptions;
  setFormattingOptions: React.Dispatch<React.SetStateAction<FormattingOptions>>;
}

export const StandardsView: React.FC<StandardsViewProps> = ({ onGoToEditor, formattingOptions, setFormattingOptions }) => {
  return (
    <div className="max-w-5xl mx-auto space-y-8 py-4">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs">
        <div className="max-w-3xl">
          <span className="text-xs font-bold text-indigo-700">
            Tiêu chuẩn kỹ thuật văn bản
          </span>
          <h2 className="text-2xl font-bold text-slate-900 mt-1 mb-3">
            Quy chuẩn soạn thảo &amp; định dạng văn bản giáo án A4
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Hệ thống EduDigi tuân thủ chặt chẽ các quy định về thể thức văn bản hành chính sư phạm và hướng dẫn chuyên môn theo Công văn 5512/BGDĐT của Bộ Giáo dục và Đào tạo.
          </p>
        </div>
      </div>

      {/* Grid of Key Technical Requirements */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Margin & Page Setup */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              A4
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Thiết lập khổ giấy &amp; căn lề</h3>
              <p className="text-xs text-slate-500">Chuẩn hóa cho máy in và hồ sơ lưu trữ điện tử</p>
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200/80 space-y-2.5 text-xs text-slate-700">
            <div className="flex justify-between items-center py-1 border-b border-slate-200">
              <span className="font-medium">Chế độ căn lề:</span>
              <select 
                className="text-xs border-slate-300 rounded font-semibold text-indigo-700 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                value={formattingOptions.margins.top === 850 ? 'normal' : 'narrow'}
                onChange={(e) => {
                  if (e.target.value === 'normal') {
                    setFormattingOptions({...formattingOptions, margins: { top: 850, bottom: 850, left: 1417, right: 850 }});
                  } else {
                    setFormattingOptions({...formattingOptions, margins: { top: 720, bottom: 720, left: 720, right: 720 }});
                  }
                }}
              >
                <option value="normal">Chuẩn (Trái 2.5cm, còn lại 1.5cm)</option>
                <option value="narrow">Hẹp (Tất cả 1.27cm)</option>
              </select>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-200">
              <span className="font-medium">Lề trái (Left margin):</span>
              <span className="font-semibold text-slate-900">{formattingOptions.margins.left === 1417 ? '2,5 cm' : '1,27 cm'}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-200">
              <span className="font-medium">Lề phải (Right margin):</span>
              <span className="font-semibold text-slate-900">{formattingOptions.margins.right === 850 ? '1,5 cm' : '1,27 cm'}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-200">
              <span className="font-medium">Lề trên (Top margin):</span>
              <span className="font-semibold text-slate-900">{formattingOptions.margins.top === 850 ? '1,5 cm' : '1,27 cm'}</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="font-medium">Lề dưới (Bottom margin):</span>
              <span className="font-semibold text-slate-900">{formattingOptions.margins.bottom === 850 ? '1,5 cm' : '1,27 cm'}</span>
            </div>
          </div>
        </div>

        {/* Typography & Spacing */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-sm">
              Aa
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Font chữ & Giãn dòng đoạn</h3>
              <p className="text-xs text-slate-500">Đảm bảo tính trang trọng, rõ nét, dễ đọc</p>
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200/80 space-y-2.5 text-xs text-slate-700">
            <div className="flex justify-between items-center py-1 border-b border-slate-200">
              <span className="font-medium">Phông chữ (Font family):</span>
              <select 
                className="text-xs border-slate-300 rounded font-semibold text-indigo-700 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                value={formattingOptions.fontName}
                onChange={(e) => setFormattingOptions({...formattingOptions, fontName: e.target.value})}
              >
                <option value="Times New Roman">Times New Roman</option>
                <option value="Arial">Arial</option>
                <option value="Calibri">Calibri</option>
              </select>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-200">
              <span className="font-medium">Cỡ chữ (Font size):</span>
              <select 
                className="text-xs border-slate-300 rounded font-semibold text-indigo-700 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                value={formattingOptions.fontSize}
                onChange={(e) => setFormattingOptions({...formattingOptions, fontSize: Number(e.target.value)})}
              >
                <option value={22}>11 pt</option>
                <option value={24}>12 pt</option>
                <option value={26}>13 pt</option>
                <option value={28}>14 pt</option>
              </select>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-200">
              <span className="font-medium">Khoảng cách dòng (Line spacing):</span>
              <select 
                className="text-xs border-slate-300 rounded font-semibold text-indigo-700 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                value={formattingOptions.lineSpacing}
                onChange={(e) => setFormattingOptions({...formattingOptions, lineSpacing: Number(e.target.value)})}
              >
                <option value={240}>Cách dòng đơn (Single)</option>
                <option value={276}>Cách dòng 1.15</option>
                <option value={360}>Cách dòng 1.5</option>
              </select>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-200">
              <span className="font-medium">Khoảng cách đoạn (Paragraph spacing):</span>
              <select 
                className="text-xs border-slate-300 rounded font-semibold text-indigo-700 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                value={formattingOptions.paraSpacing}
                onChange={(e) => setFormattingOptions({...formattingOptions, paraSpacing: Number(e.target.value)})}
              >
                <option value={0}>0 pt (Không giãn)</option>
                <option value={120}>Giãn đoạn 6 pt</option>
                <option value={240}>Giãn đoạn 12 pt</option>
              </select>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="font-medium">Đánh số trang (Pagination):</span>
              <select 
                className="text-xs border-slate-300 rounded font-semibold text-indigo-700 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                value={formattingOptions.pageNumber}
                onChange={(e) => setFormattingOptions({...formattingOptions, pageNumber: e.target.value as any})}
              >
                <option value="bottom-center">Chân trang (Giữa)</option>
                <option value="bottom-right">Chân trang (Phải)</option>
                <option value="none">Không đánh số</option>
              </select>
            </div>
          </div>
        </div>

        {/* Red Highlighting Rule */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center font-bold text-sm">
              RED
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Quy tắc bôi đỏ nội dung số mới</h3>
              <p className="text-xs text-slate-500">Minh bạch phần cải tiến cho tổ chuyên môn & BGH</p>
            </div>
          </div>

          <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
            <p>
              Tất cả các câu từ, thông số thiết bị, hoạt động thao tác của GV & HS được đưa vào mới nhằm phục vụ tích hợp năng lực số đều được hệ thống tự động bôi đỏ (<span className="text-red-600 font-semibold">mã màu #DC2626</span>).
            </p>
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <span className="font-semibold text-red-900 block mb-1">Ví dụ trực quan:</span>
              <span className="text-slate-800">
                HS quan sát mô hình thí nghiệm trên SGK, sau đó <span className="text-red-600 font-bold bg-white px-1 py-0.5 rounded">sử dụng điện thoại thông minh quét mã QR để mở mô phỏng ảo 3D trên PhET và kéo thả thay đổi thông số nhiệt độ</span>.
              </span>
            </div>
          </div>
        </div>

        {/* Cleanliness & Formula Rules */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-sm">
              ✓
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Sạch đẹp tuyệt đối & Công thức chuẩn</h3>
              <p className="text-xs text-slate-500">Loại bỏ hoàn toàn rác ký tự và lỗi font</p>
            </div>
          </div>

          <div className="space-y-2 text-xs text-slate-600">
            <div className="flex items-start gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>Tuyệt đối không chứa bất kỳ ký hiệu chú thích dạng <code className="text-red-600">[...]</code> hay <code className="text-red-600">[i]</code> nào.</span>
            </div>
            <div className="flex items-start gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>Công thức toán học, hoá học, vật lí được chuẩn hóa Unicode (ví dụ: H₂O, Fe + 2HCl → FeCl₂ + H₂, x² - 4x + 3 = 0, v = s/t).</span>
            </div>
            <div className="flex items-start gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>Bảng biểu chia 2 cột đối chiếu khoa học: Hoạt động của GV & HS - Sản phẩm dự kiến.</span>
            </div>
            <div className="flex items-start gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>Kiểm tra kỹ lưỡng chính tả và ngữ pháp tiếng Việt sư phạm.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Official Guidelines 5512 Accordion summary */}
      <div className="bg-slate-900 text-white rounded-xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
        <div>
          <h3 className="text-lg font-bold">Sẵn sàng xây dựng kế hoạch bài dạy chuẩn mẫu?</h3>
          <p className="text-xs text-slate-300 mt-1 max-w-xl">
            Điền thông tin môn học, chọn chỉ báo năng lực số và tải ảnh trang SGK tương ứng để xuất ra bản Word hoàn chỉnh ngay lập tức.
          </p>
        </div>
        <button
          onClick={onGoToEditor}
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-2 shrink-0"
        >
          <span>Mở trình soạn bài</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
