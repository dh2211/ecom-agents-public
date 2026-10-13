# Review trước thương mại: POD và Dropship

**Status:** Review
**Date:** 2026-09-22
**Baseline:** `978356b1fa881111e6b6cacb333b2e151ea3299d`
**Scope:** review code, contract và tài liệu; chỉnh tài liệu, không sửa product code trong đợt này.

## Kết luận

**SUPERSEDED 2026-09-22, trạng thái lỗi:** các finding dưới đây là bằng chứng ở baseline,
không phải danh sách lỗi hiện tại. Chủ dự án đã yêu cầu sửa; theo dõi kết quả và giới hạn
tại [kế hoạch sửa và kiểm chứng](../260922-commercial-readiness-fixes/plan.md).
Kết luận chưa nghiệm thu vận hành thương mại vẫn giữ nguyên.

Chưa đủ điều kiện bàn giao vận hành thương mại. Có thể thử nghiệm local với dữ liệu
được phép dùng và người giám sát. Không quảng bá là hệ thống tự vận hành store,
multi-tenant SaaS hoặc đã được nghiệm thu đa nền tảng/harness.

Các test hiện có đều qua nhưng các repro bổ sung dưới đây phát hiện lỗi không nằm
trong coverage. Kế hoạch cũ đã merge là lịch sử triển khai, không phải chứng nhận
đã hết lỗi. Không publish npm, không sửa GitHub Actions và không gọi tài khoản live.

## Các lỗi mở và tiêu chí đóng

### COMM-01. P1: Contender làm nhiễu bằng chứng của runtime owner

