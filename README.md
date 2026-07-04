# SmartDrive - Hệ Thống Xếp Lịch Học Lái Xe Tự Động

Ứng dụng web tự động xếp lịch học lái xe cho học viên dựa trên thời gian rảnh và công suất của giáo viên hướng dẫn.

## Tính Năng Chính
1. **Đăng ký lịch rảnh (Học viên)**: Trang đăng ký đẹp mắt, nhập thông tin liên hệ và tích chọn các ca rảnh từ Thứ Hai đến Chủ Nhật.
2. **Thuật toán tự động xếp lịch**: Sử dụng giải thuật Greedy thông minh, tự động xếp cặp học viên với giáo viên hướng dẫn tối ưu, không bị trùng lặp lịch dạy và phân bổ đều công suất.
3. **Bảng điều khiển Admin**:
   - Quản lý danh sách học viên đăng ký.
   - Quản lý thông tin và trạng thái hoạt động của giáo viên.
   - Xem lịch học tuần trực quan dưới dạng thời khóa biểu.
   - Nhấp xếp lịch tự động, chỉnh sửa lịch thủ công dễ dàng (thêm/xoá/thay đổi lịch trực tiếp).
   - Lưu lịch học cố định theo từng tuần.

## Công Nghệ Sử Dụng
- **Backend**: Python 3 (FastAPI, Uvicorn, SQLite).
- **Frontend**: HTML5, Vanilla CSS3 (Sử dụng thiết kế Glassmorphism hiện đại, Dark mode, Responsive) và JavaScript.

---

## Hướng Dẫn Cài Đặt & Chạy Ứng Dụng

### 1. Cài đặt thư viện yêu cầu
Mở terminal trong thư mục này và chạy lệnh:
```bash
pip install -r requirements.txt
```

### 2. Khởi tạo dữ liệu mẫu (Seeding)
Hệ thống đi kèm một mã nguồn khởi tạo để tạo sẵn 10 học viên mẫu rải rác ca rảnh cùng với 3 giáo viên hướng dẫn mặc định:
```bash
python seed_submissions.py
```

### 3. Chạy Server
Khởi chạy ứng dụng bằng cách chạy:
```bash
python app.py
```
Ứng dụng sẽ chạy tại địa chỉ: **[http://127.0.0.1:8000](http://127.0.0.1:8000)**

- **Trang học viên**: [http://127.0.0.1:8000/index.html](http://127.0.0.1:8000/index.html)
- **Trang Admin**: [http://127.0.0.1:8000/admin.html](http://127.0.0.1:8000/admin.html)

---

## Cấu Trúc Thư Mục Dự Án
- `app.py`: Server API FastAPI chính và điều hướng static files.
- `database.py`: Kết nối SQLite, định nghĩa các bảng cơ sở dữ liệu và dữ liệu mẫu.
- `scheduler.py`: Thuật toán xếp lịch tự động.
- `seed_submissions.py`: Kịch bản nạp thêm 10 học viên mẫu.
- `requirements.txt`: Các thư viện Python cần cài đặt.
- `static/`: Chứa các tài nguyên giao diện của web.
  - `index.html`: Giao diện điền thông tin và lịch rảnh của học viên.
  - `admin.html`: Giao diện bảng điều khiển dành cho Admin.
  - `css/style.css`: Bộ định dạng giao diện (Dark Mode, Responsive).
  - `js/student.js`: Xử lý logic và kết nối API phía học viên.
  - `js/admin.js`: Xử lý logic hiển thị lịch học, chỉnh sửa, tự động xếp lịch phía admin.
