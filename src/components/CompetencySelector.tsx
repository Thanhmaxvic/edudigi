import React, { useState } from 'react';
import { COMPETENCY_3456_ITEMS } from '../data/competency3456Items';
import { DOMAINS_3456, Competency3456Item } from '../data/competency3456Data';
import {
  Check,
  Search,
  Plus,
  Trash2,
  Table as TableIcon,
  LayoutGrid,
  ClipboardPaste,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';

export interface CustomIndicatorEntry {
  code: string;
  yccd: string;
  explanation: string;
}

interface CompetencySelectorProps {
  selectedCodes: string[];
  onChangeSelectedCodes: (codes: string[]) => void;
  customIndicators: CustomIndicatorEntry[];
  onChangeCustomIndicators: (items: CustomIndicatorEntry[]) => void;
  subjectName?: string;
  gradeLevel?: string;
}

export const CompetencySelector: React.FC<CompetencySelectorProps> = ({
  selectedCodes,
  onChangeSelectedCodes,
  customIndicators,
  onChangeCustomIndicators,
  subjectName = '',
  gradeLevel = '',
}) => {
  const [activeDomainFilter, setActiveDomainFilter] = useState<number | 'all'>('all');
  const [activeGradeFilter, setActiveGradeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Dedicated paste box state
  const [isPasteBoxOpen, setIsPasteBoxOpen] = useState(false);
  const [pasteTextInput, setPasteTextInput] = useState('');
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

  const toggleSelectCode = (code: string) => {
    if (selectedCodes.includes(code)) {
      onChangeSelectedCodes(selectedCodes.filter((c) => c !== code));
    } else {
      onChangeSelectedCodes([...selectedCodes, code]);
    }
  };

  const handleSelectAllFiltered = () => {
    const newCodes = Array.from(new Set([...selectedCodes, ...filteredItems.map((i) => i.code)]));
    onChangeSelectedCodes(newCodes);
  };

  const handleClearFiltered = () => {
    const filteredSet = new Set(filteredItems.map((i) => i.code));
    onChangeSelectedCodes(selectedCodes.filter((c) => !filteredSet.has(c)));
  };

  const handleAutoSuggest = () => {
    // 4 standard core indicators: Search (1.1.TC1b), Evaluation (1.2.TC1a), Presentation/Collab (2.2.TC1a), AI understanding (6.1.TC1a)
    const core = ['1.1.TC1b', '1.2.TC1a', '2.2.TC1a', '6.1.TC1a'];
    const customCodes = customIndicators.map((c) => c.code);
    onChangeSelectedCodes(Array.from(new Set([...selectedCodes, ...core, ...customCodes])));
  };

  const handleSaveCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customYccdInput.trim() && !pasteTextInput.trim()) {
      alert('Vui lòng nhập hoặc dán nội dung chỉ báo / diễn giải!');
      return;
    }

    if (pasteTextInput.trim() && !customYccdInput.trim()) {
      const lines = pasteTextInput
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      const newItems: CustomIndicatorEntry[] = lines.map((line, idx) => ({
        code: `NLS.GV-${customIndicators.length + idx + 1}`,
        yccd: line,
        explanation: `Chỉ báo do GV tự dán: ${line}`,
      }));

      const updated = [...customIndicators, ...newItems];
      onChangeCustomIndicators(updated);
      onChangeSelectedCodes([...selectedCodes, ...newItems.map((i) => i.code)]);
      setPasteTextInput('');
      setIsPasteBoxOpen(false);
      return;
    }

    const code = customCodeInput.trim() || `NLS.GV-${customIndicators.length + 1}`;
    const newItem: CustomIndicatorEntry = {
      code,
      yccd: customYccdInput.trim(),
      explanation: pasteTextInput.trim() || `Chỉ báo riêng: ${customYccdInput.trim()}`,
    };

    const updated = [...customIndicators, newItem];
    onChangeCustomIndicators(updated);
    onChangeSelectedCodes([...selectedCodes, newItem.code]);

    setCustomCodeInput('');
    setCustomYccdInput('');
    setPasteTextInput('');
    setIsPasteBoxOpen(false);
  };

  const handleDeleteCustom = (code: string) => {
    onChangeCustomIndicators(customIndicators.filter((c) => c.code !== code));
    onChangeSelectedCodes(selectedCodes.filter((c) => c !== code));
  };

  return (
    <div className="space-y-4">
      {/* Top Header Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                Bảng mã chỉ báo năng lực số (Văn bản 3456/BGDĐT-GDPT)
              </h3>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full">
                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
                Đã chọn: {selectedCodes.length} chỉ báo
              </span>
              {customIndicators.length > 0 && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                  {customIndicators.length} chỉ báo GV tự dán
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600 mt-1 max-w-3xl leading-relaxed">
              Chuẩn 6 miền năng lực theo văn bản 3456/BGDĐT-GDPT. Thầy/Cô tích chọn các chỉ báo phù hợp hoặc tự dán chỉ báo &amp; diễn giải riêng ở ô bên dưới.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={() => setIsPasteBoxOpen(!isPasteBoxOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-900 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 rounded-lg shadow-2xs transition-colors"
            >
              <ClipboardPaste className="w-3.5 h-3.5" />
              <span>Dán chỉ báo &amp; diễn giải riêng</span>
            </button>

            <button
              type="button"
              onClick={handleAutoSuggest}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>Gợi ý 4 chỉ báo cốt lõi</span>
            </button>

            <div className="flex items-center border border-slate-200 rounded-lg p-0.5 bg-slate-50">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded text-xs flex items-center gap-1 font-medium transition-colors ${
                  viewMode === 'table'
                    ? 'bg-white shadow-2xs text-indigo-700 font-semibold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Dạng bảng</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`p-1.5 rounded text-xs flex items-center gap-1 font-medium transition-colors ${
                  viewMode === 'cards'
                    ? 'bg-white shadow-2xs text-indigo-700 font-semibold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Dạng thẻ</span>
              </button>
            </div>
          </div>
        </div>

        {/* DEDICATED PASTE BOX FOR TEACHER */}
        {isPasteBoxOpen && (
          <div className="p-4 sm:p-5 bg-gradient-to-br from-emerald-50/80 via-slate-50 to-indigo-50/50 rounded-xl border-2 border-emerald-400 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-emerald-200">
              <div className="flex items-center gap-2">
                <ClipboardPaste className="w-4 h-4 text-emerald-700" />
                <h4 className="text-sm font-bold text-slate-900">
                  Ô nhập liệu / dán chỉ báo &amp; diễn giải riêng của giáo viên
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setIsPasteBoxOpen(false)}
                className="text-xs text-slate-400 hover:text-slate-700"
              >
                ✕ Đóng
              </button>
            </div>

            <form onSubmit={handleSaveCustom} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-4">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mã chỉ báo riêng (tùy chọn)
                  </label>
                  <input
                    type="text"
                    value={customCodeInput}
                    onChange={(e) => setCustomCodeInput(e.target.value)}
                    placeholder={`VD: NLS.GV-${customIndicators.length + 1}`}
                    className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono font-bold text-emerald-800"
                  />
                </div>
                <div className="sm:col-span-8">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tên yêu cầu cần đạt (YCCD)
                  </label>
                  <input
                    type="text"
                    value={customYccdInput}
                    onChange={(e) => setCustomYccdInput(e.target.value)}
                    placeholder="VD: Sử dụng phần mềm GeoGebra vẽ đồ thị hoặc tra cứu số liệu..."
                    className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg font-semibold text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Diễn giải cụ thể / hoặc dán cả đoạn văn bản chỉ báo (hỗ trợ dán nhiều dòng)
                </label>
                <textarea
                  rows={3}
                  value={pasteTextInput}
                  onChange={(e) => setPasteTextInput(e.target.value)}
                  placeholder="Dán nội dung diễn giải chi tiết hoặc danh sách các chỉ báo riêng vào đây... Khi tạo giáo án, AI sẽ bám sát tuyệt đối nội dung diễn giải này và bôi đỏ tích hợp vào bài dạy."
                  className="w-full text-xs p-3 bg-white border border-slate-300 rounded-lg font-mono text-slate-800 leading-relaxed"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsPasteBoxOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 bg-white border border-slate-200 rounded-lg"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[3]" />
                  <span>Lưu &amp; tích hợp vào bài dạy</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* CUSTOM INDICATORS BADGES IF ANY */}
        {customIndicators.length > 0 && (
          <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2">
            <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Chỉ báo &amp; diễn giải do Thầy/Cô tự dán ({customIndicators.length}):
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {customIndicators.map((item) => {
                const isSelected = selectedCodes.includes(item.code);
                return (
                  <div
                    key={item.code}
                    onClick={() => toggleSelectCode(item.code)}
                    className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all flex items-start justify-between gap-2 ${
                      isSelected
                        ? 'border-emerald-500 bg-white shadow-2xs ring-1 ring-emerald-400'
                        : 'border-slate-200 bg-white/70 opacity-70'
                    }`}
                  >
                    <div className="flex items-start gap-2 min-w-0">
                      <div className="mt-0.5 shrink-0">
                        {isSelected ? (
                          <div className="w-4 h-4 rounded bg-emerald-600 flex items-center justify-center text-white">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        ) : (
                          <div className="w-4 h-4 rounded border border-slate-300 bg-white" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono font-bold bg-emerald-100 text-emerald-900 px-1.5 py-0.2 rounded">
                            {item.code}
                          </span>
                          <span className="text-[10px] text-emerald-700 font-semibold italic">
                            (GV tự định nghĩa)
                          </span>
                        </div>
                        <h5 className="text-xs font-bold text-slate-900 mt-0.5 truncate">
                          {item.yccd}
                        </h5>
                        <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-2">
                          {item.explanation}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteCustom(item.code);
                      }}
                      className="p-1 text-slate-400 hover:text-red-600 rounded shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* DOMAIN & LEVEL FILTER */}
        <div className="pt-2 border-t border-slate-100 space-y-2.5">
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
                      isActive ? 'bg-indigo-500 text-white' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-1">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-72">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm mã (1.1.CB1a, 2.1.TC1a...), từ khóa..."
                  className="w-full text-xs pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <select
                value={activeGradeFilter}
                onChange={(e) => setActiveGradeFilter(e.target.value)}
                className="text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
              >
                <option value="all">Tất cả cấp học</option>
                <option value="L1-3">Tiểu học (L1-3)</option>
                <option value="L4-5">Tiểu học (L4-5)</option>
                <option value="L6-7">THCS (L6-7)</option>
                <option value="L8-9">THCS (L8-9)</option>
                <option value="L10-12">THPT (L10-12)</option>
              </select>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              <button
                type="button"
                onClick={handleSelectAllFiltered}
                className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                Chọn tất cả
              </button>
              <button
                type="button"
                onClick={handleClearFiltered}
                className="px-2.5 py-1 text-xs font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
              >
                Bỏ chọn
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* VIEW 1: DETAILED TABLE */}
      {viewMode === 'table' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto max-h-[580px] scrollbar-thin">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-100 sticky top-0 z-10 border-b border-slate-300 text-slate-800 font-bold">
                <tr>
                  <th className="py-3 px-3 w-12 text-center">Chọn</th>
                  <th className="py-3 px-3 w-28 whitespace-nowrap">Mã chỉ báo</th>
                  <th className="py-3 px-3 w-48">Miền &amp; Thành phần</th>
                  <th className="py-3 px-2 w-28 text-center">Mức độ / Lớp</th>
                  <th className="py-3 px-3 w-60">Nhiệm vụ dạy học</th>
                  <th className="py-3 px-3">Yêu cầu cần đạt (YCCD) &amp; Diễn giải cụ thể</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map((item) => {
                  const isSelected = selectedCodes.includes(item.code);
                  return (
                    <tr
                      key={item.code}
                      onClick={() => toggleSelectCode(item.code)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-indigo-50/70 hover:bg-indigo-100/70 font-medium'
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
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

                      <td className="py-3 px-3 align-top whitespace-nowrap">
                        <span className="font-mono font-bold text-xs bg-indigo-100 text-indigo-900 border border-indigo-200 px-2 py-0.5 rounded inline-block">
                          {item.code}
                        </span>
                      </td>

                      <td className="py-3 px-3 align-top">
                        <div className="font-bold text-slate-900">{item.domainName}</div>
                        <div className="text-[11px] text-slate-600 mt-0.5">{item.subName}</div>
                      </td>

                      <td className="py-3 px-2 align-top text-center whitespace-nowrap">
                        <span className="inline-block text-[11px] px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-semibold">
                          {item.levelCode}
                        </span>
                        <div className="text-[10px] text-slate-500 mt-0.5">{item.gradeLevel}</div>
                      </td>

                      <td className="py-3 px-3 align-top text-slate-700 italic text-[11px]">
                        {item.teachingTask}
                      </td>

                      <td className="py-3 px-3 align-top">
                        <div className="font-bold text-slate-900 text-xs mb-1">{item.yccd}</div>
                        <p className="text-slate-600 text-[11px] leading-relaxed bg-slate-50 p-2 rounded border border-slate-200/60">
                          <b>Diễn giải:</b> {item.fullExplanation}
                        </p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 2: CARDS GRID */}
      {viewMode === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[580px] overflow-y-auto pr-1 scrollbar-thin">
          {filteredItems.map((item) => {
            const isSelected = selectedCodes.includes(item.code);
            return (
              <div
                key={item.code}
                onClick={() => toggleSelectCode(item.code)}
                className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-50/40 shadow-xs ring-1 ring-indigo-500/20'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs bg-indigo-100 text-indigo-900 px-2 py-0.5 rounded border border-indigo-200">
                        {item.code}
                      </span>
                      <span className="text-[11px] text-slate-500 font-medium">
                        {item.levelCode} · {item.gradeLevel}
                      </span>
                    </div>

                    <div className="shrink-0">
                      {isSelected ? (
                        <div className="w-4 h-4 rounded bg-indigo-600 flex items-center justify-center text-white">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      ) : (
                        <div className="w-4 h-4 rounded border border-slate-300 bg-white" />
                      )}
                    </div>
                  </div>

                  <h4 className="text-xs font-bold text-slate-900 leading-snug">{item.yccd}</h4>
                  <div className="text-[11px] text-slate-500 italic mt-1">{item.teachingTask}</div>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-100 text-[11px] text-slate-600 bg-slate-50 p-2 rounded">
                  <b>Diễn giải:</b> {item.fullExplanation}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
