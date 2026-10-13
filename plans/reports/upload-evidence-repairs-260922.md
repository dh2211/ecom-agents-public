# Kiểm tra giới hạn 50 MiB và sửa bằng chứng

Ngày: 2026-09-22. Phạm vi: cây làm việc trước commit giao hàng.
Trạng thái giao Git thuộc [kế hoạch](../260922-upload-and-evidence-repairs/plan.md).

## Kết quả

| Hạng mục | Kết quả | Bằng chứng |
|---|---|---|
| Upload đúng 50 MiB và từ chối 50 MiB cộng 1 byte | PASS | `tests/commerce/review-media.test.mjs` |
| Upload PNG thật trên 5 MiB qua HTTP | PASS | cùng file, test HTTP |
| Bằng chứng nhà cung cấp hết hạn sau khi bước lãi đã duyệt | PASS | cùng file. Supplier và economics còn `succeeded`, listing còn `ready`, thử lại supplier bị từ chối |
| Bước cũ chưa có attempt sau vẫn được giữ rồi làm lại | PASS | `tests/commerce/commerce.test.mjs`, stale dependency refresh |
| Hire lỗi xóa bản copy và hire lại cùng thư mục | PASS | `tests/pod/upgrade.test.mjs` |
| Đọc đuôi run log, từ chối file ngắn hơn hoặc dòng dở | PASS | `tests/pod/runtime.test.mjs` |
| Tám bản `run-routine.mjs` trùng bản runtime | PASS | cùng file |
| Không thử lại media khi thiếu `protocol_whitelist` | PASS | `tests/dropship/media-boundary.test.mjs` |
| Dựng video local với FFmpeg hỗ trợ cờ bảo vệ | PASS | Dropship suite, PATH tiến trình có `C:\ffmpeg\bin` |
| `npm test` | PASS | self-test kit, no-dashes, 161 PASS và 2 SKIP ở POD, 66 PASS ở Dropship, 60 PASS ở Commerce |
| Nhãn 50 MiB trên trình duyệt | NOT-RUN | Không mở trình duyệt trong đợt này. Chuỗi nằm trong `app/commerce/public/app.js` và hướng dẫn HTML |
| Store, nhà cung cấp hoặc tài khoản thật | NOT-RUN | Chỉ dùng fixture tổng hợp |
| CI trên GitHub | FAIL trước khi chạy | [PR #4](https://github.com/thienduy2211/ecom-agents/pull/4) đã merge lúc 16:38:03Z thành `146ddfd00ae08498c5241e01dd01f2dc0a74294e`. Job không có step nào, cùng lỗi tài khoản như PR #3. Không tính là CI xanh |

Hai SKIP là tạo symlink trên Windows bị `EPERM`. Không tính là PASS.

## Giới hạn

Ledger vẫn được đọc và kiểm checksum mỗi request state. Không có cache toàn vẹn.
App không tự tạo dự án sửa thay cho chủ. Bản cài hiện tại không đổi cho đến khi
chủ chạy upgrade từ checkout này.
