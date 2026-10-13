// Fixed workflow plans. No executable command is accepted from a business request.
const step = (id, title, role, output, gate = 'report', after = []) => ({id,title,role,output,gate,after,review:true});
export const ROLES = {
  gtm:'Nghiên cứu & kế hoạch', pod:'POD Workbench', dropship:'Dropship Workbench',
  creative:'Creative Studio', seo:'Nội dung bán hàng', ads:'Phân tích quảng cáo', csat:'Chăm sóc khách hàng'
};
export const WORKFLOWS = [
  {id:'pod-launch',model:'pod',title:'POD: từ ý tưởng đến bộ ra mắt',description:'Niche, brief, file in, tính lãi, listing và creative.',steps:[
    step('research','Nghiên cứu niche','gtm','Hồ sơ niche có nguồn và điểm chưa rõ.'),
    step('design','Brief thiết kế','pod','Brief gốc: đối tượng mua, câu chữ, màu áo, vị trí in.','report',['research']),
    step('print','Kiểm tra file in','pod','File PNG thật và thông số nhà in. data: {asset_id, spec}.','print',['design']),
    step('economics','Tính lãi','pod','Các chi phí thật trong data.costs; không điền số thiếu.','economics',['print']),
    step('listing','Nội dung sản phẩm','seo','Listing nháp, size, biến thể, ảnh và cam kết có căn cứ.','report',['economics']),
    step('creative','UGC & banner','creative','Bộ kịch bản, shot list và concept banner. Đây là kế hoạch, chưa phải video.','report',['listing']),
    step('handoff','Bộ bàn giao ra mắt','gtm','Tổng hợp đúng tài sản đã duyệt, phần còn thiếu và hướng triển khai thủ công.','report',['creative'])]},
  {id:'dropship-launch',model:'dropship',title:'Dropship: kiểm tra sản phẩm và chuẩn bị bán',description:'Sản phẩm, hàng mẫu, nhà cung cấp, giao hàng, lãi và creative.',steps:[
    step('research','Nghiên cứu sản phẩm','gtm','Vấn đề khách hàng, sản phẩm, nguồn và rủi ro.'),
    step('supplier','Kiểm tra nhà cung cấp','dropship','Hồ sơ sản phẩm đúng biến thể trong data.dossier; báo giá, stock, ship, hàng mẫu.','supplier',['research']),
    step('economics','Tính lãi theo thị trường','dropship','Chi phí bằng một tiền tệ trong data.costs.','economics',['supplier']),
    step('listing','Listing & FAQ','seo','Thông tin thật, phụ kiện đi kèm, shipping và đổi trả.','report',['economics']),
    step('creative','Kịch bản & banner','creative','Một bản concept, ba hook, brief UGC và hai hướng banner.','report',['listing']),
    step('handoff','Kế hoạch test nhỏ','ads','Các biến giữ cố định, ngân sách do người phụ trách quyết định, tiêu chí dừng.','report',['creative'])]},
  {id:'creative-batch',model:'either',title:'Creative: UGC, video & banner',description:'Từ brief đã duyệt đến file thật được kiểm tra.',steps:[
    step('brief','Góc tiếp cận & thông điệp','ads','Brief theo dữ kiện, đúng sản phẩm và quyền sử dụng.'),
    step('script','Kịch bản UGC','creative','Kịch bản, shot list, mode creator/AI/demo; không tạo testimonial giả.','report',['brief']),
    step('banner','Concept banner','creative','Hai concept; 1:1, 4:5, 9:16 là tỷ lệ làm việc, cần duyệt placement.','report',['brief']),
    step('media','Kiểm tra file xuất thật','creative','Tải file PNG/JPEG/MP4 lên dự án, khai báo data.asset_ids và data.media_brief.','media',['script','banner']),
    step('handoff','Bộ thử nghiệm creative','ads','Gắn đúng hash file đã duyệt, audience, offer và biến cần thử. Không tự chạy ads.','report',['media'])]},
  {id:'ads-learning',model:'either',title:'Quảng cáo: học từ kết quả',description:'Đọc số liệu, xác định vấn đề và chuẩn bị vòng test tiếp theo.',steps:[
    step('evidence','Đối chiếu số liệu','ads','Nguồn, tiền tệ, timezone, cửa sổ attribution và mẫu số.'),
    step('economics','Đối chiếu lãi','ads','Chi phí kế hoạch trong data.costs; phân biệt với lãi đã thực hiện.','economics',['evidence']),
    step('hypothesis','Đề xuất sửa creative','creative','Một giả thuyết có căn cứ, biến giữ cố định, một bản thử.','report',['economics']),
    step('handoff','Quyết định test tiếp','ads','Đề xuất giữ/sửa/dừng; ghi rủi ro và giới hạn dữ liệu.','report',['hypothesis'])]},
  {id:'customer-feedback',model:'either',title:'Hậu mãi: phản hồi thành cải tiến',description:'Phân loại nguyên nhân, chuẩn bị trả lời và chuyển về sản phẩm/nội dung.',steps:[
    step('evidence','Tổng hợp phản hồi','csat','Loại dữ liệu cá nhân không cần thiết; phân biệt phản hồi và suy đoán.'),
    step('cause','Phân loại nguyên nhân','csat','Sản phẩm, thông tin quảng cáo hay vận chuyển; chứng cứ cho từng nhóm.','report',['evidence']),
    step('reply','Phản hồi nháp','csat','Trả lời theo policy; không tự hứa hoàn tiền, gửi lại hoặc ngày giao.','report',['cause']),
    step('improve','Bàn giao cải tiến','gtm','Danh sách việc cho sản phẩm, supplier và creative theo nguyên nhân đã xác minh.','report',['reply'])]}
];
export function getWorkflow(name) {
  const w = WORKFLOWS.find(x => x.id === name); if (!w) throw new Error('Unknown workflow'); return structuredClone(w);
}
export function validatePlan(w) {
  const done = new Set();
  for (const j of w.steps) {
    if (done.has(j.id) || !ROLES[j.role] || !j.after.every(d => done.has(d))) throw new Error('Invalid workflow dependency graph');
    done.add(j.id);
  }
  return w;
}
for (const w of WORKFLOWS) validatePlan(w);
export const SOURCES = {
  gtm:['profiles/pod-ecommerce/roles/gtm-engineer.md'],
  pod:['skills/pod-workbench/SKILL.md'],
  dropship:['skills/dropship-workbench/SKILL.md'],
  creative:['skills/commerce-creative-studio/SKILL.md'],
  seo:['profiles/pod-ecommerce/roles/seo-agent.md'],
  ads:['profiles/pod-ecommerce/roles/ad-manager-agent.md'],
  csat:['profiles/pod-ecommerce/roles/customer-satisfaction-agent.md']
};
