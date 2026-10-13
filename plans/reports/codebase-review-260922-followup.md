# Review tiếp theo sau đợt sửa thương mại

Ngày: 2026-09-22. Commit được review: `7c8f874`.
Phạm vi: Commerce backend/UI, installer/upgrade, runtime, POD/Dropship/media,
các kiểm tra kit và kiểm tra trình duyệt. Đây là review; chưa sửa code sản phẩm.
Không đánh đồng test xanh với nghiệm thu store, supplier hoặc AI provider thật.

## Kết luận

Xác nhận bốn lỗi P2 cần sửa. Các hồi quy đã có đều qua khi chọn FFmpeg tương thích,
nhưng chưa bao phủ bốn tình huống bên dưới. Chưa tìm thấy P0/P1 trong phạm vi đã kiểm tra;
điều này không chứng minh toàn bộ repository không còn lỗi nghiêm trọng.

## REV-01: Upload hợp lệ dưới giới hạn làm tràn stack

- Mức độ: P2. [Nguồn](../../app/commerce/engine.mjs#L160).
- Regex xác thực Base64 dùng nhóm lặp trên toàn chuỗi nhiều MB. Node v24.18.0
  ném `RangeError: Maximum call stack size exceeded` trước bước decode/lưu file.
- Tái hiện: sinh PNG RGBA 1200 x 1200 với dữ liệu pixel giả ngẫu nhiên; kiểm tra
  bằng `inspectPng` xác nhận PNG hợp lệ. File 5,763,023 byte vẫn bị `Engine.upload`
  từ chối với lỗi tràn stack, dù UI/API công bố hỗ trợ tới 25 MiB.
- Fixture 1 MiB qua; 5, 10 và 25 MiB đều lỗi trên runtime hiện tại. Không suy luận
  đây là ngưỡng cố định cho mọi phiên bản V8.
- Hướng sửa: kiểm tra độ dài, alphabet và padding bằng cách không phụ thuộc stack;
  giữ giới hạn byte sau decode và quy tắc canonical Base64.
- Tiêu chí đóng: ảnh thực hợp lệ cỡ 6 MiB và payload tối đa được nhận; payload quá
  giới hạn, ký tự sai và padding sai vẫn bị từ chối. Thêm test qua HTTP.

## REV-02: Duyệt bước cuối không kiểm tra lại bằng chứng của bước trước

- Mức độ: P2. [Nguồn](../../app/commerce/engine.mjs#L253).
- `review()` chỉ gọi `verifyResult` cho job đang duyệt. Nó không gọi kiểm tra
  dependency bắc cầu và digest mà attempt đã dùng.
- Tái hiện trong workspace tạm, `demo:false`: hoàn tất Dropship bằng hồ sơ nhà
  cung cấp giả hợp lệ, gửi kết quả bước bàn giao cuối khi nguồn còn mới, dịch đồng
  hồ test thêm 48 giờ rồi duyệt. Dự án thành `completed`; ngay sau đó `audit()` báo
  stock, quote và shipping đã cũ. Các bước giao việc trước đó vẫn kiểm tra đúng.
- Ảnh hưởng: người dùng có thể nhận bộ bàn giao hoàn tất dựa trên bằng chứng đã hết
  hạn hoặc artifact tổ tiên đã thay đổi trong thời gian chờ duyệt.
- Hướng sửa: khi approve, kiểm tra lại toàn bộ dependency và binding với packet
  ban đầu trước khi đổi trạng thái. Vẫn cho phép reject để xử lý kết quả cũ.
- Tiêu chí đóng: không approve được bước cuối sau khi nguồn hết hạn hoặc artifact
  tổ tiên đổi; approve bình thường khi bằng chứng còn hợp lệ. Ghi rõ đường phục hồi
  hoặc tạo dự án revision mới, không tự bỏ qua giới hạn retry hiện có.

## REV-03: Có thể hạ phiên bản sau upgrade có metadata tùy chỉnh

- Mức độ: P2. [Nguồn](../../installer/upgrade.mjs#L160).
- Downgrade guard chỉ so nguồn mới với `agent.json`/`VERSION` đang giữ lại. Receipt
  đáng tin được đọc sau guard, mặc dù đã ghi nhận phiên bản nội dung mới hơn.
- Tái hiện bằng kit fixture: cài v1, tùy chỉnh `agent.json`, áp dụng v3. Metadata
  được giữ ở v1 để chủ sở hữu đối chiếu; `CONTRACT.md` nguyên bản được nâng lên v3,
  receipt ghi v3. Áp dụng nguồn v2 sau đó vẫn thành công và thay nội dung v3 bằng v2.
- Hướng sửa: xác thực receipt và dùng phiên bản cao nhất đã áp dụng làm một phần
  của điều kiện chống downgrade; không tin receipt legacy hoặc sai schema một cách mù quáng.
- Tiêu chí đóng: chuỗi v1 tùy chỉnh -> v3 -> v2 bị từ chối trước khi ghi file;
  v3 -> v4 và các trường hợp receipt không đáng tin vẫn giữ dữ liệu thành viên.

## REV-04: Giao diện xóa nội dung chưa lưu khi lỗi hoặc polling

- Mức độ: P2. [Nguồn nhánh lỗi](../../app/commerce/public/app.js#L13),
  [dựng lại form](../../app/commerce/public/app.js#L35),
  [polling theo revision chung](../../app/commerce/public/app.js#L47).
- Kiểm tra Chromium thật: dán JSON parse được nhưng sai schema vào kết quả manual,
  bấm nhận kết quả. API trả lỗi, `refresh(true)` dựng lại form và textarea thành rỗng.
- Tình huống thứ hai: nhập lại draft, thay settings ở một client khác. Lần poll
  tiếp theo xóa draft dù không hề gửi form đó. Ghi chú duyệt cũng nằm trong form bị thay.
- Ảnh hưởng: mất nội dung đang sửa; thông báo chung nói dữ liệu cũ được giữ không
  phân biệt hồ sơ đã lưu với bản nháp đang nhập.
- Hướng sửa: lưu draft theo project/job/attempt và bảo toàn form khi refresh;
  chỉ xóa draft đúng đối tượng sau submit thành công, xử lý attempt đổi rõ ràng.
- Tiêu chí đóng: test trình duyệt giữ JSON và ghi chú khi API lỗi, poll do dự án
  khác thay đổi và chuyển qua lại dự án; submit thành công vẫn cập nhật trạng thái.

## Các điểm tối ưu

1. **Polling toàn ledger có chi phí đã đo.** `/api/state` đọc, hash và gửi toàn bộ
   projects, reports, attempts và events mỗi 2,5 giây. Browser chỉ so revision sau
   khi đã tải và parse. Với 30 dự án giả, mỗi dự án có một report 170.000 ký tự,
   response không đổi vẫn là 5.233.285 byte; khoảng 120 MiB/phút/tab qua loopback.
   Năm lần fetch/parse cục bộ mất 134 tới 173 ms/lần. Nên dùng revision/ETag có cache
   phía server và tải chi tiết dự án đang chọn riêng. Đây là phép đo fixture cục bộ,
   chưa phải tải thực tế của người dùng hay bằng chứng SLA bị vi phạm.
2. **Đọc runlog theo offset.** `scripts/runtime/run-routine.mjs:129` đọc toàn bộ
   lịch sử rồi mới lấy phần đuôi của lần chạy. Dùng descriptor/fstat/read theo offset
   để chi phí phụ thuộc phần mới ghi. Giữ các kiểm tra file thường, truncation và
   log malformed. Chưa benchmark; ưu tiên thấp hơn bốn lỗi chức năng.
3. **Preflight FFmpeg.** PATH mặc định của máy chọn FFmpeg 2.8.4 thuộc ImageMagick,
   trong khi ffprobe thuộc bản cài khác. Nên báo rõ executable và khả năng hỗ trợ
   `protocol_whitelist` trước khi bắt đầu dựng video. Giữ cơ chế từ chối decoder
   không tương thích; không khôi phục fallback bỏ bảo vệ mạng.

## Bằng chứng kiểm tra

Windows, Node v24.18.0. Không gọi AI trả phí hoặc tài khoản kinh doanh.

| Kiểm tra | Kết quả |
|---|---|
| `npm test`, PATH mặc định | FAIL ở 1 test dựng video do FFmpeg 2.8.4 không hỗ trợ option bảo vệ; pipeline dừng trước Commerce |
| `npm test`, thêm `C:\ffmpeg\bin` vào PATH của process | PASS: POD 148, Dropship 66, Commerce 51; tổng 265 pass, 2 skip |
| Kit selftests, skill-check, no-dashes | PASS, kiểm tra cấu trúc 60 routine |
| `node installer/cli.mjs list` | PASS, 8 kit |
| `node .github/scripts/aeo-check.mjs` | PASS |
| `node .github/scripts/commerce-browser.mjs` | PASS: dispatch, duyệt, phục hồi, hoàn tất, observer, mobile layout, guide |
| Fixture upload, stale final approval, staged downgrade | FAIL như kỳ vọng của review, xác nhận REV-01/02/03 |
| Chromium giữ draft khi API lỗi/polling | FAIL như kỳ vọng của review, xác nhận REV-04 |
| Store/supplier/provider thật; Linux/macOS trong đợt này | NOT-RUN |

Hai test symlink bị skip vì Windows trả `EPERM`; không tính là test đã qua.
Không thay PATH hệ thống, không cài dependency mới. Browser dùng Playwright cache sẵn.
Không sửa code, commit, push, publish hoặc gửi thông tin ra hệ thống kinh doanh.

Cleanup hai fixture installer/runtime bị lớp duyệt tự động từ chối với thông báo
`rejected: blocked by policy`, không có lý do chi tiết hơn. Các thư mục giả còn lại:
`C:\Users\DUYVO\AppData\Local\Temp\review-upgrade-KBF5kF` và
`C:\Users\DUYVO\AppData\Local\Temp\review-guard-gojTCQ`.

## Thứ tự sửa đề xuất

REV-01 và REV-04 để gỡ cản trở sử dụng thông thường; REV-02 để bảo đảm trạng thái
hoàn tất phản ánh bằng chứng hiện hành; REV-03 trước lần phát hành nguồn tiếp theo.
Sau đó tối ưu polling. Giữ báo cáo này là bằng chứng review; nếu triển khai, ghi
phạm vi và tiến độ vào kế hoạch riêng theo FLOCK.md, không đổi kết luận cũ thành đã fix.
