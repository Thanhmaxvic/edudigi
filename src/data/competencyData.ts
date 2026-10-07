export interface DigitalCompetencyIndicator {
  id: string;
  domainNumber: number;
  domain: string;
  subCompetency: string;
  code: string;
  title: string;
  description: string;
  applicableGrades: 'Tất cả' | 'Tiểu học' | 'THCS' | 'THPT' | 'THCS & THPT';
  suggestedActivities: string;
  suggestedTools: string;
  isCustom?: boolean;
}

export interface CustomCompetencyItem {
  id: string;
  code: string;
  domainNumber: number;
  domain: string;
  title: string;
  description: string;
  applicableGrades: 'Tất cả' | 'Tiểu học' | 'THCS' | 'THPT' | 'THCS & THPT';
  suggestedActivities?: string;
  suggestedTools?: string;
  isCustom: true;
}

export interface SubjectOption {
  id: string;
  name: string;
  level: 'tiểu học' | 'thcs' | 'thpt' | 'all';
}

export const DOMAIN_METADATA = [
  {
    num: 1,
    name: 'Miền 1: Vận hành thiết bị & phần mềm',
    shortName: 'Vận hành thiết bị & phần mềm',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
    headerBg: 'bg-blue-50/70 border-blue-100',
    accentColor: '#2563eb',
    description: 'Khả năng sử dụng, kết nối các thiết bị phần cứng, hệ điều hành và vận hành ứng dụng học tập số.',
  },
  {
    num: 2,
    name: 'Miền 2: Khai thác thông tin & dữ liệu số',
    shortName: 'Thông tin & dữ liệu số',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    headerBg: 'bg-emerald-50/70 border-emerald-100',
    accentColor: '#059669',
    description: 'Tìm kiếm có định hướng, đánh giá độ tin cậy của thông tin số, lưu trữ và trực quan hóa dữ liệu.',
  },
  {
    num: 3,
    name: 'Miền 3: Giao tiếp & hợp tác môi trường số',
    shortName: 'Giao tiếp & hợp tác số',
    badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    headerBg: 'bg-indigo-50/70 border-indigo-100',
    accentColor: '#4f46e5',
    description: 'Tương tác có văn hóa mạng, chia sẻ dữ liệu, làm việc nhóm trực tuyến và thuyết trình bằng phương tiện số.',
  },
  {
    num: 4,
    name: 'Miền 4: Sáng tạo nội dung số',
    shortName: 'Sáng tạo nội dung số',
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
    headerBg: 'bg-purple-50/70 border-purple-100',
    accentColor: '#7c3aed',
    description: 'Thiết kế sản phẩm học tập đa phương tiện (infographic, slide, mindmap, video ngắn) và tôn trọng bản quyền số.',
  },
  {
    num: 5,
    name: 'Miền 5: An toàn & Đạo đức số',
    shortName: 'An toàn & đạo đức số',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
    headerBg: 'bg-amber-50/70 border-amber-100',
    accentColor: '#d97706',
    description: 'Bảo vệ thiết bị, dữ liệu cá nhân, nhận diện lừa đảo không gian mạng và bảo vệ sức khỏe khi học trực tuyến.',
  },
  {
    num: 6,
    name: 'Miền 6: Giải quyết vấn đề bằng công nghệ số',
    shortName: 'Giải quyết vấn đề bằng CNTT',
    badgeColor: 'bg-rose-100 text-rose-800 border-rose-200',
    headerBg: 'bg-rose-50/70 border-rose-100',
    accentColor: '#e11d48',
    description: 'Khai thác phần mềm mô phỏng, thí nghiệm ảo, ứng dụng AI có trách nhiệm và xử lý lỗi kỹ thuật thông thường.',
  },
];

