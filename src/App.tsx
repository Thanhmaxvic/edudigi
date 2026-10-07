import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { CompetencySelector } from './components/CompetencySelector';
import { EquipmentSection, EquipmentItem } from './components/EquipmentSection';
import { SourceMaterialUploader, SgkImageItem } from './components/SourceMaterialUploader';
import { LessonPlanPreview } from './components/LessonPlanPreview';
import { FrameworkView } from './components/FrameworkModal';
import { StandardsView } from './components/StandardsView';
import { GmailAccountModal } from './components/GmailAccountModal';
import {
  SUBJECTS,
  GRADES,
  CURRICULA,
  DEFAULT_TEACHER_EQUIPMENT,
  DEFAULT_STUDENT_EQUIPMENT,
} from './data/competencyData';
import { COMPETENCY_3456_ITEMS } from './data/competency3456Items';
import { CustomIndicatorEntry } from './components/CompetencySelector';
import {
  TeacherAccount,
  getSavedTeacherAccount,
} from './utils/userAccount';
import { exportLessonPlanToDocx } from './utils/docxExport';
import { injectIntoDocxWithReport } from './utils/docxInjector';
import { saveAs } from 'file-saver';
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  Check,
  FileText,
  Mail,
  CheckCircle2,
  ShieldCheck,
  Key,
} from 'lucide-react';

