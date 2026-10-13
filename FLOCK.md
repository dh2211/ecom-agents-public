# FLOCK.md

> flock: 0.3 | profile: core

## Docs Map

| Type | Where | Answers |
|---|---|---|
| overview | README.md | Who the product is for, and where to start. Vietnamese: README.vi.md |
| instructions | AGENTS.md | Agent sửa repository phải tuân thủ điều gì? |
| user-guide | docs/COMMERCE-GUIDE.vi.html | Người vận hành dùng app và duyệt workflow POD/Dropship thế nào? |
| architecture | docs/COMMERCE-ARCHITECTURE.md | Ranh giới hệ thống, nguồn code và khôi phục nằm ở đâu? |
| advanced-guide | docs/ | Skill, kit theo lịch, nguồn tham khảo và hướng dẫn nâng cao nằm ở đâu? |
| kit-contract | agents/ | Hợp đồng, vai trò, lịch và routine của từng kit là gì? |
| on-demand-skill | skills/ | Công việc theo yêu cầu có những giới hạn nào? |
| operating-profile | profiles/ | POD/Dropship bổ sung ràng buộc gì cho kit riêng? |
| index | plans/index.md | Đọc review hiện tại và kế hoạch cũ ở đâu? |
| plan | plans/*/ | Phạm vi sửa đã được ghi nhận và nghiệm thu theo từng đợt là gì? |
| evidence | plans/reports/ | Review quan sát được gì, kiểm tra nào đã chạy hoặc chưa chạy? |
| journal | plans/journals/ | Lịch sử thực hiện và bài học nằm ở đâu, không thay thế trạng thái kế hoạch? |
| release-history | CHANGELOG.md | Những thay đổi đã ghi nhận nằm ở đâu? |
| attribution | CREDITS.md | Ghi nhận tác giả và nguồn nằm ở đâu? |
| license | LICENSE | Điều khoản sử dụng mã nguồn là gì? |
| security | SECURITY.md | Báo cáo vấn đề bảo mật thế nào? |

## Index

[Chỉ mục công việc và review](plans/index.md). Chi tiết trạng thái thuộc hồ sơ được liên kết, không thuộc chỉ mục.

## Status Labels

`Design` | `Building` | `Review` | `Blocked` | `Done <date>` | `Parked`

Kế hoạch cũ giữ nguyên nhãn lịch sử như `complete`. Nhãn đó mô tả đợt làm việc đã đóng, không mô tả phiên bản public hiện tại.

## Conventions

- Đọc AGENTS.md, bản đồ này, rồi chỉ các tài liệu liên quan. Kiểm tra Git và code hiện tại trước khi kế thừa kết luận cũ.
- README.md (English) và README.vi.md là lối vào ngắn. Hướng dẫn HTML sở hữu quy trình cho người dùng app. Tài liệu nâng cao không được biến `hire` thành điều kiện chạy app.
- Code, schema và test sở hữu chi tiết thực thi; yêu cầu và hợp đồng sở hữu hành vi được chấp nhận. Không sửa yêu cầu để hợp thức hóa lỗi code.
- Review ghi bằng chứng, giới hạn và PASS/FAIL/NOT-RUN. Test xanh không đồng nghĩa đã nghiệm thu store thật hoặc được phép publish/spend.
- Quyết định có ngày. Đảo ngược quyết định phải giữ nội dung cũ và đánh dấu `SUPERSEDED <date>` tại chỗ, kèm lý do và quyết định thay thế.
- Giữ lý do từ chối phương án quan trọng; không viết lại kế hoạch đã đóng thành tài liệu kiến trúc hiện tại.
- Không tạo hồ sơ STATE, MEMORY hoặc HANDOFF song song. Core không yêu cầu các hồ sơ này.

## Adoption decision

Chọn Core để định tuyến tài liệu hiện có, không chuyển đường dẫn hoặc dựng bộ BRD/feature/blueprint giả cho lịch sử đã hoàn tất (decided 2026-09-22). Chưa chọn Flow hoặc Handoff v1: đợt này là review và chỉnh tài liệu, không mở một vòng triển khai sửa lỗi mới. Có thể chọn mở rộng khi có kế hoạch thực thi được duyệt.

Áp dụng [Flock 0.3 draft](https://github.com/thienduy2211/flock.md/blob/main/spec/SPEC.md) và [hướng dẫn adoption](https://github.com/thienduy2211/flock.md/blob/main/docs/ADOPT.md). Flock không thay thế AGENTS.md hay Ecom Agent Standard.

**SUPERSEDED 2026-09-22, phạm vi triển khai:** chủ dự án đã yêu cầu sửa sau review.
Kế hoạch thực thi nằm trong chỉ mục; tiếp tục dùng Core để định tuyến, không thêm
Flow/Handoff hoặc hồ sơ trạng thái song song. Quyết định chọn Core phía trên vẫn giữ.
