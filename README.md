# CredBox

CredBox là kho tài khoản cá nhân của Nhóm 5 · VKU. Trang **Tổng quan** hiển thị số liệu của kho và có mục **Giới thiệu CredBox**. Kho mới bắt đầu trống.

## Sử dụng

1. Chọn **Thêm tài khoản** rồi tạo mật khẩu chính để mở kho. Hãy giữ mật khẩu chính ở nơi an toàn vì ứng dụng không có chức năng khôi phục.
2. Nhập thông tin đăng nhập của dịch vụ và lưu. Vào **Kho tài khoản** để tìm, xem hoặc chỉnh sửa thông tin đã lưu.
3. Vào **Kiểm tra bảo mật** để xem mật khẩu dưới 14 ký tự, mật khẩu trùng giữa các tài khoản và trạng thái xác thực hai yếu tố. Bạn tự cập nhật trạng thái này sau khi kiểm tra ở dịch vụ.
4. Mở một tài khoản rồi chọn **Lịch sử đăng nhập**. Mở trang hoạt động của dịch vụ để xem các lần đăng nhập mới nhất. Lịch sử trong kho được mã hóa cùng tài khoản. Bản web hiện chưa đồng bộ tự động với dịch vụ.
5. Với tài khoản GitHub, lưu đúng tên người dùng GitHub trong kho. Xuất tệp JSON từ Security log và chọn **Nhập nhật ký từ GitHub** trong lịch sử tài khoản. CredBox đọc tệp trên máy, lọc các sự kiện đăng nhập của tên người dùng đó và bỏ qua mục đã nhập. [Hướng dẫn xuất nhật ký của GitHub](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/reviewing-your-security-log#exporting-your-security-log)
6. **Cảnh báo** liệt kê các tài khoản có lần đăng nhập cần xác minh, mật khẩu ngắn hoặc dùng lại. Khi thấy thiết bị lạ, hãy kiểm tra phiên tại dịch vụ. Nếu nhận ra lần đăng nhập đó, chọn **Tôi nhận ra lần này** trong lịch sử. Nếu cần đổi mật khẩu, hãy đổi tại dịch vụ rồi cập nhật bản lưu trong CredBox.
7. Chọn **Khóa kho** khi dùng xong. Khi tải lại trang, nhập mật khẩu chính để mở kho.

Dữ liệu được mã hóa và lưu riêng trong trình duyệt tại địa chỉ web bạn đang sử dụng. Xóa dữ liệu của trang sẽ xóa cả kho. Trình duyệt khác, thiết bị khác hoặc địa chỉ web khác có kho riêng.

## Mở trên máy bằng Arch Linux

Mở Terminal (cửa sổ nhập lệnh) trong thư mục dự án có chứa thư mục `website`. Nếu máy đã có Python 3, chạy lệnh sau bằng tài khoản bình thường.

```bash
python3 -m http.server 8000 --bind 127.0.0.1 --directory website
```

- `python3` chạy Python. Tùy chọn `-m` yêu cầu Python chạy mô-đun có tên `http.server`, chương trình phục vụ các tệp web có sẵn.
- `8000` là cổng để trình duyệt kết nối. `--bind 127.0.0.1` chỉ cho phép truy cập từ chính máy đang chạy lệnh.
- `--directory website` chọn thư mục chứa các tệp web, tính từ thư mục hiện tại.

Khi Terminal hiện `Serving HTTP`, mở [CredBox trên máy](http://127.0.0.1:8000) trong trình duyệt. Bạn sẽ thấy trang Tổng quan. Để kiểm tra việc lưu, thêm một tài khoản, tải lại trang rồi mở khóa và tìm lại tài khoản vừa thêm. Nhấn **Ctrl+C** trong Terminal để dừng máy chủ. Lần sau hãy dùng cùng trình duyệt và địa chỉ này để mở lại kho.

Nếu đưa lên máy chủ, hãy phục vụ toàn bộ nội dung thư mục `website` qua HTTPS để trình duyệt cho phép mã hóa kho.

## Thành phần và giấy phép

Phông chữ Geist và giấy phép SIL OFL nằm trong `assets/fonts/`. Biểu tượng giao diện Lucide (ISC) nằm trong `index.html`. Nguồn các logo dịch vụ ghi ở `assets/icons/icons-credits.json`. Tên và logo dịch vụ thuộc về chủ sở hữu.