export default function App() {
  const [activeNavTab, setActiveNavTab] = useState<'editor' | 'framework' | 'standards'>('editor');
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Teacher Gmail Account & Personal Quota
  const [teacherAccount, setTeacherAccount] = useState<TeacherAccount | null>(() => getSavedTeacherAccount());
  const [isAccountModalOpen, setIsAccountModalOpen] = useState<boolean>(false);
  const [accountRequiredMessage, setAccountRequiredMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleAccountSync = () => {
      setTeacherAccount(getSavedTeacherAccount());
    };
    window.addEventListener('edudigi_account_changed', handleAccountSync);
    return () => {
      window.removeEventListener('edudigi_account_changed', handleAccountSync);
    };
  }, []);

  // Lesson information
  const [subject, setSubject] = useState<string>('Khoa học tự nhiên');
  const [grade, setGrade] = useState<string>('Lớp 7');
  const [lessonTitle, setLessonTitle] = useState<string>('');
  const [lessonDuration, setLessonDuration] = useState<string>('2 tiết');
  const [curriculum, setCurriculum] = useState<string>('Kết nối tri thức với cuộc sống (NXB GDVN)');

  // Competencies: Official VB 3456 Codes (default 4 core indicators)
  const [selectedCodes, setSelectedCodes] = useState<string[]>([
    '1.1.TC1b',
    '1.2.TC1a',
    '2.2.TC1a',
    '6.1.TC1a',
  ]);

  // Custom Teacher-defined / Pasted Indicators
  const [customIndicators, setCustomIndicators] = useState<CustomIndicatorEntry[]>([
    {
      code: 'NLS.GV-1',
      yccd: 'Sử dụng phần mềm chuyên ngành / thí nghiệm mô phỏng',
      explanation: 'Học sinh điều chỉnh tham số trên phần mềm mô phỏng theo nhóm, quan sát sự biến thiên và báo cáo kết quả trên Smart TV.',
    },
  ]);

  // Equipment & Tools
  const [teacherEquipment, setTeacherEquipment] = useState<EquipmentItem[]>([...DEFAULT_TEACHER_EQUIPMENT]);
  const [studentEquipment, setStudentEquipment] = useState<EquipmentItem[]>([...DEFAULT_STUDENT_EQUIPMENT]);
  const [digitalTools, setDigitalTools] = useState<string[]>([
    'Padlet (Bảng cộng tác số)',
    'Quizizz (Trắc nghiệm số tương tác)',
    'PhET Interactive Simulations (Thí nghiệm ảo KHTN)',
  ]);

  // Teacher Uploaded Sample Lesson Plan / Previous Lesson Plan & Textbook
  const [oldLessonPlanText, setOldLessonPlanText] = useState<string>('');
  const [customNote, setCustomNote] = useState<string>('');
  const [sgkImages, setSgkImages] = useState<SgkImageItem[]>([]);
  const [oldPlanImages, setOldPlanImages] = useState<SgkImageItem[]>([]);
  const [originalDocxBuffer, setOriginalDocxBuffer] = useState<ArrayBuffer | null>(null);
  const [formattingOptions, setFormattingOptions] = useState({
    fontName: 'Times New Roman',
    fontSize: 26, // 13pt
    lineSpacing: 240, // Single
    paraSpacing: 120, // 6pt
    pageNumber: 'bottom-center' as 'bottom-center' | 'bottom-right' | 'none',
    margins: { top: 850, bottom: 850, left: 1417, right: 850 },
  });

  // Generation status
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generatedPlan, setGeneratedPlan] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Reset all
  const handleReset = () => {
    if (window.confirm('Thầy/cô có chắc chắn muốn đặt lại để chuẩn bị soạn bài học mới?')) {
      setLessonTitle('');
      setOldLessonPlanText('');
      setCustomNote('');
      setSgkImages([]);
      setOldPlanImages([]);
      setOriginalDocxBuffer(null);
      setGeneratedPlan('');
      setCurrentStep(1);
    }
  };

  // Generate lesson plan
  const handleGeneratePlan = async () => {
    // 1. Check title (auto-detect from old lesson plan if teacher loaded/uploaded document)
    let activeTitle = lessonTitle.trim();
    if (!activeTitle && oldLessonPlanText.trim()) {
      const match = oldLessonPlanText.match(/(?:BÀI\s+\d+[:\s\.\-]+[^\n\r]+|BÀI\s+[^\n\r]+)/i);
      if (match) {
        activeTitle = match[0].trim().replace(/^#+\s*/, '');
        setLessonTitle(activeTitle);
      }
    }

    if (!activeTitle) {
      alert('Vui lòng nhập Tên bài dạy trước khi tạo giáo án!');
      setCurrentStep(1);
      return;
    }

    // 2. CHECK GMAIL ACCOUNT: Protect author's quota by requiring teacher's Gmail connection
    if (!teacherAccount) {
      setAccountRequiredMessage(
        'Để tránh tiêu tốn tài nguyên tín dụng của tác giả ứng dụng, Thầy/Cô vui lòng kết nối thông qua tài khoản Gmail của mình để sử dụng hạn ngạch AI miễn phí (Google cấp 1.500 yêu cầu/ngày cho mỗi tài khoản).'
      );
      setIsAccountModalOpen(true);
      return;
    }

    setIsGenerating(true);
    setErrorMessage(null);

    const standardPayload = COMPETENCY_3456_ITEMS.filter((item) =>
      selectedCodes.includes(item.code)
    ).map((item) => ({
      code: item.code,
      domain: item.domainName,
      subName: item.subName,
      levelCode: item.levelCode,
      gradeLevel: item.gradeLevel,
      teachingTask: item.teachingTask,
      yccd: item.yccd,
      fullExplanation: item.fullExplanation,
      isCustom: false,
    }));

    const customPayload = customIndicators
      .filter((c) => selectedCodes.includes(c.code))
      .map((c) => ({
        code: c.code,
        domain: 'Chỉ báo & diễn giải do Giáo viên tự dán',
        yccd: c.yccd,
        fullExplanation: c.explanation,
        isCustom: true,
      }));

    const competenciesPayload = [...customPayload, ...standardPayload];

    try {
      const response = await fetch('/api/generate-lesson-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-gemini-key': teacherAccount.apiKey,
          'x-user-email': teacherAccount.email,
        },
        body: JSON.stringify({
          userApiKey: teacherAccount.apiKey,
          userEmail: teacherAccount.email,
          userName: teacherAccount.name,
          subject,
          grade,
          lessonTitle: activeTitle,
          lessonDuration,
          curriculum,
          digitalCompetencies: competenciesPayload,
          teacherEquipment,
          studentEquipment,
          digitalTools,
          oldLessonPlanText,
          sgkImages: sgkImages.map((img) => ({
            id: img.id,
            name: img.name,
            mimeType: img.mimeType,
            data: img.data,
          })),
          customNote,
        }),
      });

      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || 'Lỗi xử lý kế hoạch bài dạy từ máy chủ');
      }

      setGeneratedPlan(data.rawContent);
      setCurrentStep(5);
    } catch (err: any) {
      console.error('Generation error:', err);
      // If error is about API key or quota, prompt modal
      if (err.message?.includes('API key') || err.message?.includes('Gmail')) {
        setAccountRequiredMessage(err.message);
        setIsAccountModalOpen(true);
      }
      setErrorMessage(err.message || 'Không thể tạo giáo án. Vui lòng kiểm tra lại kết nối.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExportDocx = async () => {
    if (!generatedPlan) return;
    try {
      setIsExporting(true);
      if (originalDocxBuffer) {
        // Bảo toàn nguyên bản: chỉ chèn nội dung đỏ vào file Word gốc
        const { blob, report } = await injectIntoDocxWithReport(originalDocxBuffer, generatedPlan);
        saveAs(blob, `[NangLucSo] ${lessonTitle || 'GiaoAn'}.docx`);
        if (report.appended > 0) {
          alert(
            `Đã chèn ${report.injected}/${report.total} nội dung năng lực số vào đúng vị trí.\n` +
              `${report.appended} nội dung chưa xác định được vị trí đã được đưa vào PHỤ LỤC cuối giáo án.`
          );
        }
        return;
      }
      await exportLessonPlanToDocx(generatedPlan, {
        lessonTitle: lessonTitle || 'GiaoAn_NangLucSo',
        subject,
        grade,
        images: oldPlanImages,
        formatting: formattingOptions,
      });
    } catch (err: any) {
      alert('Có lỗi khi tải tệp Word: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  const steps = [
    { num: 1, title: 'Thông tin bài dạy', desc: 'Môn, lớp, tên bài, thời lượng' },
    { num: 2, title: 'Chỉ báo năng lực số', desc: `VB 3456 & tự dán (${selectedCodes.length} chọn)` },
    { num: 3, title: 'Thiết bị & học liệu số', desc: 'Smart TV, Laptop, ĐT...' },
    { num: 4, title: 'Bài soạn gốc & SGK', desc: 'Mẫu giáo án của GV & ảnh SGK' },
    { num: 5, title: 'Giáo án & xuất Word A4', desc: 'Theo chuẩn CV 5512, bôi đỏ phần mới' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Header
        activeTab={activeNavTab}
        setActiveTab={setActiveNavTab}
        onReset={handleReset}
        hasGeneratedPlan={!!generatedPlan}
        onExportDocx={handleExportDocx}
        isExporting={isExporting}
        account={teacherAccount}
        onOpenAccountModal={() => {
          setAccountRequiredMessage(null);
          setIsAccountModalOpen(true);
        }}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeNavTab === 'framework' && (
          <FrameworkView
            selectedCodes={selectedCodes}
            onToggleCode={(code) => {
              if (selectedCodes.includes(code)) {
                setSelectedCodes(selectedCodes.filter((c) => c !== code));
              } else {
                setSelectedCodes([...selectedCodes, code]);
              }
            }}
            onSelectMultipleCodes={setSelectedCodes}
            onGoToEditor={() => {
              setActiveNavTab('editor');
              setCurrentStep(2);
            }}
            customPastedIndicators={customIndicators}
            onAddCustomIndicator={(item) => {
              setCustomIndicators([...customIndicators, item]);
              setSelectedCodes([...selectedCodes, item.code]);
            }}
            onRemoveCustomIndicator={(idx) => {
              const target = customIndicators[idx];
              if (target) {
                setCustomIndicators(customIndicators.filter((_, i) => i !== idx));
                setSelectedCodes(selectedCodes.filter((c) => c !== target.code));
              }
            }}
          />
        )}

        {activeNavTab === 'standards' && (
          <StandardsView
            onGoToEditor={() => {
              setActiveNavTab('editor');
              setCurrentStep(1);
            }}
          />
        )}

        {activeNavTab === 'editor' && (
          <div className="space-y-6">
            {/* Quick Summary Banner with Teacher Quota notice */}
            <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-semibold text-indigo-300 block">
                  Trợ lý số sư phạm chuẩn Bộ Giáo dục và Đào tạo
                </span>
                <h2 className="text-lg sm:text-xl font-bold mt-0.5">
                  Soạn giáo án tích hợp năng lực số (theo Công văn 5512/BGDĐT)
                </h2>
                <p className="text-xs text-indigo-200 mt-1 max-w-2xl leading-relaxed">
                  Lựa chọn từ Bảng chỉ báo năng lực số chi tiết 6 miền chuẩn hoặc tự nhập chỉ báo đặc thù môn học. Hệ thống tự động tích hợp vào các hoạt động và bôi đỏ nổi bật mọi nội dung số mới.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 shrink-0">
                {teacherAccount ? (
                  <button
                    type="button"
                    onClick={() => setIsAccountModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-xs hover:bg-emerald-500/30 transition-colors"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Hạn ngạch: {teacherAccount.email}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setAccountRequiredMessage(null);
                      setIsAccountModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-400/50 text-amber-200 text-xs hover:bg-amber-500/30 transition-colors font-semibold"
                  >
                    <Mail className="w-3.5 h-3.5 text-amber-400" />
                    <span>Kết nối Gmail cá nhân</span>
                  </button>
                )}
                <span className="text-xs px-3 py-1.5 rounded-lg bg-indigo-800/80 border border-indigo-700 text-indigo-200">
                  Xuất Word: A4 lề 2,5 cm - 1,5 cm
                </span>
              </div>
            </div>

            {/* Step navigation bar (5 Steps) */}
            <div className="no-print bg-white rounded-xl border border-slate-200 p-2.5 shadow-xs">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                {steps.map((st) => {
                  const isActive = currentStep === st.num;
                  const isCompleted = currentStep > st.num || (st.num === 5 && !!generatedPlan);

                  return (
                    <button
                      key={st.num}
                      type="button"
                      onClick={() => setCurrentStep(st.num)}
                      className={`text-left p-2.5 rounded-lg transition-all ${
                        isActive
                          ? 'bg-indigo-50 border border-indigo-300 ring-1 ring-indigo-500/30'
                          : isCompleted
                          ? 'bg-slate-50 hover:bg-slate-100/80 border border-slate-200'
                          : 'hover:bg-slate-50 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                            isActive
                              ? 'bg-indigo-600 text-white'
                              : isCompleted
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {isCompleted ? <Check className="w-3 h-3 stroke-[3]" /> : st.num}
                        </div>
                        <span
                          className={`text-xs font-bold truncate ${
                            isActive ? 'text-indigo-900' : 'text-slate-800'
                          }`}
                        >
                          {st.title}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-1 pl-7">
                        {st.desc}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Error Message if any */}
            {errorMessage && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <span className="font-semibold block mb-0.5">Thông báo sự cố:</span>
                    <span>{errorMessage}</span>
                  </div>
                </div>
                {(errorMessage.includes('503') ||
                  errorMessage.includes('High Demand') ||
                  errorMessage.includes('quá tải') ||
                  errorMessage.includes('thử lại')) && (
                  <button
                    type="button"
                    onClick={handleGeneratePlan}
                    disabled={isGenerating}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-colors shrink-0 whitespace-nowrap"
                  >
                    Thử lại ngay
                  </button>
                )}
              </div>
            )}

            {/* STEP 1: Thông tin bài dạy */}
            {currentStep === 1 && (
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-5">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    Bước 1: Chọn môn học, khối lớp và tên bài dạy
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Cung cấp thông tin cụ thể về bài học mà thầy/cô chuẩn bị lên lớp giảng dạy.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Subject */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Môn học / Hoạt động giáo dục <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium text-slate-900"
                    >
                      {SUBJECTS.map((s) => (
                        <option key={s.id} value={s.name}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Grade */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Khối lớp <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={grade}
                      onChange={(e) => setGrade(e.target.value)}
                      className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium text-slate-900"
                    >
                      {GRADES.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Duration */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Thời lượng giảng dạy
                    </label>
                    <input
                      type="text"
                      value={lessonDuration}
                      onChange={(e) => setLessonDuration(e.target.value)}
                      placeholder="VD: 1 tiết (45 phút) hoặc 2 tiết..."
                      className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>

                  {/* Curriculum Book */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Bộ sách giáo khoa
                    </label>
                    <select
                      value={curriculum}
                      onChange={(e) => setCurriculum(e.target.value)}
                      className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    >
                      {CURRICULA.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Lesson Title */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tên bài dạy <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={lessonTitle}
                    onChange={(e) => setLessonTitle(e.target.value)}
                    placeholder="Nhập tên bài dạy (VD: Bài 13: Độ to và độ cao của âm hoặc Bài 5: Đo khối lượng...)"
                    className="w-full text-xs px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium text-slate-900"
                  />
                </div>

                <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                  <span className="text-xs text-slate-500">
                    Bước 1/5: Thiết lập thông tin cơ bản của bài học
                  </span>

                  <button
                    type="button"
                    onClick={() => {
                      if (!lessonTitle.trim()) {
                        alert('Vui lòng nhập Tên bài dạy!');
                        return;
                      }
                      setCurrentStep(2);
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-xs"
                  >
                    <span>Tiếp tục: Bước 2 (Bảng chỉ báo năng lực số)</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: BẢNG CHỈ BÁO NĂNG LỰC SỐ CHI TIẾT & TỰ NHẬP */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <CompetencySelector
                  selectedCodes={selectedCodes}
                  onChangeSelectedCodes={setSelectedCodes}
                  customIndicators={customIndicators}
                  onChangeCustomIndicators={setCustomIndicators}
                  subjectName={subject}
                  gradeLevel={grade}
                />

                <div className="flex justify-between items-center pt-2">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Quay lại Bước 1</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-xs"
                  >
                    <span>Tiếp tục: Bước 3 (Học liệu và thiết bị số)</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: Thiết bị & Học liệu số */}
            {currentStep === 3 && (
              <div className="space-y-4">
                <EquipmentSection
                  teacherEquipment={teacherEquipment}
                  setTeacherEquipment={setTeacherEquipment}
                  studentEquipment={studentEquipment}
                  setStudentEquipment={setStudentEquipment}
                  digitalTools={digitalTools}
                  setDigitalTools={setDigitalTools}
                />

                <div className="flex justify-between items-center pt-2">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Quay lại Bước 2 (Chỉ báo năng lực số)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCurrentStep(4)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-xs"
                  >
                    <span>Tiếp tục: Bước 4 (Bài soạn gốc và SGK)</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4: Đưa lên Bài soạn gốc của Giáo viên & Ảnh SGK */}
            {currentStep === 4 && (
              <div className="space-y-4">
                <SourceMaterialUploader
                  sgkImages={sgkImages}
                  setSgkImages={setSgkImages}
                  oldLessonPlanText={oldLessonPlanText}
                  setOldLessonPlanText={setOldLessonPlanText}
                  customNote={customNote}
                  setCustomNote={setCustomNote}
                  teacherAccount={teacherAccount}
                  oldPlanImages={oldPlanImages}
                  setOldPlanImages={setOldPlanImages}
                  setOriginalDocxBuffer={setOriginalDocxBuffer}
                  onOpenAccountModal={() => {
                    setAccountRequiredMessage(null);
                    setIsAccountModalOpen(true);
                  }}
                />

                {/* TEACHER GMAIL ACCOUNT STATUS CARD */}
                <div
                  className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    teacherAccount
                      ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                      : 'bg-amber-50 border-amber-300 text-amber-950'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        teacherAccount
                          ? 'bg-emerald-600 text-white'
                          : 'bg-amber-500 text-white'
                      }`}
                    >
                      {teacherAccount ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : (
                        <Mail className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-bold flex items-center gap-2">
                        {teacherAccount ? (
                          <>
                            <span>Tài khoản Gmail: {teacherAccount.email}</span>
                            <span className="text-[10px] px-1.5 py-0.2 bg-emerald-200 text-emerald-800 rounded font-semibold">
                              Không tiêu tốn tín dụng tác giả
                            </span>
                          </>
                        ) : (
                          <>
                            <span>Chưa kết nối tài khoản Gmail của Thầy/Cô</span>
                            <span className="text-[10px] px-1.5 py-0.2 bg-amber-200 text-amber-900 rounded font-bold">
                              Bắt buộc để soạn bài
                            </span>
                          </>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        {teacherAccount
                          ? 'Yêu cầu soạn bài sẽ sử dụng hạn ngạch AI cá nhân miễn phí của Thầy/Cô từ Google AI Studio.'
                          : 'Vui lòng kết nối tài khoản Gmail để bảo vệ tài nguyên của tác giả và sử dụng hạn ngạch miễn phí 1.500 lượt/ngày.'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setAccountRequiredMessage(null);
                      setIsAccountModalOpen(true);
                    }}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors shrink-0 ${
                      teacherAccount
                        ? 'bg-white hover:bg-emerald-100/70 border-emerald-300 text-emerald-800'
                        : 'bg-amber-600 hover:bg-amber-700 text-white border-transparent shadow-xs'
                    }`}
                  >
                    {teacherAccount ? 'Quản lý tài khoản' : 'Kết nối Gmail ngay (30s)'}
                  </button>
                </div>

                {/* Call-to-action to generate */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-xs">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">5</span>
                    <h4 className="text-sm font-bold text-slate-800">Cấu hình định dạng văn bản (Chỉ áp dụng khi tạo mới hoặc dựng lại)</h4>
                  </div>
                  
                  {originalDocxBuffer ? (
                    <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                      <b>✔ Đang bật chế độ BẢO TOÀN NGUYÊN BẢN (có file Word gốc):</b> Các thông số căn lề, font chữ, cỡ chữ, cách dòng sẽ được giữ y hệt file Word gốc của bạn để không làm vỡ cấu trúc.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 text-xs">
                      <div>
                        <label className="block text-slate-600 font-medium mb-1">Font chữ</label>
                        <select className="w-full border-slate-300 rounded focus:ring-indigo-500 focus:border-indigo-500"
                          value={formattingOptions.fontName} onChange={(e) => setFormattingOptions({...formattingOptions, fontName: e.target.value})}>
                          <option value="Times New Roman">Times New Roman</option>
                          <option value="Arial">Arial</option>
                          <option value="Calibri">Calibri</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-slate-600 font-medium mb-1">Cỡ chữ</label>
                        <select className="w-full border-slate-300 rounded focus:ring-indigo-500 focus:border-indigo-500"
                          value={formattingOptions.fontSize} onChange={(e) => setFormattingOptions({...formattingOptions, fontSize: Number(e.target.value)})}>
                          <option value={22}>11 pt</option>
                          <option value={24}>12 pt</option>
                          <option value={26}>13 pt</option>
                          <option value={28}>14 pt</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-slate-600 font-medium mb-1">Cách dòng</label>
                        <select className="w-full border-slate-300 rounded focus:ring-indigo-500 focus:border-indigo-500"
                          value={formattingOptions.lineSpacing} onChange={(e) => setFormattingOptions({...formattingOptions, lineSpacing: Number(e.target.value)})}>
                          <option value={240}>Single (1.0)</option>
                          <option value={276}>1.15 lines</option>
                          <option value={360}>1.5 lines</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-slate-600 font-medium mb-1">Cách đoạn</label>
                        <select className="w-full border-slate-300 rounded focus:ring-indigo-500 focus:border-indigo-500"
                          value={formattingOptions.paraSpacing} onChange={(e) => setFormattingOptions({...formattingOptions, paraSpacing: Number(e.target.value)})}>
                          <option value={0}>0 pt</option>
                          <option value={120}>6 pt</option>
                          <option value={240}>12 pt</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-slate-600 font-medium mb-1">Đánh số trang</label>
                        <select className="w-full border-slate-300 rounded focus:ring-indigo-500 focus:border-indigo-500"
                          value={formattingOptions.pageNumber} onChange={(e) => setFormattingOptions({...formattingOptions, pageNumber: e.target.value as any})}>
                          <option value="bottom-center">Giữa trang (Dưới)</option>
                          <option value="bottom-right">Góc phải (Dưới)</option>
                          <option value="none">Không đánh số</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-slate-600 font-medium mb-1">Căn lề</label>
                        <select className="w-full border-slate-300 rounded focus:ring-indigo-500 focus:border-indigo-500"
                          value={formattingOptions.margins.top === 850 ? 'normal' : 'narrow'} 
                          onChange={(e) => {
                            if (e.target.value === 'normal') {
                              setFormattingOptions({...formattingOptions, margins: { top: 850, bottom: 850, left: 1417, right: 850 }});
                            } else {
                              // Narrow (1.27cm ~ 720 dxa)
                              setFormattingOptions({...formattingOptions, margins: { top: 720, bottom: 720, left: 720, right: 720 }});
                            }
                          }}>
                          <option value="normal">Chuẩn (T/D/P: 1.5cm, T: 2.5cm)</option>
                          <option value="narrow">Hẹp (1.27cm)</option>
                        </select>
                      </div>
                      <div className="col-span-2 sm:col-span-3 md:col-span-6 mt-1 text-slate-500 italic text-[10px]">
                        Lưu ý: Hệ thống hiện tại chỉ xuất bản định dạng Word mới chuẩn (.docx). Các định dạng .doc hoặc .pdf xin vui lòng mở file .docx và tự lưu dưới dạng khác (Save as) trên máy tính.
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-900 text-white rounded-xl p-5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <h4 className="text-base font-bold flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-indigo-400" />
                      Tạo kế hoạch bài dạy tích hợp năng lực số
                    </h4>
                    <p className="text-xs text-indigo-200 mt-1 max-w-2xl leading-relaxed">
                      AI sẽ giữ nguyên cấu trúc bài soạn gốc hoặc áp dụng khung chuẩn CV 5512/BGDĐT, tích hợp đầy đủ bảng chỉ báo năng lực số đã chọn và tự động bôi đỏ toàn bộ phần mới.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setCurrentStep(3)}
                      className="px-3 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
                    >
                      Quay lại Bước 3
                    </button>

                    <button
                      type="button"
                      onClick={handleGeneratePlan}
                      disabled={isGenerating}
                      className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white text-xs sm:text-sm font-bold rounded-lg shadow-sm transition-all disabled:opacity-50"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>{isGenerating ? 'Đang soạn và bôi đỏ theo mẫu...' : 'Bắt đầu soạn giáo án tích hợp'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 5: Xem Giáo án A4 & Xuất Word */}
            {currentStep === 5 && (
              <div>
                {isGenerating ? (
                  <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-4 shadow-xs">
                    <div className="w-12 h-12 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin mx-auto" />
                    <div>
                      <h3 className="text-base font-bold text-slate-900">
                        Đang xây dựng kế hoạch bài dạy tích hợp năng lực số...
                      </h3>
                      <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                        Đang đối chiếu chỉ báo năng lực số đã chọn và tự nhập, phân tích nội dung bài học và tự động bôi đỏ toàn bộ các câu từ số mới bằng hạn ngạch Gmail của Thầy/Cô.
                      </p>
                    </div>
                  </div>
                ) : generatedPlan ? (
                  <LessonPlanPreview
                    content={generatedPlan}
                    onChangeContent={setGeneratedPlan}
                    lessonTitle={lessonTitle}
                    subject={subject}
                    grade={grade}
                    sgkImages={oldPlanImages}
                    originalDocxBuffer={originalDocxBuffer}
                    formattingOptions={formattingOptions}
                  />
                ) : (
                  <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-4">
                    <FileText className="w-12 h-12 text-slate-300 mx-auto" />
                    <p className="text-sm text-slate-600">
                      Chưa có nội dung giáo án được tạo. Vui lòng bấm nút Soạn giáo án ở Bước 4.
                    </p>
                    <button
                      type="button"
                      onClick={() => setCurrentStep(4)}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold"
                    >
                      Về Bước 4 để Tạo Giáo Án
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Gmail Account Modal */}
      <GmailAccountModal
        isOpen={isAccountModalOpen}
        onClose={() => {
          setIsAccountModalOpen(false);
          setAccountRequiredMessage(null);
        }}
        currentAccount={teacherAccount}
        onAccountUpdated={(acc) => setTeacherAccount(acc)}
        requiredMessage={accountRequiredMessage}
      />

      {/* Footer */}
      <footer className="no-print bg-white border-t border-slate-200 py-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800">EduDigi</span>
            <span>·</span>
            <span>Ứng dụng soạn giáo án tích hợp Năng lực số chuẩn Bộ GD&ĐT (CV 5512)</span>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-slate-600">
            <span>Sử dụng hạn ngạch Gmail cá nhân miễn phí</span>
            <span>·</span>
            <span>Tự động bôi đỏ nội dung số mới</span>
            <span>·</span>
            <span>Xuất Word A4 (lề 2,5 cm - 1,5 cm)</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
