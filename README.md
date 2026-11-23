# CredBox

Phiên bản 1.0.0

Kho tài khoản và bảng theo dõi bảo mật của Nhóm 5, học phần Nhập môn ngành và Kỹ năng mềm tại VKU. Bản này là web mẫu dùng dữ liệu soạn sẵn, không lưu mật khẩu thật.

Mở [CredBox trên GitHub Pages](https://nktu32-ux.github.io/bao-ve-tai-khoan/). Bốn mục Tổng quan, Kho tài khoản, Kiểm tra bảo mật và Cảnh báo nằm trong cùng trang `index.html`.

## Luồng trình bày trong index.html

1. Chọn **Mô phỏng đăng nhập**. Chọn **Không lưu** để thấy kho giữ nguyên, hoặc **Cho phép lưu** để thêm Spotify.
2. Mở **Kho tài khoản**, tìm và mở Facebook hoặc Diễn đàn Sinh viên. Hai tài khoản này dùng chung một mật khẩu. Mật khẩu được che cho đến khi bấm hiện.
3. Mở **Kiểm tra bảo mật** để xem thứ tự xử lý. Trong chi tiết tài khoản, chọn trạng thái 2FA bạn đã tự xác nhận.
4. Mở **Cảnh báo**, đọc bản tin sự cố giả lập và phần tóm tắt AI soạn sẵn. Chọn **Xem tài khoản**, rồi **Mô phỏng đổi mật khẩu**.
5. Tải lại trang để về tình huống ban đầu.

## Cách mở

- **Mở file trực tiếp:** bấm đúp `index.html`. Các thao tác với dữ liệu mẫu chạy được, một số hiệu ứng chỉ bật khi mở qua HTTP.
- **Qua HTTP (nên dùng):** đăng lên GitHub Pages, hoặc chạy lệnh dưới đây trong Terminal trên máy:

```bash
python3 -m http.server 8000 --bind 127.0.0.1 --directory /home/beth/t3code/doan1/lamtrangweb/website
```

- `python3 -m http.server` chạy máy chủ web tĩnh có sẵn trong Python. Lệnh chỉ đọc file để gửi cho trình duyệt, không sửa file và không cài gì thêm.
- `8000` là cổng. Địa chỉ mở trong trình duyệt là http://127.0.0.1:8000.
- `--bind 127.0.0.1` chỉ cho chính máy của bạn truy cập, máy khác trong mạng không vào được.
- `--directory ...` là thư mục chứa web, nên bạn chạy lệnh ở thư mục nào cũng được. Dấu `/` ở đầu đường dẫn nghĩa là tính từ gốc ổ đĩa.

Khi chạy được, Terminal hiện dòng `Serving HTTP on 127.0.0.1 port 8000`. Bấm Ctrl+C trong Terminal để dừng máy chủ.

## Phạm vi phiên bản

Bản 1.0.0 trình bày giao diện và luồng thao tác bằng dữ liệu giả, gồm cả tên đăng nhập `sv.nhom5`. Bản này chưa có:

- ô nhập mật khẩu thật, tiện ích trình duyệt, kho mã hóa;
- nhập dữ liệu từ trình quản lý mật khẩu, kết nối dịch vụ, nguồn tin rò rỉ thật.

Độ mạnh mật khẩu chỉ xét độ dài: dưới 14 ký tự là ngắn. Trạng thái 2FA do người dùng chọn. Bản tin sự cố và tóm tắt AI được soạn sẵn. Mọi thay đổi chỉ nằm trong bộ nhớ của trang.

## Thành phần và giấy phép

- `index.html` dùng CSS, JavaScript và hiệu ứng của Taste Skill trong `assets/taste/`. Giấy phép MIT nằm ở `assets/Taste-LICENSE`.
- Font Geist hỗ trợ tiếng Việt và được tải từ `assets/fonts/`, cùng giấy phép SIL OFL.
- Logo dịch vụ lấy từ bộ SVG Logos (CC0), biểu tượng Lucide (ISC) nằm trực tiếp trong `index.html`. Nguồn từng logo ghi ở `assets/icons/icons-credits.json`. Tên và logo dịch vụ thuộc về chủ sở hữu.
