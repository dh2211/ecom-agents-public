# Review va toi uu skill Ecom Agents

Ngay: 2026-09-22. Baseline: `12e3ace`. Pham vi chinh: 60 routine trong tam kit. Phien ban nguon sau sua: `1.0.1`.

## Ket qua

Da sua cac mau thuan ve release, profile, khoa luot chay va quyen sua lich. Giu noi dung nghiep vu chi tiet, id routine, schema, quyen so huu output, lich hien tai va cac vi du. Khong thay runtime, goi dich vu kinh doanh, gui tin, dang bai hay publish package.

Skill `ak-skill-creator` duoc dung cho inventory, lint va phan loai loi. Quy tac cua repository ve kit day du duoc uu tien hon khuyen nghi chung gioi han 300 dong. Toi uu o day la lam ro dieu kien va thu tu thuc thi, khong phai rut ngan kit theo so dong. Khong co so lieu chung minh giam token, chi phi hay thoi gian chay.

## Inventory

| Kit | Routine |
|---|---:|
| Ad Manager | 7 |
| Chief of Staff | 7 |
| Customer Satisfaction | 8 |
| GTM Engineer | 8 |
| Sales | 7 |
| SEO/AEO | 8 |
| Social Media | 7 |
| Web Dev | 8 |
| Tong | 60 |

Da doc bo sung bon skill Commerce/POD/Dropship va chay structural validator cho ca nam skill trong `skills/`. Khong doi cac skill nay.

## Phat hien va thay doi

| Muc do | Bang chung truoc sua | Thay doi |
|---|---|---|
| Cao | `agents/seo-agent/routines/seo-publish-run/SKILL.md`, phan quyen publish, va CONTRACT section 7.1 coi publish la quyen di kem cai dat | Require release cho property va action, quyen harness, dieu kien cua row va profile. Remote CMS write va repository push cung qua gate. Held khong ghi published/consumed |
| Cao | `seo-index-sweep` cho phep request indexing va submit sitemap vi URL da public | Require release rieng cho tung action. Release publish khong bao gom indexing. Inspection duoc tiep tuc khi action bi hold |
| Cao | 58 menh de trong 48 routine khang dinh hai instance khong the cung chay nho ghi state truoc | Sua theo `scripts/run-routine.mjs`: supervisor khoa doc quyen; rename chi bao ve tinh toan ven file |
| Cao | Huong dan self-improvement tu doi window, cadence hoac dang ky job mau thuan voi AGENTS.md | Sua 58 doan thanh de xuat. Them scope vao ca tam CONTRACT va 60 routine: scheduled run chi de xuat; member-directed install/maintenance moi ap dung cac buoc sua lich |
| Vua | Profile gate o cuoi file; RELEASES.md thuong chi duoc nhac nhu mot nguyen tac | Dua preflight len sau cheap guard. Doc release va profile truoc business work; file profile bat buoc bi thieu hoac profile xung dot se chan business work |
| Vua | Sau Corrections con co 6 phan SEO/AEO va 13 phan Improving/The one push | Chuyen noi dung shipped len truoc Corrections. Giu noi dung ghi chu Corrections hien co. Viec nay cung dua huong dan shipped vao pham vi no-dashes scanner |
| Vua | AGENTS.md yeu cau doc kit truoc guard, va goi guard khong co routine id | Sua thu tu cheap preflight, them `<id>`, phan biet wrapper voi guard va tranh khoi tao wrapper lan hai |
| Vua | CI chi kiem tra frontmatter va script self-test, khong kiem tra cac rang buoc tren | Them `.github/scripts/skill-check.mjs`, tich hop vao selftests, 21 ca kiem thu co cac mutation de chung minh checker bat loi |

Hai description SEO duoc viet lai de phan anh gate publish/indexing. Metadata.internal va ten routine khong doi. Moi kit tang VERSION, agent.json, AGENTS.md va CHANGELOG dong bo; root package va changelog tang len 1.0.1. Cac version rieng cua overlay giu nguyen.

## Kiem tra tinh

`skill-check.mjs` kiem tra frontmatter, description, ten folder, manifest, row SCHEDULE, launcher qua supervisor, bundled script paths theo kit root, preflight, stale concurrency claims, self-authorized schedule changes va vi tri cua noi dung shipped so voi Corrections.

