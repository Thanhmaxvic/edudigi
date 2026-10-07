export interface Competency3456Item {
  code: string; // e.g. "1.1.CB1a", "1.1.TC1a"
  domainNum: number; // 1-6
  domainName: string; // 1. Khai thác dữ liệu và thông tin
  subCode: string; // 1.1, 1.2, etc.
  subName: string; // Duyệt, tìm kiếm và lọc dữ liệu, thông tin và nội dung số
  content: string; // Nội dung năng lực thành phần
  levelCode: string; // L1-L2-L3 (CB1), L4-L5 (CB2), L6-L7 (TC1), L8-L9 (TC2), L10-L11-L12 (NC1)
  gradeLevel: 'Tiểu học (L1-3)' | 'Tiểu học (L4-5)' | 'THCS (L6-7)' | 'THCS (L8-9)' | 'THPT (L10-12)';
  teachingTask: string; // Nhiệm vụ DH
  yccd: string; // Yêu cầu cần đạt
  fullExplanation: string; // Nhiệm vụ DH + YCCD
  isCustom?: boolean;
}

export const DOMAINS_3456 = [
  { num: 1, name: '1. Khai thác dữ liệu và thông tin', short: 'Khai thác dữ liệu & thông tin' },
  { num: 2, name: '2. Giao tiếp và Hợp tác', short: 'Giao tiếp & Hợp tác' },
  { num: 3, name: '3. Sáng tạo nội dung số', short: 'Sáng tạo nội dung số' },
  { num: 4, name: '4. An toàn', short: 'An toàn số' },
  { num: 5, name: '5. Giải quyết vấn đề', short: 'Giải quyết vấn đề' },
  { num: 6, name: '6. Ứng dụng trí tuệ nhân tạo', short: 'Ứng dụng Trí tuệ nhân tạo (AI)' },
];