- Nguồn: [supervise](../../scripts/runtime/run-routine.mjs#L161), [logTail](../../scripts/runtime/run-routine.mjs#L126), [terminal decision](../../scripts/runtime/run-routine.mjs#L202); cùng lỗi trong các bản sao kit.
- Repro local: harness thứ nhất chờ rồi ghi đúng một terminal `ok`; gọi supervisor lần hai cùng routine/period trong lúc lần đầu đang chạy. Lần hai thấy journal `started`, ghi `failed` vào chung runlog. Owner đọc được hai record thay vì một và chuyển thành `uncertain`, exit 1 dù harness thành công. Reconciliation chặn các kỳ sau.
- Kết quả: FAIL. Test concurrent hiện tại chỉ thử acquire lock, không thử toàn bộ hai supervisor.
- Đóng khi: một owner completed, một contender bị từ chối và có bằng chứng riêng; record của contender không thay đổi kết luận owner. Vẫn hold khi chính owner thật sự có kết quả mơ hồ.

### COMM-02. P1: Khôi phục hold không đi tiếp được trên UI

- Nguồn: [runStatus](../../app/commerce/engine.mjs#L28) và [nút dispatch](../../app/commerce/public/app.js#L37).
- Repro local: creative-batch, duyệt brief; nộp và duyệt script cùng banner, mỗi report 105000 ký tự. Prepare media vượt packet budget, script/banner/media thành hold. Retry script cho job ready nhưng project vẫn hold, UI không có nút giao việc.
- Quan sát: `brief=succeeded, script=ready, banner=hold, media=hold`, `uiDispatchVisible=false`.
- Kết quả: FAIL. Test cũ dừng tại retry trả ready, chưa hoàn thành recovery qua UI.
- Đóng khi: người dùng sửa và duyệt lại đầu vào rồi hoàn tất workflow qua UI, vẫn nhìn thấy các hold khác và không bỏ qua dependency.

### COMM-03. P1: Dispatch con khi dependency còn hold

- Nguồn: [prepare](../../app/commerce/engine.mjs#L86), [verifyResult](../../app/commerce/engine.mjs#L221), [retry](../../app/commerce/engine.mjs#L237).
- Tiếp repro COMM-02 qua Engine API: retry script, nộp bản ngắn và duyệt; giữ banner ở hold; retry media rồi prepare. Media được dispatch với `script=succeeded, banner=hold` vì verify chỉ kiểm tra artifact/gate, không yêu cầu parent succeeded.
- Kết quả: FAIL, không dùng gate mock. UI hiện che một phần đường đi này, nhưng API/state contract vẫn sai.
- Đóng khi: dispatch luôn kiểm tra trạng thái và phiên bản approval của mọi dependency; thay đổi parent làm mất hiệu lực các descendant liên quan. Có regression cho nhánh song song và chạy trọn recovery.

### COMM-04. P1: SEO publish recovery còn mâu thuẫn

- Nguồn: [seo-publish-run](../../agents/seo-agent/routines/seo-publish-run/SKILL.md#L242), cùng file tại các dòng 243, 472, 486, 499, 656 và 657 ở baseline.
- Dedup chỉ nhận `published`, trong khi các nhánh ghi `live-check-failed` và tuyên bố ngăn replay. Recovery pending/uncertain có thể ghi confirmed rồi vào Step 9 mà chưa gán `active_publish_attempt`. Bảng lỗi cho phép append published khi thiếu live-check, trái nhánh surface; xử lý malformed ledger chưa có ngoại lệ fail-closed cho attempts.
- Bằng chứng: phân tích đường đi của instruction, chưa chạy mô phỏng LLM publish hoặc thao tác live. Structural checker chỉ chứng minh có keyword/regex, không chứng minh idempotency.
- Đóng khi: hợp nhất quy tắc attempt/consumed/published và có fixture crash giữa từng append, unavailable live check, malformed attempts. Không nhấn lại khi kết quả lần trước chưa được đối chiếu.

### COMM-05. P2: POD review có thể tái dùng cho artwork khác

- Nguồn: [approval/listingReadiness](../../scripts/pod/core.mjs#L40) và [bản copy skill](../../skills/pod-workbench/scripts/core.mjs#L40).
- Repro synthetic: listing và QA cùng hash `bbbb...`, bốn review khai hash `aaaa...`; helper trả `ready-for-human-review`, reasons rỗng. Chỉ reviewer/date/evidence được kiểm tra, không ràng buộc asset của review.
- Kết quả: FAIL về ràng buộc chứng cứ, không phải bypass quyền publish. App listing dùng report gate, không tự áp dụng helper này.
- Đóng khi: review ràng buộc đúng artwork và template liên quan; đổi revision buộc duyệt lại. Đồng bộ hai bản core và thêm negative tests.

### COMM-06. P2: Media fallback giảm bảo vệ network

- Nguồn: [media run fallback](../../skills/commerce-creative-studio/scripts/media.mjs#L18).
- Khi tool không hiểu `protocol_whitelist`, helper bỏ cờ rồi chạy lại. File local vẫn có thể chứa tham chiếu network.
- Repro giới hạn: FFmpeg 2.8 thực tế đọc playlist HLS local đổi tên `.mp4` và gửi một GET đến loopback khi bỏ whitelist. Không có request ra bên ngoài. ffprobe hiện tại từ chối playlist đó trước normal assembly, nên KHÔNG khẳng định đã khai thác toàn bộ assemble trên máy này.
- Đóng khi: từ chối tool thiếu protection thay vì fallback giảm quyền; thêm test decoder không truy cập network từ media input. Cần xác minh lại đường probe/assemble trên cấu hình được hỗ trợ.

### COMM-07. P2: Upgrade có thể để metadata khác phiên bản

- Nguồn: [version validation](../../installer/upgrade.mjs#L158), replacement/staging tại dòng 190 và 195.
- Repro: chỉ sửa name của agent.json đã cài, upgrade 1.0.1 lên 1.0.2. VERSION được thay, manifest được stage `.new` và vẫn 1.0.1. Lần report-only tiếp theo báo `Installed manifest and VERSION disagree`.
- Kết quả: reproduced; không ghi đè custom field, nhưng cần reconciliation thủ công. Guide đã bổ sung cách giữ paused, xem cặp metadata và restore backup nếu không thể merge an toàn.
- Đóng khi: metadata không bị stranded sau apply hoặc công cụ có quy trình giải quyết pending rõ ràng, được regression test trước lần upgrade tiếp theo.

### COMM-08. P2: POD profile installer chưa bảo vệ như Dropship

- Nguồn: [installProfile](../../installer/pod-profile.mjs#L6).
- Source inspection: không yêu cầu PAUSED, không từ chối source Git/cloud root, không rollback chuỗi ghi sau khi tạo pod/. Lỗi giữa chừng có thể khiến rerun báo profile đã tồn tại.
- Chưa chạy fault-injection trên mọi vị trí ghi; đây là gap triển khai, không phải bằng chứng đã lộ dữ liệu. Guide nay yêu cầu private kit, pause/backup và kiểm tra partial install.
- Đóng khi: có preflight tương đương Dropship và recovery test cho lỗi giữa từng bước, bảo toàn dữ liệu thành viên.

### COMM-09. P2: Distribution và hướng dẫn kit còn lệch sản phẩm hiện tại

- [package.json](../../package.json) là scoped private package 1.0.1; kit VERSION hiện 1.0.2. Không có bằng chứng unscoped `npx ecom-agents` phục vụ checkout này.
- Hướng dẫn chính đã chuyển sang source checkout. CLI help, root AGENTS và nội dung kit còn chứa distribution hoặc mô tả lịch sử; cần đợt cập nhật contract riêng, không âm thầm sửa hàng loạt kit trong một đợt docs review.
- Root AGENTS nói repo không có runtime/service, không còn khớp app Commerce. Chưa sửa vì đó là process instruction do owner cung cấp; cần chốt phạm vi cập nhật và thêm route tới FLOCK.md.
- Đóng khi: thống nhất đường phân phối, node baseline cho từng entrypoint và version/release policy. Owner quyết định publish; agent không publish npm hoặc tạo GitHub release.

## Tài liệu đã sửa trong đợt này

- README ngắn, tập trung POD/Dropship, chỉ rõ trạng thái pilot, chi phí AI riêng và giới hạn draft-only.
- Guide HTML có checklist đầu vào/bàn giao, phân biệt report gate với đo file, review theo revision, giới hạn recovery và media.
- Quickstart không còn yêu cầu merge PR cũ. Hướng dẫn nâng cao phân biệt app, skill và kit theo lịch; POD có bảng nguồn schema/input và hướng lưu QA output.
- FAQ/guardrails bỏ hiểu nhầm channel hoặc scheduler permission là release. Sửa giải thích Sunday/ISO week, claim overwrite an toàn và SLA không có cơ sở.
- Cost/harness/prerequisite lịch sử được gắn giới hạn bằng chứng; không xác nhận lại mọi giá hoặc API vendor. Browser lane và dead-lock recovery được supersede tại chỗ, không xóa lý do cũ.
- [FLOCK.md](../../FLOCK.md) dùng Core, [index](../index.md) điều hướng lịch sử và review. Không bịa approval, không backfill feature/blueprint hay tạo checkpoint song song.

## Kiểm chứng

Môi trường: Windows, Node v24.18.0. Dữ liệu synthetic, không dùng customer/store live.

| Check | Kết quả |
|---|---|
| `npm.cmd test` | PASS: POD 96 passed / 98 total, 2 symlink tests skipped vì EPERM; Dropship 64/64; Commerce 44/44. Tổng Node tests: 204 passed, 2 skipped, 0 failed. |
| `.github/scripts/selftests.mjs` trong npm test | PASS, gồm selftests kit và structural skill check. Không phải execution acceptance của toàn bộ routine. |
| `node .github/scripts/no-dashes.mjs` | PASS, chạy lại sau chỉnh tài liệu. |
| `node .github/scripts/aeo-check.mjs` | PASS. |
| `node installer/cli.mjs list` | PASS. |
| Flock checker từ fork owner | PASS Core MUST checks; commit checker `79aecd9750f5b63b663759e156dc5a0276139eb8`. Không chứng minh sản phẩm đúng. |
| Documentation checks | PASS: `git diff --check`, local Markdown link targets trong các file đổi và guide HTML anchors/section balance. Không phải visual browser test. |
| Repro COMM-01/02/03/05/07 | FAIL invariant như mô tả; không sửa test hiện hữu để làm xanh. |
| Commercial acceptance | NOT-RUN: store/supplier thật, mẫu in, vận chuyển, quyền media, AI login/quota và tác vụ có quyền kinh doanh. |
| Cross-platform/harness acceptance | NOT-RUN: macOS/Linux, Node 18/22 riêng, mọi scheduler/harness vendor. |
| UI browser walkthrough | NOT-RUN trong phiên review này; có HTTP demo integration test, source inspection và kiểm tra cấu trúc HTML. |
| GitHub Actions | NOT-RUN theo yêu cầu owner, local tests là gate của đợt này. |

Phạm vi đọc: Commerce engine/server/storage/runner/recovery/observer/UI/workflows;
runtime chung và kit replicas; installer/upgrade/profile; POD/Dropship/Creative
helpers, fixtures, profiles và hướng dẫn. Kiểm tra cấu trúc chạy trên toàn bộ routine;
review sâu instruction recovery tập trung SEO. Không tuyên bố đã chạy mọi routine
hoặc đã kiểm chứng từng câu trong toàn bộ kit nhiều MB.

## Thứ tự sửa đề xuất trước bàn giao

1. COMM-01 và COMM-04: bằng chứng owner và chống lặp hành động mơ hồ.
2. COMM-02 và COMM-03: recovery qua UI, revalidate dependency, regression chạy trọn DAG.
3. COMM-05/06: review revision và media fail-closed; thêm negative fixtures trước patch.
4. COMM-07/08/09: upgrade/profile recovery và thống nhất distribution/contracts.
5. Chạy lại local suite, thực hiện pilot POD và Dropship có người duyệt; ghi kết quả thực tế trước quyết định thương mại.

Đây là đề xuất sau review, chưa phải phê duyệt release hoặc hoàn tất các fix.