Day la checker cau truc va cac mau loi da biet, khong phai bo chung minh moi chi dan tu nhien deu dung. Kiem tra schedule khong thay doi gia tri lich hay xac nhan moi tinh huong stagger lien kit.

## Kich ban doi chieu chi dan

Bang nay la ket qua doc va doi chieu source. Khong phai transcript cua agent duoc chay tren tai khoan kinh doanh.

| Tinh huong | Chi dan sau sua |
|---|---|
| Guard tra ve paused/out-of-window/already-ran | Thoat truoc khi doc bo contract |
| Hai scheduled job cung bat dau | Wrapper giu khoa, state rename khong duoc coi la khoa |
| Agent da o trong wrapper | Khong khoi tao wrapper thu hai |
| Draft SEO ready nhung khong co release | Giu local artifact, khong push/publish, khong ghi receipt gia |
| Release cho property khac hoac action khac | Action hien tai van held |
| Release khong doc duoc hoac khong truy duoc ve member | Action held |
| Release hop le nhung harness tu choi | Khong thuc thi action |
| Release hop le nhung profile draft-only | Khong remote write |
| Co POD.md/DROPSHIP.md nhung thieu file required | Chan business work va ghi blocker |
| Chi co release publish | Indexing va sitemap submission van can release phu hop |
| Lich hien tai khong hop ly | Routine ghi de xuat, giu nguyen row va job |
| Member-directed install/maintenance duoc uy quyen | Ap dung logic lap lich va kiem tra lane theo contract |

Chua chay A/B bang hai phien model doc lap, chua benchmark triggering hay do chat luong output kinh doanh. Routine duoc scheduler goi bang id nen bai test trigger ngon ngu tu nhien khong thay the duoc kiem tra wiring.

## Validation va gioi han

- `node .github/scripts/selftests.mjs`: PASS, bao gom 21 checker self-tests va scan 60 routine.
- `node .github/scripts/no-dashes.mjs`: PASS.
- `node installer/cli.mjs list`: PASS, du tam agent.
- `node .github/scripts/aeo-check.mjs`: PASS.
- Commerce tests: 42/42 PASS khi chay ngoai sandbox. Timeout worker trong sandbox gap gioi han dung process Windows; da dung dung worker cua test va chay lai.
- POD tests: 88/89 PASS khi chay ngoai sandbox. Test symlink gap `EPERM` khi tao symlink tren Windows, truoc khi thu hanh vi upgrade. Khong doi test de bo qua loi nay.
- Dropship tests: 59/60 PASS. Test video gap FFmpeg 2.8.4 tu ImageMagick tren PATH, khong ho tro `protocol_whitelist`. Khong doi tool he thong hay bo rang buoc media de lam test xanh.
- `npm.cmd test` chua PASS toan bo vi cac gioi han moi truong tren. `npm test` qua shim PowerShell con bi ExecutionPolicy chan; dung shim `.cmd` co san de chay script.
- `git diff --check`: PASS.

Generic lint tren toan bo `agents/` bao 117 High flags: 100 threat-language, 8 budget-countdown, 9 pressure-density. Day la ket qua heuristic, khong phai 117 loi da xac nhan. Vi du `token left` la chuoi van ban autolinker, khong phai ngan sach token model. Cac quy tac chong bo qua recording, bypass permission, credentials va single-writer can giu y nghia nghiep vu. Khong tu dong xoa hoac suppress cac flag nay; dot sua nay khong tu nhan generic lint clean.

Generic quick_validate cua skill-creator resolve script tu folder routine, nen bao thieu `scripts/run-routine.mjs` du file nam o kit root. Validator cua repository resolve theo dung kit root. Bon skill workbench/commerce pass generic validator; hire bi ba path flags tuong tu, vi huong dan cua no ghi ro chay tu thu muc kit da cai.

## Ban giao

Thay doi nam trong working tree, chua commit hay tao PR. Khong co release GitHub hoac npm publish. Root package hien co `private: true`; chu repository quyet dinh cach phan phoi. Version source moi khong tu cap nhat cac ban kit da cai, va npx van dung ban package da phat hanh cho toi khi chu so huu phat hanh ban moi.