export const DIGITAL_COMPETENCIES: DigitalCompetencyIndicator[] = [
  // ===================== MIỀN 1 =====================
  {
    id: 'nls_1_1',
    domainNumber: 1,
    domain: 'Miền 1: Vận hành thiết bị & phần mềm',
    subCompetency: '1.1 Vận hành thiết bị số trong học tập',
    code: 'NLS.1.1',
    title: 'Khởi động, kết nối và sử dụng thiết bị số cơ bản',
    description: 'Học sinh biết bật/tắt thiết bị, kết nối Wifi lớp học, quét mã QR nhận nhiệm vụ và thao tác tương tác cơ bản (chuột/bàn phím/cảm ứng).',
    applicableGrades: 'Tất cả',
    suggestedActivities: 'Học sinh dùng smartphone/máy tính bảng quét mã QR trên màn hình Smart TV để nhận phiếu học tập số đầu giờ.',
    suggestedTools: 'Điện thoại, Tablet, Smart TV, Trình quét mã QR',
  },
  {
    id: 'nls_1_2',
    domainNumber: 1,
    domain: 'Miền 1: Vận hành thiết bị & phần mềm',
    subCompetency: '1.2 Vận hành phần mềm & ứng dụng học tập',
    code: 'NLS.1.2',
    title: 'Sử dụng phần mềm học tập & nền tảng số được chỉ định',
    description: 'Học sinh mở, điều hướng và thực hiện thao tác trên phần mềm kiểm tra đánh giá, ứng dụng học tập hoặc trình duyệt web theo yêu cầu bài học.',
    applicableGrades: 'Tất cả',
    suggestedActivities: 'Đăng nhập phòng thi Quizizz hoặc truy cập đường link Padlet nhóm để tham gia trả lời câu hỏi.',
    suggestedTools: 'Quizizz, Padlet, Google Chrome, Kahoot!',
  },
  {
    id: 'nls_1_3',
    domainNumber: 1,
    domain: 'Miền 1: Vận hành thiết bị & phần mềm',
    subCompetency: '1.3 Quản lý tệp tin và dữ liệu học tập',
    code: 'NLS.1.3',
    title: 'Lưu trữ, đặt tên tệp và sắp xếp tài liệu học tập số',
    description: 'Học sinh biết tải về, đặt tên tệp đúng cấu trúc (VD: Nhom1_Bai12_Sanpham), lưu vào đúng thư mục nhóm hoặc ổ đĩa đám mây.',
    applicableGrades: 'THCS & THPT',
    suggestedActivities: 'Tải phiếu bài tập về máy, hoàn thành nội dung và lưu tệp PDF vào thư mục Google Drive của lớp.',
    suggestedTools: 'Google Drive, Quản lý tệp Windows/Android, OneDrive',
  },
  {
    id: 'nls_1_4',
    domainNumber: 1,
    domain: 'Miền 1: Vận hành thiết bị & phần mềm',
    subCompetency: '1.4 Tùy biến môi trường thao tác số',
    code: 'NLS.1.4',
    title: 'Điều chỉnh cấu hình hiển thị và âm thanh phù hợp học tập',
    description: 'Biết phóng to thu nhỏ tài liệu số, chỉnh âm lượng tai nghe, chỉnh độ sáng và chế độ bảo vệ mắt khi làm việc trên màn hình.',
    applicableGrades: 'Tất cả',
    suggestedActivities: 'Phóng to hình vẽ sơ đồ kỹ thuật trong tài liệu PDF điện tử để quan sát chi tiết cấu tạo.',
    suggestedTools: 'Trình xem PDF, Cài đặt hệ thống',
  },

  // ===================== MIỀN 2 =====================
  {
    id: 'nls_2_1',
    domainNumber: 2,
    domain: 'Miền 2: Khai thác thông tin & dữ liệu số',
    subCompetency: '2.1 Tìm kiếm thông tin số có định hướng',
    code: 'NLS.2.1',
    title: 'Sử dụng từ khóa tìm kiếm tài liệu bài học trên Internet',
    description: 'Học sinh biết xác định từ khóa trọng tâm, sử dụng công cụ tìm kiếm để thu thập văn bản, tranh ảnh, số liệu phục vụ bài học.',
    applicableGrades: 'Tất cả',
    suggestedActivities: 'Tra cứu thông tin về ứng dụng của kim loại/sự kiện lịch sử/khí hậu địa phương qua công cụ tìm kiếm Google.',
    suggestedTools: 'Google Search, Wikipedia Giáo dục, Thư viện số',
  },
  {
    id: 'nls_2_2',
    domainNumber: 2,
    domain: 'Miền 2: Khai thác thông tin & dữ liệu số',
    subCompetency: '2.2 Đánh giá và chọn lọc dữ liệu số',
    code: 'NLS.2.2',
    title: 'Đánh giá độ tin cậy và đối chiếu thông tin với SGK',
    description: 'Biết phân biệt trang web chính thống (cổng bộ ngành, viện nghiên cứu, báo chính luận) với thông tin chưa kiểm chứng; đối chiếu số liệu với SGK.',
    applicableGrades: 'THCS & THPT',
    suggestedActivities: 'Đối chiếu số liệu dân số, diện tích vừa tra cứu trên mạng với bảng số liệu trong Sách giáo khoa Địa lí.',
    suggestedTools: 'Tổng cục Thống kê (gso.gov.vn), Cổng thông tin Bộ GD&ĐT',
  },
  {
    id: 'nls_2_3',
    domainNumber: 2,
    domain: 'Miền 2: Khai thác thông tin & dữ liệu số',
    subCompetency: '2.3 Tổ chức và xử lý dữ liệu số',
    code: 'NLS.2.3',
    title: 'Thu thập, lập bảng thống kê số liệu trên máy tính',
    description: 'Học sinh nhập dữ liệu thực nghiệm hoặc kết quả khảo sát vào bảng biểu số, tính toán tổng hợp các đại lượng cơ bản.',
    applicableGrades: 'THCS & THPT',
    suggestedActivities: 'Nhập bảng số liệu đo nhiệt độ sôi hoặc khảo sát thói quen đọc sách vào Google Sheets/Excel và tính giá trị trung bình.',
    suggestedTools: 'Google Sheets, Microsoft Excel',
  },
  {
    id: 'nls_2_4',
    domainNumber: 2,
    domain: 'Miền 2: Khai thác thông tin & dữ liệu số',
    subCompetency: '2.4 Trực quan hóa dữ liệu và thông tin số',
    code: 'NLS.2.4',
    title: 'Chuyển đổi số liệu thành biểu đồ số trực quan',
    description: 'Vẽ biểu đồ hình cột, đường hoặc tròn từ bảng dữ liệu số thu thập được, rút ra nhận xét quy luật bài học từ biểu đồ.',
    applicableGrades: 'THCS & THPT',
    suggestedActivities: 'Vẽ biểu đồ tăng trưởng cơ cấu kinh tế hoặc đồ thị vận tốc - thời gian từ bảng số liệu thực nghiệm.',
    suggestedTools: 'Google Sheets Charts, GeoGebra, Meta-Chart',
  },

  // ===================== MIỀN 3 =====================
  {
    id: 'nls_3_1',
    domainNumber: 3,
    domain: 'Miền 3: Giao tiếp & hợp tác môi trường số',
    subCompetency: '3.1 Tương tác trên nền tảng học tập trực tuyến',
    code: 'NLS.3.1',
    title: 'Gửi phản hồi, tương tác thảo luận văn minh trên nền tảng số',
    description: 'Học sinh đăng ý kiến, thả tim, bình luận nhận xét bài của bạn trên bảng trực tuyến với thái độ tôn trọng, lịch sự.',
    applicableGrades: 'Tất cả',
    suggestedActivities: 'Đăng giấy ghi chú câu trả lời lên tường Padlet lớp học; bình chọn câu trả lời hay nhất của các nhóm bạn.',
    suggestedTools: 'Padlet, Mentimeter, Linoit',
  },
  {
    id: 'nls_3_2',
    domainNumber: 3,
    domain: 'Miền 3: Giao tiếp & hợp tác môi trường số',
    subCompetency: '3.2 Chia sẻ dữ liệu và học liệu số',
    code: 'NLS.3.2',
    title: 'Chia sẻ liên kết và nộp sản phẩm học tập qua mạng',
    description: 'Biết copy liên kết xem sản phẩm, phân quyền chia sẻ (xem/nhận xét/chỉnh sửa), nộp bài đúng hạn lên hệ thống quản lý học tập.',
    applicableGrades: 'Tất cả',
    suggestedActivities: 'Gửi link sản phẩm bài thuyết trình Canva vào nhóm Zalo lớp hoặc nộp tệp lên Google Classroom.',
    suggestedTools: 'Google Drive Link, Google Classroom, Zalo nhóm học tập',
  },
  {
    id: 'nls_3_3',
    domainNumber: 3,
    domain: 'Miền 3: Giao tiếp & hợp tác môi trường số',
    subCompetency: '3.3 Cộng tác làm việc nhóm trên tài liệu số',
    code: 'NLS.3.3',
    title: 'Cùng chỉnh sửa đồng thời trên tài liệu dùng chung trực tuyến',
    description: 'Các thành viên trong nhóm cùng mở một văn bản/trang trình bày, mỗi người phụ trách một phần nội dung và theo dõi đóng góp.',
    applicableGrades: 'THCS & THPT',
    suggestedActivities: 'Nhóm 4 học sinh cùng soạn thảo 1 bài báo cáo trên Google Docs/Google Slides trong thời gian 10 phút.',
    suggestedTools: 'Google Docs, Google Slides, Canva for Education',
  },
  {
    id: 'nls_3_4',
    domainNumber: 3,
    domain: 'Miền 3: Giao tiếp & hợp tác môi trường số',
    subCompetency: '3.4 Thuyết trình bằng thiết bị & phương tiện số',
    code: 'NLS.3.4',
    title: 'Chiếu không dây và thuyết minh sản phẩm học tập trên Smart TV',
    description: 'Đại diện nhóm kết nối chia sẻ màn hình (Miracast/AirPlay) từ smartphone/laptop lên tivi lớp học để thuyết trình.',
    applicableGrades: 'Tất cả',
    suggestedActivities: 'Học sinh kết nối điện thoại nhóm chiếu slide Canva lên Smart TV lớp học và tự tin thuyết trình kết quả thảo luận.',
    suggestedTools: 'Smart TV, Miracast, AirPlay, HDMI, Clicker trình chiếu',
  },
  {
    id: 'nls_3_5',
    domainNumber: 3,
    domain: 'Miền 3: Giao tiếp & hợp tác môi trường số',
    subCompetency: '3.5 Văn hóa ứng xử không gian mạng (Netiquette)',
    code: 'NLS.3.5',
    title: 'Tuân thủ quy tắc ứng xử chuẩn mực trong giao tiếp số',
    description: 'Không dùng từ ngữ phản cảm, không spam bình luận, tôn trọng sự đa dạng ý kiến và bảo vệ danh dự bạn bè trên mạng.',
    applicableGrades: 'Tất cả',
    suggestedActivities: 'Viết nhận xét đóng góp tích cực cho bài làm của nhóm bạn trên phần bình luận của Padlet.',
    suggestedTools: 'Bộ quy tắc ứng xử số lớp học',
  },

  // ===================== MIỀN 4 =====================
  {
    id: 'nls_4_1',
    domainNumber: 4,
    domain: 'Miền 4: Sáng tạo nội dung số',
    subCompetency: '4.1 Thiết kế ấn phẩm số học tập đa phương tiện',
    code: 'NLS.4.1',
    title: 'Thiết kế Infographic, sơ đồ tư duy số hoặc bài trình chiếu',
    description: 'Kết hợp hài hòa văn bản, hình ảnh, màu sắc và icon để tóm tắt bài học sinh động bằng công cụ đồ họa số trực tuyến.',
    applicableGrades: 'Tất cả',
    suggestedActivities: 'Thiết kế 1 Infographic trên Canva tóm tắt chu trình nước hoặc vòng đời phát triển của sinh vật.',
    suggestedTools: 'Canva, GitMind, Coggle, PowerPoint Online',
  },
  {
    id: 'nls_4_2',
    domainNumber: 4,
    domain: 'Miền 4: Sáng tạo nội dung số',
    subCompetency: '4.2 Biên tập video và âm thanh học tập',
    code: 'NLS.4.2',
    title: 'Quay video thí nghiệm/thuyết trình và cắt ghép cơ bản',
    description: 'Học sinh dùng điện thoại quay lại thao tác thực hành, thí nghiệm hoặc diễn xuất, cắt ghép video ngắn 1-2 phút báo cáo.',
    applicableGrades: 'THCS & THPT',
    suggestedActivities: 'Quay video thực hành pha chế dung dịch hoặc đọc diễn cảm bài thơ, chèn phụ đề tóm tắt bằng CapCut.',
    suggestedTools: 'CapCut, Máy quay điện thoại, KineMaster',
  },
  {
    id: 'nls_4_3',
    domainNumber: 4,
    domain: 'Miền 4: Sáng tạo nội dung số',
    subCompetency: '4.3 Tôn trọng bản quyền và sở hữu trí tuệ số',
    code: 'NLS.4.3',
    title: 'Ghi nguồn trích dẫn hình ảnh, tư liệu số theo quy chuẩn',
    description: 'Biết ghi chú nguồn gốc tác giả, trang web đối với hình ảnh/video lấy từ Internet; không sao chép nguyên văn vi phạm đạo văn số.',
    applicableGrades: 'THCS & THPT',
    suggestedActivities: 'Thêm dòng chú thích nguồn tài liệu (VD: Nguồn ảnh: NASA / Cổng TTĐT Chính phủ) dưới chân mỗi slide.',
    suggestedTools: 'Creative Commons, Pixabay, Unsplash (kho ảnh miễn phí)',
  },

  // ===================== MIỀN 5 =====================
  {
    id: 'nls_5_1',
    domainNumber: 5,
    domain: 'Miền 5: An toàn & Đạo đức số',
    subCompetency: '5.1 Bảo vệ thiết bị & thông tin cá nhân',
    code: 'NLS.5.1',
    title: 'Bảo mật tài khoản học tập và đăng xuất thiết bị dùng chung',
    description: 'Ý thức không chia sẻ mật khẩu tài khoản học tập, nhớ đăng xuất khi dùng xong máy tính phòng thực hành của trường.',
    applicableGrades: 'Tất cả',
    suggestedActivities: 'Thực hiện thao tác đăng xuất tài khoản Google/Gmail trên máy tính phòng tin học sau tiết thực hành.',
    suggestedTools: 'Trình quản lý mật khẩu, Chế độ ẩn danh trình duyệt',
  },
  {
    id: 'nls_5_2',
    domainNumber: 5,
    domain: 'Miền 5: An toàn & Đạo đức số',
    subCompetency: '5.2 Nhận diện rủi ro và tin giả trên không gian mạng',
    code: 'NLS.5.2',
    title: 'Nhận biết thông tin sai lệch, link độc hại và lừa đảo số',
    description: 'Không ấn vào đường link lạ xuất hiện trong quá trình tra cứu, nhận biết các dấu hiệu giật tít, tin giả lan truyền.',
    applicableGrades: 'THCS & THPT',
    suggestedActivities: 'Phân tích một bài báo tin tức giả trên mạng xã hội về hiện tượng khoa học và chỉ ra điểm mâu thuẫn.',
    suggestedTools: 'Cẩm nang An toàn mạng học sinh',
  },
  {
    id: 'nls_5_3',
    domainNumber: 5,
    domain: 'Miền 5: An toàn & Đạo đức số',
    subCompetency: '5.3 Bảo vệ sức khỏe thể chất khi sử dụng thiết bị số',
    code: 'NLS.5.3',
    title: 'Thực hiện tư thế ngồi chuẩn và quy tắc bảo vệ thị lực',
    description: 'Giữ khoảng cách mắt hợp lý với màn hình điện thoại/máy tính (40-50cm), áp dụng quy tắc nghỉ ngơi 20-20-20 tránh mỏi mắt.',
    applicableGrades: 'Tất cả',
    suggestedActivities: 'Thực hiện bài tập vận động nhẹ cho mắt và cổ tay sau 20 phút làm việc liên tục trên thiết bị số.',
    suggestedTools: 'Đồng hồ hẹn giờ Pomodoro / Lời nhắc nghỉ ngơi',
  },

  // ===================== MIỀN 6 =====================
  {
    id: 'nls_6_1',
    domainNumber: 6,
    domain: 'Miền 6: Giải quyết vấn đề bằng công nghệ số',
    subCompetency: '6.1 Khai thác mô phỏng số và thí nghiệm ảo',
    code: 'NLS.6.1',
    title: 'Tương tác trên mô phỏng 2D/3D & phần mềm chuyên ngành',
    description: 'Học sinh thay đổi tham số trên thí nghiệm ảo để kiểm chứng định luật, quan sát hiện tượng vi mô hoặc mô hình không gian.',
    applicableGrades: 'THCS & THPT',
    suggestedActivities: 'Kéo thả thanh trượt hiệu điện thế và điện trở trên thí nghiệm ảo PhET để quan sát sự đổi dòng điện I (Định luật Ohm).',
    suggestedTools: 'PhET Interactive Simulations, GeoGebra, Stellarium, Google Earth',
  },
  {
    id: 'nls_6_2',
    domainNumber: 6,
    domain: 'Miền 6: Giải quyết vấn đề bằng công nghệ số',
    subCompetency: '6.2 Xử lý sự cố kỹ thuật thông thường',
    code: 'NLS.6.2',
    title: 'Tự khắc phục lỗi kết nối, âm thanh và hiển thị cơ bản',
    description: 'Biết kiểm tra kết nối mạng Wifi, cắm lại jack âm thanh, bật loa, tải lại trang web (F5) khi phần mềm bị đơ/lag.',
    applicableGrades: 'Tất cả',
    suggestedActivities: 'Học sinh tự bật lại kết nối Wifi dự phòng của nhóm khi thiết bị báo mất mạng trong lúc thi đấu Quizizz.',
    suggestedTools: 'Kiểm tra mạng Internet, Refresh F5',
  },
  {
    id: 'nls_6_3',
    domainNumber: 6,
    domain: 'Miền 6: Giải quyết vấn đề bằng công nghệ số',
    subCompetency: '6.3 Khai thác trí tuệ nhân tạo (AI) có trách nhiệm',
    code: 'NLS.6.3',
    title: 'Sử dụng công cụ AI để tìm ý tưởng và đối chiếu kiểm chứng',
    description: 'Đặt câu lệnh (prompt) rõ ràng để AI gợi ý góc nhìn, sau đó tự đọc hiểu, kiểm chứng tính chính xác chứ không sao chép mù quáng.',
    applicableGrades: 'THCS & THPT',
    suggestedActivities: 'Hỏi trợ lý AI về 3 ứng dụng thực tế của quang hợp trong nông nghiệp công nghệ cao, sau đó phản biện bằng kiến thức SGK.',
    suggestedTools: 'Công cụ AI hỗ trợ học tập, Google Lens',
  },
];

