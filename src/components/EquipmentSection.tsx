import React, { useState } from 'react';
import { Plus, Trash2, Tv, Laptop, Smartphone, Wifi, Wrench, Sparkles } from 'lucide-react';
import { POPULAR_DIGITAL_TOOLS } from '../data/competencyData';

export interface EquipmentItem {
  name: string;
  quantity: string;
  note?: string;
}

interface EquipmentSectionProps {
  teacherEquipment: EquipmentItem[];
  setTeacherEquipment: React.Dispatch<React.SetStateAction<EquipmentItem[]>>;
  studentEquipment: EquipmentItem[];
  setStudentEquipment: React.Dispatch<React.SetStateAction<EquipmentItem[]>>;
  digitalTools: string[];
  setDigitalTools: React.Dispatch<React.SetStateAction<string[]>>;
}

export const EquipmentSection: React.FC<EquipmentSectionProps> = ({
  teacherEquipment,
  setTeacherEquipment,
  studentEquipment,
  setStudentEquipment,
  digitalTools,
  setDigitalTools,
}) => {
  const [newTeacherItem, setNewTeacherItem] = useState({ name: '', quantity: '1', note: '' });
  const [newStudentItem, setNewStudentItem] = useState({ name: '', quantity: '1 máy/nhóm', note: '' });
  const [customToolInput, setCustomToolInput] = useState('');

  const addTeacherEquipment = () => {
    if (!newTeacherItem.name.trim()) return;
    setTeacherEquipment([...teacherEquipment, { ...newTeacherItem }]);
    setNewTeacherItem({ name: '', quantity: '1', note: '' });
  };

  const removeTeacherEquipment = (index: number) => {
    setTeacherEquipment(teacherEquipment.filter((_, i) => i !== index));
  };

  const addStudentEquipment = () => {
    if (!newStudentItem.name.trim()) return;
    setStudentEquipment([...studentEquipment, { ...newStudentItem }]);
    setNewStudentItem({ name: '', quantity: '1 máy/nhóm', note: '' });
  };

  const removeStudentEquipment = (index: number) => {
    setStudentEquipment(studentEquipment.filter((_, i) => i !== index));
  };

  const toggleTool = (tool: string) => {
    if (digitalTools.includes(tool)) {
      setDigitalTools(digitalTools.filter((t) => t !== tool));
    } else {
      setDigitalTools([...digitalTools, tool]);
    }
  };

  const addCustomTool = () => {
    if (!customToolInput.trim()) return;
    if (!digitalTools.includes(customToolInput.trim())) {
      setDigitalTools([...digitalTools, customToolInput.trim()]);
    }
    setCustomToolInput('');
  };

  // Quick preset configurations
  const applyPresetLabRoom = () => {
    setTeacherEquipment([
      { name: 'Máy chủ giáo viên & Màn hình chiếu', quantity: '1 bộ', note: 'Quản trị phòng máy NetOp School' },
      { name: 'Mạng Internet cáp quang tốc độ cao', quantity: '1 đường truyền', note: 'Băng thông rộng' },
      { name: 'Tài khoản LMS & học liệu số', quantity: '1 tài khoản', note: 'Chia sẻ thư mục dùng chung' },
    ]);
    setStudentEquipment([
      { name: 'Máy tính để bàn học sinh', quantity: '35 - 40 máy (1 máy/HS)', note: 'Đã cài sẵn trình duyệt và phần mềm bài học' },
      { name: 'Tai nghe có micro', quantity: '35 chiếc', note: 'Phục vụ nghe audio / phát âm' },
    ]);
  };

  const applyPresetClassroomDevices = () => {
    setTeacherEquipment([
      { name: 'Laptop giáo viên', quantity: '1 chiếc', note: 'Kết nối mạng Wifi lớp học' },
      { name: 'Tivi thông minh (Smart TV 65")', quantity: '1 chiếc', note: 'Chiếu slide, video và sản phẩm nhóm' },
      { name: 'Internet Wifi lớp học', quantity: '1 đường', note: 'Đủ tải cho các nhóm truy cập' },
    ]);
    setStudentEquipment([
      { name: 'Điện thoại thông minh / Máy tính bảng', quantity: '1 máy / nhóm (4-6 HS)', note: 'Cài ứng dụng tra cứu và quét mã QR' },
      { name: 'SGK và Phiếu học tập số in mã QR', quantity: '1 bộ / HS', note: 'Kết hợp ghi chép truyền thống' },
    ]);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            Học liệu số và thiết bị chuẩn bị (giáo viên và học sinh)
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Khai báo chính xác thiết bị và số lượng thực tế tại trường để AI thiết kế hoạt động tương thích và khả thi.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={applyPresetClassroomDevices}
            className="px-2.5 py-1 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors whitespace-nowrap"
          >
            Lớp học (TV + 1 máy/nhóm)
          </button>
          <button
            type="button"
            onClick={applyPresetLabRoom}
            className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
          >
            Phòng máy vi tính (1 máy/HS)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Teacher Equipment */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Laptop className="w-4 h-4 text-indigo-600" />
              Thiết bị giáo viên chuẩn bị
            </h4>
            <span className="text-xs text-slate-400 font-mono">({teacherEquipment.length} mục)</span>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {teacherEquipment.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900 truncate">{item.name}</span>
                    <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-800 rounded font-medium text-[11px] shrink-0">
                      {item.quantity}
                    </span>
                  </div>
                  {item.note && <p className="text-[11px] text-slate-500 truncate mt-0.5">{item.note}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => removeTeacherEquipment(idx)}
                  className="text-slate-400 hover:text-red-600 p-1 transition-colors ml-2"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2 pt-1">
            <input
              type="text"
              placeholder="Tên thiết bị (VD: Smart TV 65 inch)..."
              value={newTeacherItem.name}
              onChange={(e) => setNewTeacherItem({ ...newTeacherItem, name: e.target.value })}
              className="text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg flex-1 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <input
              type="text"
              placeholder="Số lượng (VD: 1 bộ)"
              value={newTeacherItem.quantity}
              onChange={(e) => setNewTeacherItem({ ...newTeacherItem, quantity: e.target.value })}
              className="text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg w-28 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button
              type="button"
              onClick={addTeacherEquipment}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg transition-colors shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Student Equipment */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Smartphone className="w-4 h-4 text-emerald-600" />
              Thiết bị học sinh chuẩn bị
            </h4>
            <span className="text-xs text-slate-400 font-mono">({studentEquipment.length} mục)</span>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {studentEquipment.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900 truncate">{item.name}</span>
                    <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded font-medium text-[11px] shrink-0">
                      {item.quantity}
                    </span>
                  </div>
                  {item.note && <p className="text-[11px] text-slate-500 truncate mt-0.5">{item.note}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => removeStudentEquipment(idx)}
                  className="text-slate-400 hover:text-red-600 p-1 transition-colors ml-2"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2 pt-1">
            <input
              type="text"
              placeholder="Tên thiết bị HS (VD: Điện thoại thông minh)..."
              value={newStudentItem.name}
              onChange={(e) => setNewStudentItem({ ...newStudentItem, name: e.target.value })}
              className="text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg flex-1 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <input
              type="text"
              placeholder="Số lượng (VD: 1 máy/4 HS)"
              value={newStudentItem.quantity}
              onChange={(e) => setNewStudentItem({ ...newStudentItem, quantity: e.target.value })}
              className="text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg w-28 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button
              type="button"
              onClick={addStudentEquipment}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg transition-colors shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Digital Tools & Platforms */}
      <div className="pt-2 border-t border-slate-100 space-y-2.5">
        <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
          <Wrench className="w-4 h-4 text-purple-600" />
          Phần mềm / nền tảng số dự kiến khai thác
        </h4>
        
        <div className="flex flex-wrap gap-1.5">
          {POPULAR_DIGITAL_TOOLS.map((tool) => {
            const isSelected = digitalTools.includes(tool);
            return (
              <button
                key={tool}
                type="button"
                onClick={() => toggleTool(tool)}
                className={`px-2.5 py-1 text-xs rounded-lg border transition-all ${
                  isSelected
                    ? 'bg-purple-50 text-purple-700 border-purple-300 font-semibold'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {tool}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 pt-1">
          <input
            type="text"
            value={customToolInput}
            onChange={(e) => setCustomToolInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addCustomTool();
              }
            }}
            placeholder="Thêm phần mềm khác (VD: ChemCollective, CapCut, GeoGebra 3D, Google Earth...)"
            className="text-xs px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg flex-1 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <button
            type="button"
            onClick={addCustomTool}
            className="px-3 py-1.5 text-xs font-medium bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors"
          >
            Thêm
          </button>
        </div>
      </div>
    </div>
  );
};
