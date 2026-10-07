import React from 'react';
import { Sparkles, Download, RotateCcw, Mail, CheckCircle2, AlertTriangle, Key } from 'lucide-react';
import { TeacherAccount } from '../utils/userAccount';

interface HeaderProps {
  activeTab: 'editor' | 'framework' | 'standards';
  setActiveTab: (tab: 'editor' | 'framework' | 'standards') => void;
  onReset: () => void;
  hasGeneratedPlan: boolean;
  onExportDocx: () => void;
  isExporting: boolean;
  account: TeacherAccount | null;
  onOpenAccountModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onReset,
  hasGeneratedPlan,
  onExportDocx,
  isExporting,
  account,
  onOpenAccountModal,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Zone 1: Single text element wordmark */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveTab('editor')}
              className="flex items-center gap-2.5 text-left focus:outline-none"
            >
              <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-xs">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xl font-bold tracking-tight text-slate-900 font-sans">
                  EduDigi
                </span>
                <span className="hidden sm:inline-block ml-2 text-xs font-medium text-slate-500">
                  Tích hợp năng lực số vào kế hoạch bài dạy
                </span>
              </div>
            </button>
          </div>

          {/* Zone 2: 3 clean text navigation links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <button
              onClick={() => setActiveTab('editor')}
              className={`transition-colors pb-1 border-b-2 whitespace-nowrap ${
                activeTab === 'editor'
                  ? 'border-indigo-600 text-indigo-600 font-semibold'
                  : 'border-transparent hover:text-slate-900'
              }`}
            >
              Soạn giáo án tích hợp
            </button>
            <button
              onClick={() => setActiveTab('framework')}
              className={`transition-colors pb-1 border-b-2 whitespace-nowrap ${
                activeTab === 'framework'
                  ? 'border-indigo-600 text-indigo-600 font-semibold'
                  : 'border-transparent hover:text-slate-900'
              }`}
            >
              Khung năng lực số (Bộ GD&ĐT)
            </button>
            <button
              onClick={() => setActiveTab('standards')}
              className={`transition-colors pb-1 border-b-2 whitespace-nowrap ${
                activeTab === 'standards'
                  ? 'border-indigo-600 text-indigo-600 font-semibold'
                  : 'border-transparent hover:text-slate-900'
              }`}
            >
              Quy chuẩn Word A4 & CV 5512
            </button>
          </nav>

          {/* Zone 3: Actions + Teacher Gmail Account status */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Teacher Gmail Account Button */}
            <button
              type="button"
              onClick={onOpenAccountModal}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                account
                  ? 'bg-emerald-50 hover:bg-emerald-100/80 text-emerald-800 border-emerald-300'
                  : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300 shadow-2xs animate-pulse'
              }`}
              title={
                account
                  ? `Đang sử dụng hạn ngạch tài khoản: ${account.email}`
                  : 'Vui lòng kết nối tài khoản Gmail để sử dụng hạn ngạch cá nhân'
              }
            >
              {account ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="max-w-[130px] truncate font-semibold">
                    {account.name || account.email}
                  </span>
                  <span className="hidden xl:inline text-[10px] text-emerald-700 bg-emerald-200/70 px-1 rounded">
                    Gmail
                  </span>
                </>
              ) : (
                <>
                  <Mail className="w-3.5 h-3.5 text-amber-700" />
                  <span className="font-bold">Kết nối Gmail</span>
                </>
              )}
            </button>

            {hasGeneratedPlan && (
              <button
                onClick={onExportDocx}
                disabled={isExporting}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-white bg-red-600 hover:bg-red-700 active:bg-red-800 rounded-lg shadow-xs transition-colors whitespace-nowrap disabled:opacity-50"
                title="Tải văn bản Word (.docx) chuẩn A4 lề 2.5cm và bôi đỏ nội dung số mới"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">{isExporting ? 'Đang tạo Word...' : 'Tải file Word (.docx)'}</span>
                <span className="sm:hidden">Word</span>
              </button>
            )}

            <button
              onClick={onReset}
              className="flex items-center gap-1 px-3 py-1.5 text-xs sm:text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
              title="Đặt lại để soạn bài dạy mới"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Soạn bài mới</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