export const SUB_COMPETENCIES_3456 = [
  { subCode: '1.1', domainNum: 1, name: '1.1. Duyệt, tìm kiếm và lọc dữ liệu, thông tin và nội dung số', content: 'Xác định được nhu cầu thông tin; tìm kiếm được dữ liệu, thông tin và nội dung trong môi trường số; truy cập chúng và khai thác được kết quả tìm kiếm. Tạo và cập nhật được chiến lược tìm kiếm.' },
  { subCode: '1.2', domainNum: 1, name: '1.2. Đánh giá dữ liệu, thông tin và nội dung số', content: 'Phân tích, so sánh và đánh giá được độ tin cậy và tính xác thực của nguồn dữ liệu, thông tin và nội dung số. Phân tích, giải thích và đánh giá được dữ liệu, thông tin và nội dung số.' },
  { subCode: '1.3', domainNum: 1, name: '1.3. Quản lý dữ liệu, thông tin và nội dung số', content: 'Tổ chức, lưu trữ và truy xuất được dữ liệu, thông tin và nội dung trong môi trường số. Tổ chức và sắp xếp được chúng trong một môi trường có cấu trúc.' },
  { subCode: '2.1', domainNum: 2, name: '2.1. Tương tác thông qua công nghệ số', content: 'Tương tác thông qua các công nghệ số khác nhau và nhận biết được phương tiện giao tiếp số nào phù hợp cho một bối cảnh nhất định.' },
  { subCode: '2.2', domainNum: 2, name: '2.2. Chia sẻ thông tin và nội dung thông qua công nghệ số', content: 'Chia sẻ dữ liệu, thông tin và nội dung số với người khác thông qua các công nghệ số phù hợp. Đóng vai trò là người trung gian, hiểu biết và thực hành trích dẫn và ghi chú nguồn.' },
  { subCode: '2.3', domainNum: 2, name: '2.3. Sử dụng công nghệ số để thực hiện trách nhiệm công dân', content: 'Tham gia vào xã hội thông qua việc sử dụng các dịch vụ số công cộng và tư nhân. Tìm kiếm được cơ hội để trao quyền và thu hút công dân thông qua các công nghệ số phù hợp.' },
  { subCode: '2.4', domainNum: 2, name: '2.4. Hợp tác thông qua công nghệ số', content: 'Sử dụng được các công cụ và công nghệ số cho các quá trình hợp tác cũng như để cùng xây dựng và đồng sáng tạo dữ liệu, tài nguyên và kiến thức.' },
  { subCode: '2.5', domainNum: 2, name: '2.5. Quy tắc ứng xử trên mạng', content: 'Nhận thức được các chuẩn mực hành vi và kiến thức khi sử dụng công nghệ số và tương tác trong môi trường số. Điều chỉnh các chiến lược giao tiếp phù hợp với đối tượng cụ thể và nhận thức đa dạng về văn hóa và thế hệ.' },
  { subCode: '2.6', domainNum: 2, name: '2.6. Quản lý danh tính số', content: 'Tạo và quản lý được một hoặc nhiều danh tính số để bảo vệ danh tiếng của bản thân, làm việc với dữ liệu mà một người tạo ra bằng nhiều công cụ, môi trường và dịch vụ số.' },
  { subCode: '3.1', domainNum: 3, name: '3.1. Phát triển nội dung số', content: 'Tạo và chỉnh sửa được nội dung số ở các định dạng khác nhau, nhằm thể hiện bản thân thông qua các phương tiện số.' },
  { subCode: '3.2', domainNum: 3, name: '3.2. Tích hợp và tạo lập lại nội dung số', content: 'Sửa đổi, tinh chỉnh và tích hợp được thông tin và nội dung mới vào khối kiến thức và tài nguyên hiện có để tạo ra nội dung và kiến thức mới, độc đáo và phù hợp.' },
  { subCode: '3.3', domainNum: 3, name: '3.3. Thực thi bản quyền và giấy phép', content: 'Hiểu được cách áp dụng bản quyền và giấy phép cho thông tin và nội dung số.' },
  { subCode: '3.4', domainNum: 3, name: '3.4. Lập trình', content: 'Lập được kế hoạch và phát triển được một chuỗi các câu lệnh dễ hiểu cho một hệ thống máy tính để giải quyết một vấn đề nhất định hoặc thực hiện một nhiệm vụ cụ thể.' },
  { subCode: '4.1', domainNum: 4, name: '4.1. Bảo vệ thiết bị', content: 'Bảo vệ được thiết bị và nội dung số; hiểu được rõ rủi ro và mối đe dọa trong môi trường số; nắm được các biện pháp an toàn và bảo mật; quan tâm đến mức độ tin cậy và quyền riêng tư.' },
  { subCode: '4.2', domainNum: 4, name: '4.2. Bảo vệ dữ liệu cá nhân và quyền riêng tư', content: 'Bảo vệ được dữ liệu cá nhân và quyền riêng tư trong môi trường số. Hiểu được cách sử dụng và chia sẻ thông tin định danh cá nhân một cách an toàn, có khả năng bảo vệ bản thân và người khác. Hiểu chính sách quyền riêng tư.' },
  { subCode: '4.3', domainNum: 4, name: '4.3. Bảo vệ sức khỏe và an sinh số', content: 'Tránh được rủi ro và đe dọa đến sức khỏe thể chất và tinh thần khi sử dụng công nghệ số. Bảo vệ được bản thân và người khác khỏi nguy cơ trong môi trường số (ví dụ: bắt nạt trên mạng).' },
  { subCode: '4.4', domainNum: 4, name: '4.4. Bảo vệ môi trường', content: 'Nhận thức được tác động của công nghệ số và việc sử dụng công nghệ số đối với môi trường.' },
  { subCode: '5.1', domainNum: 5, name: '5.1. Giải quyết các vấn đề kỹ thuật', content: 'Xác định được các vấn đề kỹ thuật khi vận hành thiết bị, sử dụng môi trường số và giải quyết chúng (từ xử lý sự cố đến giải quyết các vấn đề phức tạp hơn).' },
  { subCode: '5.2', domainNum: 5, name: '5.2. Xác định nhu cầu và giải pháp công nghệ', content: 'Đánh giá được nhu cầu và xác định, đánh giá, lựa chọn, sử dụng các công cụ số cùng với các giải pháp công nghệ khả thi để giải quyết chúng. Điều chỉnh môi trường số theo nhu cầu cá nhân.' },
  { subCode: '5.3', domainNum: 5, name: '5.3. Sử dụng sáng tạo công nghệ số', content: 'Sử dụng các công cụ và công nghệ số để tạo ra kiến thức, đổi mới quy trình và sản phẩm. Gắn kết cá nhân và tập thể vào quá trình xử lý nhận thức để hiểu và giải quyết vấn đề.' },
  { subCode: '5.4', domainNum: 5, name: '5.4. Xác định các vấn đề cần cải thiện về NLS', content: 'Hiểu được NLS của chính mình cần được cải thiện hoặc cập nhật ở đâu. Có thể hỗ trợ người khác phát triển NLS của họ. Tìm kiếm cơ hội phát triển bản thân và cập nhật công nghệ số.' },
  { subCode: '6.1', domainNum: 6, name: '6.1. Hiểu biết về trí tuệ nhân tạo', content: 'Hiểu được cách AI ảnh hưởng đến cuộc sống hàng ngày và vai trò của AI trong các lĩnh vực khác nhau. Nắm vững nguyên tắc hoạt động, khả năng và hạn chế của AI.' },
  { subCode: '6.2', domainNum: 6, name: '6.2. Sử dụng trí tuệ nhân tạo', content: 'Sử dụng hiệu quả các hệ thống AI và hiểu rõ ứng dụng thực tế của chúng. Sử dụng AI để tạo nội dung, khám phá kiến thức và giải quyết các vấn đề trong công việc và cuộc sống.' },
  { subCode: '6.3', domainNum: 6, name: '6.3. Đánh giá trí tuệ nhân tạo', content: 'Đánh giá và lọc được thông tin từ các nguồn được tạo ra hoặc xử lý bằng AI, để hiểu rõ hơn về tính đáng tin cậy. Đánh giá AI trên các khía cạnh minh bạch, an toàn, đạo đức và tác động.' },
];
