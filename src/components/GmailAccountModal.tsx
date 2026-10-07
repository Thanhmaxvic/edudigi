import React, { useState } from 'react';
import {
  TeacherAccount,
  saveTeacherAccount,
  clearTeacherAccount,
} from '../utils/userAccount';
import {
  Key,
  Mail,
  ShieldCheck,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Sparkles,
  HelpCircle,
  LogOut,
  UserCheck,
} from 'lucide-react';

interface GmailAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAccount: TeacherAccount | null;
  onAccountUpdated: (account: TeacherAccount | null) => void;
  requiredMessage?: string | null;
}

export const GmailAccountModal: React.FC<GmailAccountModalProps> = ({
  isOpen,
  onClose,
  currentAccount,
  onAccountUpdated,
  requiredMessage,
}) => {
  const [email, setEmail] = useState(currentAccount?.email || '');
  const [apiKey, setApiKey] = useState(currentAccount?.apiKey || '');
  const [name, setName] = useState(currentAccount?.name || '');
  const [showKey, setShowKey] = useState(false);

  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  if (!isOpen) return null;

  const handleVerifyAndSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim() || !email.includes('@')) {
      alert('Vui lòng nhập địa chỉ Gmail hợp lệ (VD: tengiaovien@gmail.com)!');
      return;
    }

    if (!apiKey.trim()) {
      alert('Vui lòng dán khóa Gemini API tạo từ tài khoản Gmail của Thầy/Cô!');
      return;
    }

    setIsVerifying(true);
    setVerificationResult(null);

    try {
      const response = await fetch('/api/verify-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || 'Khóa API không hợp lệ hoặc đã hết hạn.');
      }

      const newAccount: TeacherAccount = {
        email: email.trim(),
        apiKey: apiKey.trim(),
        name: name.trim() || email.split('@')[0],
        connectedAt: new Date().toISOString(),
      };

      saveTeacherAccount(newAccount);
      onAccountUpdated(newAccount);

      setVerificationResult({
        success: true,
        message: 'Xác thực thành công! Tài khoản Gmail của Thầy/Cô đã sẵn sàng sử dụng.',
      });

      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      console.error('Verification error:', err);
      setVerificationResult({
        success: false,
        message: err.message || 'Không thể xác thực khóa. Vui lòng kiểm tra lại.',
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDisconnect = () => {
    if (window.confirm('Thầy/Cô có chắc chắn muốn ngắt kết nối tài khoản Gmail này?')) {
      clearTeacherAccount();
      onAccountUpdated(null);
      setEmail('');
      setApiKey('');
      setName('');
      setVerificationResult(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
              <Mail className="w-5 h-5 text-indigo-200" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold">
                Tài Khoản Gmail & Hạn Ngạch Cá Nhân
              </h3>
              <p className="text-xs text-indigo-200">
                Sử dụng hạn ngạch AI miễn phí của chính Thầy/Cô
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Body content */}
        <div className="p-5 sm:p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {requiredMessage && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Yêu cầu xác thực tài khoản:</span>
                <span>{requiredMessage}</span>
              </div>
            </div>
          )}

          {/* Explanation Banner */}
          <div className="p-3.5 bg-blue-50/80 border border-blue-200/80 rounded-xl text-xs text-blue-900 leading-relaxed space-y-1.5">
            <div className="font-bold flex items-center gap-1.5 text-blue-950">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              Tại sao cần kết nối tài khoản Gmail của Thầy/Cô?
            </div>
            <p>
              Google cung cấp <b>miễn phí 100% tài nguyên Gemini AI</b> (1.500 lượt soạn bài/ngày) cho mọi tài khoản Gmail cá nhân thông qua Google AI Studio.
            </p>
            <p className="text-blue-800">
              Việc kết nối giúp Thầy/Cô chủ động soạn bài không giới hạn tốc độ và <b>không làm tiêu tốn tài nguyên tín dụng của tác giả ứng dụng</b>.
            </p>
          </div>

          {/* Connected status if already has account */}
          {currentAccount && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
                  <CheckCircle2 className="w-4 h-4 stroke-[3]" />
                </div>
                <div>
                  <div className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                    <span>Đang kết nối: {currentAccount.email}</span>
                    <span className="text-[10px] px-1.5 py-0.2 bg-emerald-200/80 text-emerald-900 font-semibold rounded">
                      Hạn ngạch cá nhân
                    </span>
                  </div>
                  <div className="text-[11px] text-emerald-700">
                    {currentAccount.name ? `Giáo viên: ${currentAccount.name} · ` : ''}
                    Khóa kết nối: {currentAccount.apiKey.substring(0, 8)}...
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleDisconnect}
                className="flex items-center gap-1 px-2.5 py-1 text-xs text-red-700 hover:text-red-800 hover:bg-red-50 border border-red-200 rounded-lg transition-colors shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Ngắt kết nối</span>
              </button>
            </div>
          )}

          {/* 3 Steps Guide to get free API key from Gmail */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5 text-xs text-slate-700">
            <div className="font-bold text-slate-900 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                Cách lấy mã kết nối miễn phí từ Gmail (30 giây):
              </span>
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-indigo-600 hover:text-indigo-700 font-bold inline-flex items-center gap-1 hover:underline"
              >
                <span>Mở Google AI Studio</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <ol className="space-y-1.5 pl-4 list-decimal marker:font-bold marker:text-indigo-600">
              <li>
                Bấm nút <b>&quot;Mở Google AI Studio&quot;</b> ở trên và đăng nhập bằng chính <b>tài khoản Gmail của Thầy/Cô</b>.
              </li>
              <li>
                Bấm vào nút xanh <b>&quot;Create API key&quot;</b> (Tạo khóa API) &gt; chọn dự án mặc định &gt; bấm <b>&quot;Create key in existing project&quot;</b> (hoàn toàn miễn phí).
              </li>
              <li>
                Sao chép chuỗi ký tự (bắt đầu bằng <code className="text-indigo-700 font-mono font-bold bg-white px-1 py-0.5 rounded border border-slate-200">AIzaSy...</code>) và dán vào ô bên dưới.
              </li>
            </ol>
          </div>

          {/* Form */}
          <form onSubmit={handleVerifyAndSave} className="space-y-3.5 pt-1">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Địa chỉ Gmail của Thầy/Cô <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="VD: nguyenvanan@gmail.com hoặc gv@thcs.edu.vn"
                  className="w-full text-xs pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium text-slate-900"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tên hoặc Danh xưng Giáo viên (Tùy chọn)
              </label>
              <div className="relative">
                <UserCheck className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="VD: Cô Mai Lan - THPT Chuyên"
                  className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Khóa kết nối Gemini API từ Gmail <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Key className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Dán mã khóa AIzaSy... đã tạo từ Gmail"
                  className="w-full text-xs pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Khóa được lưu bảo mật trên chính trình duyệt máy tính của Thầy/Cô. Thầy/Cô chỉ cần cấu hình 1 lần.
              </p>
            </div>

            {/* Verification Result Feedback */}
            {verificationResult && (
              <div
                className={`p-3 rounded-xl text-xs flex items-start gap-2 ${
                  verificationResult.success
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
                    : 'bg-red-50 border border-red-200 text-red-900'
                }`}
              >
                {verificationResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                )}
                <span>{verificationResult.message}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors"
              >
                Đóng
              </button>

              <button
                type="submit"
                disabled={isVerifying}
                className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-lg shadow-xs transition-colors disabled:opacity-50"
              >
                {isVerifying ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Đang kiểm tra kết nối...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Lưu & Kích hoạt Tài khoản Gmail</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