export const SUBJECTS: SubjectOption[] = [
  { id: 'toan', name: 'Toán học', level: 'all' },
  { id: 'ngu_van', name: 'Ngữ văn / Tiếng Việt', level: 'all' },
  { id: 'tieng_anh', name: 'Tiếng Anh', level: 'all' },
  { id: 'tin_hoc', name: 'Tin học', level: 'all' },
  { id: 'cong_nghe', name: 'Công nghệ', level: 'all' },
  { id: 'khoa_hoc_tu_nhien', name: 'Khoa học tự nhiên', level: 'thcs' },
  { id: 'vat_li', name: 'Vật lí', level: 'thpt' },
  { id: 'hoa_hoc', name: 'Hóa học', level: 'thpt' },
  { id: 'sinh_hoc', name: 'Sinh học', level: 'thpt' },
  { id: 'lich_su_dia_ly', name: 'Lịch sử và Địa lí', level: 'all' },
  { id: 'lich_su', name: 'Lịch sử', level: 'thpt' },
  { id: 'dia_ly', name: 'Địa lí', level: 'thpt' },
  { id: 'gdcd_gdktpl', name: 'Giáo dục công dân / GDKT&PL', level: 'all' },
  { id: 'tu_nhien_xa_hoi', name: 'Tự nhiên và Xã hội', level: 'tiểu học' },
  { id: 'khoa_hoc_th', name: 'Khoa học (Tiểu học)', level: 'tiểu học' },
  { id: 'am_nhac', name: 'Âm nhạc', level: 'all' },
  { id: 'my_thuat', name: 'Mĩ thuật', level: 'all' },
  { id: 'hdtn_hn', name: 'Hoạt động trải nghiệm / Hướng nghiệp', level: 'all' },
  { id: 'gdtc', name: 'Giáo dục thể chất', level: 'all' },
];

