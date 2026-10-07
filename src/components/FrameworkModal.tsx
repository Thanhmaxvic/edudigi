import React, { useState } from 'react';
import { COMPETENCY_3456_ITEMS } from '../data/competency3456Items';
import { DOMAINS_3456, SUB_COMPETENCIES_3456, Competency3456Item } from '../data/competency3456Data';
import {
  Check,
  Search,
  Filter,
  Sparkles,
  ArrowRight,
  BookOpen,
  ClipboardPaste,
  Plus,
  Trash2,
  Table as TableIcon,
  LayoutGrid,
  CheckCircle2,
  FileSpreadsheet,
} from 'lucide-react';

interface FrameworkViewProps {
  selectedCodes: string[];
  onToggleCode: (code: string) => void;
  onSelectMultipleCodes: (codes: string[]) => void;
  onGoToEditor: () => void;
  customPastedIndicators: Array<{ code: string; yccd: string; explanation: string }>;
  onAddCustomIndicator: (item: { code: string; yccd: string; explanation: string }) => void;
  onRemoveCustomIndicator: (index: number) => void;
}

export const FrameworkView: React.FC<FrameworkViewProps> = ({
  selectedCodes,
  onToggleCode,
  onSelectMultipleCodes,
  onGoToEditor,
  customPastedIndicators,
  onAddCustomIndicator,
  onRemoveCustomIndicator,
}) => {
  const [activeDomainFilter, setActiveDomainFilter] = useState<number | 'all'>('all');
  const [activeGradeFilter, setActiveGradeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'detailedTable' | 'matrix'>('detailedTable');

  // Paste / Custom Indicator input state
  const [pastedText, setPastedText] = useState('');
  const [customCodeInput, setCustomCodeInput] = useState('');
  const [customYccdInput, setCustomYccdInput] = useState('');

  const filteredItems = COMPETENCY_3456_ITEMS.filter((item) => {
    const matchesDomain = activeDomainFilter === 'all' || item.domainNum === activeDomainFilter;
    const matchesGrade = activeGradeFilter === 'all' || item.gradeLevel.includes(activeGradeFilter);
    const matchesSearch =
      searchQuery.trim() === '' ||
      item.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.yccd.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.subName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.teachingTask.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesDomain && matchesGrade && matchesSearch;
  });

  const handleSelectAllFiltered = () => {
    const codes = filteredItems.map((i) => i.code);
    onSelectMultipleCodes(Array.from(new Set([...selectedCodes, ...codes])));
  };

  const handleClearFiltered = () => {
    const codesSet = new Set(filteredItems.map((i) => i.code));
    onSelectMultipleCodes(selectedCodes.filter((c) => !codesSet.has(c)));
  };

  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customYccdInput.trim() && !pastedText.trim()) {
      alert('Vui lòng nhập hoặc dán nội dung chỉ báo / yêu cầu cần đạt!');
      return;
    }

    // If pasted bulk text
    if (pastedText.trim() && !customYccdInput.trim()) {
      const lines = pastedText
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      lines.forEach((line, idx) => {
        onAddCustomIndicator({
          code: `NLS.GV-${customPastedIndicators.length + idx + 1}`,
          yccd: line,
          explanation: `Chỉ báo & diễn giải riêng do Giáo viên tự dán: ${line}`,
        });
      });
      setPastedText('');
      alert(`Đã thêm ${lines.length} chỉ báo tự dán vào danh sách!`);
      return;
    }

    const code = customCodeInput.trim() || `NLS.GV-${customPastedIndicators.length + 1}`;
    const yccd = customYccdInput.trim();
    onAddCustomIndicator({
      code,
      yccd,
      explanation: pastedText.trim() || `Chỉ báo riêng: ${yccd}`,
    });

    setCustomCodeInput('');
    setCustomYccdInput('');
    setPastedText('');
  };

  return (
    <div className="space-y-6 py-2">
      {/* Top Banner: Theo Văn bản 3456/BGDĐT-GDPT */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 text-white rounded-2xl p-6 sm:p-7 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/20 border border-indigo-400/40 rounded-full text-xs font-semibold text-indigo-200">
              <BookOpen className="w-3.5 h-3.5" />
              <span>Khung chuẩn Văn bản số 3456/BGDĐT-GDPT</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
              Bảng Mã Chỉ Báo Năng Lực Số & Diễn Giải Chi Tiết
            </h2>
            <p className="text-xs sm:text-sm text-indigo-100/90 max-w-3xl leading-relaxed">
              Toàn bộ hệ thống mã chỉ báo chuẩn (từ 1.1.CB1a đến 6.3.NC1b) phân loại theo 6 Miền năng lực, 23 năng lực thành phần, nhiệm vụ dạy học và yêu cầu cần đạt (YCCD) chi tiết cho từng cấp học.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 shrink-0">
            <div className="px-3.5 py-2 rounded-xl bg-white/10 border border-white/20 text-xs">
              <span className="text-indigo-200 block text-[11px]">Đã chọn:</span>
              <span className="text-base font-bold text-white">
                {selectedCodes.length} chỉ báo
              </span>
            </div>

            <button
              type="button"
              onClick={onGoToEditor}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-colors"
            >
              <span>Áp dụng vào Kế hoạch bài dạy</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* SECTION: Ô NHẬP LIỆU ĐỂ GIÁO VIÊN TỰ DÁN CHỈ BÁO & DIỄN GIẢI RIÊNG */}
      <div className="bg-white rounded-xl border-2 border-emerald-300 p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-emerald-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold">
              <ClipboardPaste className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                Ô Nhập Liệu / Dán Chỉ Báo & Diễn Giải Riêng Của Giáo Viên
              </h3>
              <p className="text-xs text-slate-600">
                Thầy/Cô có thể tự dán văn bản chỉ báo đặc thù của bộ môn, tổ chuyên môn hoặc yêu cầu cần đạt riêng vào đây.
              </p>
            </div>
          </div>
          {customPastedIndicators.length > 0 && (
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
              Đã thêm {customPastedIndicators.length} chỉ báo riêng
            </span>
          )}
        </div>

        <form onSubmit={handleAddCustom} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mã chỉ báo riêng (Tùy chọn)
              </label>
              <input
                type="text"
                value={customCodeInput}
                onChange={(e) => setCustomCodeInput(e.target.value)}
                placeholder={`VD: NLS.GV-${customPastedIndicators.length + 1}`}
                className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold text-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="sm:col-span-8">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Yêu cầu cần đạt / Tên chỉ báo cụ thể
              </label>
              <input
                type="text"
                value={customYccdInput}
                onChange={(e) => setCustomYccdInput(e.target.value)}
                placeholder="VD: Sử dụng phần mềm GeoGebra để vẽ đồ thị hàm số và xác định tọa độ đỉnh..."
                className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Diễn giải cụ thể / Hoặc Dán trực tiếp đoạn văn bản chỉ báo (Hỗ trợ dán nhiều dòng)
            </label>
            <textarea
              rows={3}
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="Dán nội dung diễn giải chi tiết hoặc danh sách các chỉ báo riêng vào đây... Khi tạo giáo án, AI sẽ bám sát tuyệt đối nội dung diễn giải này và bôi đỏ tích hợp vào bài dạy."
              className="w-full text-xs p-3 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 leading-relaxed font-mono text-slate-800"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span>Lưu chỉ báo & diễn giải riêng</span>
            </button>
          </div>
        </form>

        {/* List of custom pasted indicators */}
        {customPastedIndicators.length > 0 && (
          <div className="pt-3 border-t border-slate-100 space-y-2">
            <span className="text-xs font-bold text-slate-700 block">
              Danh sách chỉ báo riêng Thầy/Cô đã thêm (Được tự động bám sát khi soạn giáo án):
            </span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {customPastedIndicators.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-lg flex items-start justify-between gap-3 text-xs"
                >
                  <div>
                    <span className="font-mono font-bold bg-emerald-200/80 text-emerald-900 px-1.5 py-0.5 rounded text-[11px]">
                      {item.code}
                    </span>
                    <h5 className="font-bold text-slate-900 mt-1">{item.yccd}</h5>
                    <p className="text-[11px] text-slate-600 mt-0.5">{item.explanation}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveCustomIndicator(idx)}
                    className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors shrink-0"
                    title="Xóa chỉ báo này"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* FILTER & VIEW CONTROLS */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Tra cứu & Lựa chọn Chỉ Báo Năng Lực Số (VB 3456/BGDĐT-GDPT)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Bấm vào từng chỉ báo để chọn/bỏ chọn. Chỉ báo được chọn sẽ tích hợp trực tiếp vào mục tiêu và tiến trình giáo án.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSelectAllFiltered}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Chọn tất cả đang lọc
            </button>
            <button
              type="button"
              onClick={handleClearFiltered}
              className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Bỏ chọn
            </button>
          </div>
        </div>

        {/* 6 Domains filter */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveDomainFilter('all')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap transition-colors ${
              activeDomainFilter === 'all'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Tất cả 6 miền ({COMPETENCY_3456_ITEMS.length})
          </button>
          {DOMAINS_3456.map((dom) => {
            const count = COMPETENCY_3456_ITEMS.filter((i) => i.domainNum === dom.num).length;
            const isActive = activeDomainFilter === dom.num;
            return (
              <button
                key={dom.num}
                type="button"
                onClick={() => setActiveDomainFilter(dom.num)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span>{dom.short}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isActive ? 'bg-indigo-500/80 text-white' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search & Level Filter */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-80">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm mã (1.1.CB1a, 2.1.TC1a...), từ khóa, YCCD..."
                className="w-full text-xs pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <select
              value={activeGradeFilter}
              onChange={(e) => setActiveGradeFilter(e.target.value)}
              className="text-xs px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
            >
              <option value="all">Tất cả cấp học</option>
              <option value="L1-3">Tiểu học (L1-3)</option>
              <option value="L4-5">Tiểu học (L4-5)</option>
              <option value="L6-7">THCS (L6-7)</option>
              <option value="L8-9">THCS (L8-9)</option>
              <option value="L10-12">THPT (L10-12)</option>
            </select>
          </div>

          <span className="text-xs text-slate-500 self-end sm:self-auto">
            Hiển thị: <b>{filteredItems.length}</b> chỉ báo
          </span>
        </div>
      </div>

      {/* OFFICIAL TABLE: BẢNG MÃ CHỈ BÁO & DIỄN GIẢI YCCD CHI TIẾT (VB 3456) */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto max-h-[640px] scrollbar-thin">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-100 sticky top-0 z-10 border-b border-slate-300 text-slate-800 font-bold">
              <tr>
                <th className="py-3 px-3 w-12 text-center">Chọn</th>
                <th className="py-3 px-3 w-28 whitespace-nowrap">Mã chỉ báo</th>
                <th className="py-3 px-3 w-48">Miền & NL thành phần</th>
                <th className="py-3 px-2 w-28 text-center">Mức độ / Lớp</th>
                <th className="py-3 px-3 w-64">Nhiệm vụ dạy học</th>
                <th className="py-3 px-3">Yêu cầu cần đạt (YCCD) & Diễn giải cụ thể</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.map((item) => {
                const isSelected = selectedCodes.includes(item.code);
                return (
                  <tr
                    key={item.code}
                    onClick={() => onToggleCode(item.code)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-indigo-50/70 hover:bg-indigo-100/70 font-medium'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="py-3 px-3 text-center align-top">
                      <div className="mt-0.5 inline-block">
                        {isSelected ? (
                          <div className="w-4 h-4 rounded bg-indigo-600 text-white flex items-center justify-center">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        ) : (
                          <div className="w-4 h-4 rounded border border-slate-300 bg-white" />
                        )}
                      </div>
                    </td>

                    {/* Code */}
                    <td className="py-3 px-3 align-top whitespace-nowrap">
                      <span className="font-mono font-bold text-xs bg-indigo-100 text-indigo-900 border border-indigo-200 px-2 py-0.5 rounded inline-block">
                        {item.code}
                      </span>
                    </td>

                    {/* Domain & Sub-competency */}
                    <td className="py-3 px-3 align-top">
                      <div className="font-bold text-slate-900">{item.domainName}</div>
                      <div className="text-[11px] text-slate-600 mt-0.5">{item.subName}</div>
                    </td>

                    {/* Level / Grade */}
                    <td className="py-3 px-2 align-top text-center whitespace-nowrap">
                      <span className="inline-block text-[11px] px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-semibold">
                        {item.levelCode}
                      </span>
                      <div className="text-[10px] text-slate-500 mt-0.5">{item.gradeLevel}</div>
                    </td>

                    {/* Teaching Task */}
                    <td className="py-3 px-3 align-top text-slate-700 italic text-[11px]">
                      {item.teachingTask}
                    </td>

                    {/* YCCD & Full Explanation */}
                    <td className="py-3 px-3 align-top">
                      <div className="font-bold text-slate-900 text-xs mb-1">{item.yccd}</div>
                      <p className="text-slate-600 text-[11px] leading-relaxed bg-slate-50 p-2 rounded border border-slate-200/60">
                        <b>Diễn giải cụ thể:</b> {item.fullExplanation}
                      </p>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