export const GRADES = [
  'Lớp 1', 'Lớp 2', 'Lớp 3', 'Lớp 4', 'Lớp 5',
  'Lớp 6', 'Lớp 7', 'Lớp 8', 'Lớp 9',
  'Lớp 10', 'Lớp 11', 'Lớp 12',
];

export const CURRICULA = [
  'Kết nối tri thức với cuộc sống (NXB GDVN)',
  'Cánh Diều (NXB ĐHSP - ĐHSP TP.HCM)',
  'Chân trời sáng tạo (NXB GDVN)',
  'Chương trình GDPT 2018 (Chung)',
];

export const DEFAULT_TEACHER_EQUIPMENT = [
  { name: 'Laptop giáo viên (kết nối Internet)', quantity: '1 chiếc', note: 'Cài đặt sẵn bài giảng điện tử và link học liệu' },
  { name: 'Tivi thông minh (Smart TV 65 inch) / Máy chiếu', quantity: '1 bộ', note: 'Hỗ trợ kết nối không dây Miracast/Airplay' },
  { name: 'Kết nối Internet cáp quang / Wifi lớp học', quantity: '1 đường truyền', note: 'Tốc độ cao phục vụ truy cập đồng thời' },
  { name: 'Tài khoản giáo viên trên Quizizz / Padlet', quantity: '1 tài khoản', note: 'Đã tạo sẵn mã QR phòng học' },
];

export const DEFAULT_STUDENT_EQUIPMENT = [
  { name: 'Điện thoại thông minh / Máy tính bảng (theo nhóm)', quantity: '1 máy/nhóm (4-6 HS)', note: 'Có kết nối mạng Wifi và camera quét QR' },
  { name: 'Sách giáo khoa, vở ghi, đồ dùng học tập', quantity: '1 bộ/học sinh', note: 'Nội dung bài học đối chiếu' },
  { name: 'Phiếu học tập (bản in kết hợp bản số)', quantity: '1 phiếu/nhóm', note: 'Có in sẵn mã QR liên kết tài nguyên' },
];

export const POPULAR_DIGITAL_TOOLS = [
  'Padlet (Bảng cộng tác số)',
  'Quizizz (Trắc nghiệm số tương tác)',
  'Kahoot! (Khởi động & ôn tập gamified)',
  'Canva for Education (Thiết kế infographic & slide)',
  'Google Drive / Docs / Slides (Cộng tác nhóm trực tuyến)',
  'GeoGebra (Hình học động & đồ thị toán học)',
  'PhET Interactive Simulations (Thí nghiệm ảo KHTN)',
  'Mentimeter (Khảo sát ý kiến tức thời)',
  'Google Forms (Kiểm tra đánh giá tự động)',
];

export const CUSTOM_COMPETENCY_SUGGESTIONS = [
  {
    title: 'Sử dụng phần mềm GeoGebra vẽ đồ thị và dựng hình',
    domainNumber: 6,
    domain: 'Miền 6: Giải quyết vấn đề bằng công nghệ số',
    description: 'Học sinh thao tác trên phần mềm GeoGebra để vẽ đồ thị hàm số, thay đổi hệ số trượt và quan sát sự biến thiên của đồ thị.',
    suggestedTools: 'GeoGebra Math Apps',
  },
  {
    title: 'Sử dụng bảng tính Google Sheets xử lý số liệu thực nghiệm',
    domainNumber: 2,
    domain: 'Miền 2: Khai thác thông tin & dữ liệu số',
    description: 'Học sinh nhập bảng số liệu quan sát thí nghiệm, sử dụng các hàm cơ bản (AVERAGE, SUM) và vẽ biểu đồ đường biểu diễn sự thay đổi.',
    suggestedTools: 'Google Sheets / Excel',
  },
  {
    title: 'Thiết kế sản phẩm số tổng kết bài học trên Canva',
    domainNumber: 4,
    domain: 'Miền 4: Sáng tạo nội dung số',
    description: 'Nhóm học sinh lựa chọn mẫu infographic hoặc slide trên Canva, biên tập nội dung kiến thức cốt lõi và xuất file ảnh nộp bài.',
    suggestedTools: 'Canva for Education',
  },
  {
    title: 'Đo đạc và xác định vị trí thực tế trên Google Earth / Maps',
    domainNumber: 6,
    domain: 'Miền 6: Giải quyết vấn đề bằng công nghệ số',
    description: 'Học sinh sử dụng công cụ thước đo trên Google Earth để đo khoảng cách thực tế giữa các địa điểm và xác định tọa độ địa lí.',
    suggestedTools: 'Google Earth, Google Maps',
  },
  {
    title: 'Tự đánh giá phát âm và ghi âm câu nói bằng công cụ số',
    domainNumber: 1,
    domain: 'Miền 1: Vận hành thiết bị & phần mềm',
    description: 'Học sinh sử dụng tính năng nhận dạng giọng nói trên điện thoại/máy tính để luyện tập phát âm từ vựng và tự kiểm tra độ chuẩn xác.',
    suggestedTools: 'Google Translate Audio, Elsa Speak, Voice Recorder',
  },
];
