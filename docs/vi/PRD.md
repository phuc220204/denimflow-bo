# PRD — DenimFlow BO

Phiên bản 0.1 (bản nháp) · 2026-10-16 · Ngôn ngữ: VI (bản dịch) · Bản chuẩn: `docs/en/PRD.md`
Nguồn nghiệp vụ: `docs/reference/` (Proposal V2.0, Appendix). Đối chiếu từng rule: `BUSINESS_RECONCILIATION.md`.

## 1. Tóm tắt

DenimFlow BO là hệ thống Back Office nội bộ của xưởng gia công quần Jean. Hệ thống quản lý toàn bộ vòng đời một đơn gia công (chọn vải–màu, BOM và phân bổ, cắt, may, nhuộm, giặt, hoàn thiện, QC, đóng gói, bàn giao) và chạy trên **Dynamic Workflow**: chuỗi công đoạn là dữ liệu có phiên bản do Process Engineer cấu hình, không phải logic viết cứng trong code.

## 2. Vấn đề và mục tiêu

Vấn đề của xưởng jeans: quy trình mỗi sản phẩm một khác và hay đổi; chọn sai vải–màu làm hỏng cả lô; quản lý không thấy được work in progress; lỗi không truy ngược được về lô vải, công đoạn và người làm.

Mục tiêu (thế nào là thành công):

1. Đổi quy trình bằng cấu hình: thêm, bớt, sắp xếp lại step và publish version mới mà không cần release code.
2. Mỗi đơn chạy trên đúng một quy trình có phiên bản (snapshot lúc Confirm); sửa template sau đó không ảnh hưởng đơn đang chạy.
3. Có gate giữa các step: step sau chỉ mở khi đủ số lượng, đủ minh chứng cần thiết và QC đạt.
4. Biết mỗi lô đang ở đâu và bao nhiêu sản phẩm đạt, lỗi, làm lại.
5. Truy vết lỗi về lô vải, công đoạn, người làm và thời điểm (audit trail).

Ngoài mục tiêu: thanh toán, báo giá, đặt cọc, tích hợp vận chuyển, app dành cho khách, kế toán/lương, loại quần áo khác, CAD/thiết kế rập, ngôn ngữ scripting cho workflow.

## 3. Phạm vi

| Trong phạm vi | Ngoài phạm vi |
|---|---|
| Một loại sản phẩm (jeans), nhiều Style và size | Các loại quần áo khác |
| Từ nhận đơn đến bàn giao (giai đoạn BO gia công) | Sản xuất vải, thiết kế rập |
| Thiết kế template, versioning, gán theo Style | Viết script tự do cho workflow |
| WIP theo bundle, số lượng đạt/lỗi/làm lại, audit log, dashboard | Lương, nhân sự, kế toán |
| Tên khách/brand dạng văn bản tham chiếu trên đơn | Thanh toán online, tích hợp vận chuyển |

## 4. Người dùng và phân quyền (RBAC)

| Role | Trách nhiệm chính |
|---|---|
| ADMIN | Tài khoản, role, catalog (Style, Fabric, Color, Matrix), AuditLog |
| PROCESS_ENGINEER | Workflow template, publish, ngưỡng QC Profile, duyệt thay đổi runtime (sau MVP) |
| PRODUCTION_PLANNER | Tạo/Confirm đơn, vải–màu, BOM, chia batch, xử lý ngoại lệ |
| WAREHOUSE_KEEPER | Lô vải, phân bổ, xuất vật tư, hỗ trợ kiểm vải |
| STATION_OPERATOR | Làm việc trên worklist của trạm mình: start/complete, nhập số lượng, minh chứng |
| QC_INSPECTOR | Kiểm tra, Pass/Rework/Reject, ghi lỗi |
| MANAGER | Chỉ xem dashboard và báo cáo |

Ma trận quyền (✔ = được làm, 👁 = được xem):

| Quyền | ADM | PE | PLN | WK | OP | QC | MGR |
|---|---|---|---|---|---|---|---|
| Quản lý user, catalog, Fabric–Color Matrix | ✔ | | | | | | |
| Thiết kế / publish workflow template | | ✔ | | | | | |
| Cấu hình ngưỡng QC Profile | | ✔ | | | | | |
| Tạo / sửa / Confirm đơn sản xuất | | | ✔ | | | | |
| Chọn vải–màu, tính BOM | | | ✔ | | | | |
| Quản lý lô vải, phân bổ vật tư | | | 👁 | ✔ | | | |
| Start / complete step, nhập số lượng (trạm của mình) | | | | | ✔ | | |
| Kiểm QC, quyết định Pass/Rework/Reject | | | | | | ✔ | |
| Ghi nhận giấy xác nhận của khách | | | ✔ | | | | |
| Đóng gói và bàn giao | | | ✔ | | | | |
| Dashboard / báo cáo | 👁 | 👁 | 👁 | | | | ✔ |
| Xem AuditLog | ✔ | | | | | | 👁 |

Phân tách nhiệm vụ (BR-11): Process Engineer không được xác nhận hoàn thành step sản xuất; người thực hiện một step không được duyệt QC của step đó.

## 5. Functional requirement MVP và tiêu chí chấp nhận

MVP = 14 FR. Danh sách đầy đủ và trạng thái: `BUSINESS_RECONCILIATION.md` §5. Các phần tối thiểu của FR-03, FR-28, FR-29 được đưa vào vì BR-06/18/19 là bắt buộc.

| FR | Tiêu chí chấp nhận (Given / When / Then) |
|---|---|
| **FR-01** Đăng nhập, RBAC | Given user Supabase hợp lệ có profile đang active, when đăng nhập, then web chỉ hiện menu của role đó. Given không có/sai token, API trả 401. Given sai role, API trả 403. Given profile bị vô hiệu hoá, API trả 403. Role được đọc từ `profiles`, không đọc từ metadata của token. |
| **FR-02** Master data | Admin tạo/sửa Style, FabricType, ColorOption và bật/tắt các ô của Fabric–Color Matrix. Code là duy nhất. Dòng đang được tham chiếu không xoá được. Mỗi lần ghi tạo một dòng AuditLog. |
| **FR-04** Sửa template | Process Engineer dựng template DRAFT: step (type, role/station, bắt buộc, requiresEvidence, requiresQc, condition, maxRework), transition (normal/rework). Version không còn DRAFT thì không sửa được. |
| **FR-05** Validate, publish, gán | Publish chạy BR-01 và liệt kê mọi vi phạm kèm step; không hợp lệ ⇒ không thay đổi gì. Hợp lệ ⇒ version PUBLISHED, version cũ RETIRED, mỗi template chỉ có một PUBLISHED. Template gán được làm mặc định cho Style. |
| **FR-07** Tạo và Confirm đơn | Planner tạo bản DRAFT (Style, size line, hạn giao, các cờ). Confirm thất bại nếu dữ liệu chưa đủ hoặc Style chưa có template PUBLISHED (BR-03). Confirm là **atomic**: đơn CONFIRMED, Workflow Instance và mọi Step Instance được tạo, ORDER_CONFIRM DONE, step đầu READY, ghi AuditLog; lỗi ở bất kỳ bước nào thì không để lại dữ liệu dở dang. |
| **FR-08** Vải–màu | Lựa chọn màu bị giới hạn theo matrix của loại vải đã chọn; API từ chối cặp khác (BR-04). Các trường bị khoá khi CUTTING bắt đầu (BR-05). |
| **FR-09** BOM, phân bổ, Material Request | BOM tính từ size line và định mức. Warehouse Keeper phân bổ từ các lô mà không vượt số mét còn lại (kể cả khi chạy đồng thời). Thiếu thì tạo Material Request. CUTTING bị chặn cho đến khi dòng vải được phân bổ đủ (BR-06). |
| **FR-11** Instance và gate | Step chỉ mở khi các step trước DONE/SKIPPED và mọi Gate đạt (BR-14). Condition sai làm step thành SKIPPED. Sửa template sau Confirm không làm đổi instance. |
| **FR-12** Worklist | Operator chỉ thấy các step READY/IN_PROGRESS/REWORK của trạm mình; Start và Complete được kiểm tra role, station và ghi audit. |
| **FR-13** Số lượng | Operator nhập số lượng đạt/lỗi theo bundle (hoặc theo size ở bước cắt). BR-08 và BR-07 được thực thi; hai lần nhập song song không thể vượt tổng cho phép. Nhuộm/wash thuê ngoài cần đối soát gửi–nhận (BR-09). |
| **FR-16** QC | Inspector ghi cỡ mẫu, lỗi, % co rút và mức phai màu đo được. Hệ thống so với ngưỡng QC Profile của đơn và đề xuất Pass/Rework/Reject; inspector quyết định. Inspector không duyệt QC cho step do chính mình thực hiện (BR-11). |
| **FR-17** Rework | Rework/Reject bắt buộc có step đích và lý do; `reworkCount` tăng; vượt `maxRework` thì đơn được gắn cờ cho Planner (BR-10). |
| **FR-21** Dashboard | Manager/Planner xem đơn theo trạng thái, số WIP theo step, tổng đạt/lỗi/làm lại, đơn đang chờ QC. Số liệu khớp với database. |
| **FR-26** Đóng gói và bàn giao | Sau khi FINAL_QC đạt, tạo packing list theo size và biên bản bàn giao ghi rõ QC Profile đã dùng; đơn thành COMPLETED khi step cuối DONE. |

Phần tối thiểu:

- **FR-03 (chỉ lô vải):** tạo/liệt kê lô vải với số mét còn lại.
- **FR-28 (dữ liệu + chọn):** hai QC Profile cho mỗi Style (`FULL_PROCESS`, `SKIP_CLEAN_WASH`) kèm ngưỡng; đơn dùng profile được chọn lúc Confirm.
- **FR-29:** khi `skipCleanWash = true`, Confirm bị chặn tới khi đính kèm file giấy xác nhận có chữ ký (Storage private); CLEAN_WASH thành SKIPPED kèm một dòng AuditLog (BR-18).

Hoãn (ngoài MVP): FR-06, FR-10 (Hold/Cancel), FR-14 (stretch), FR-18 (tuỳ chọn), FR-19/20 (đổi runtime), FR-22, FR-23, FR-24, FR-25 (tuỳ chọn), FR-27 (nhánh custom). Xem `BUSINESS_RECONCILIATION.md` §5 và §7 (R-04, R-10, R-12).

## 6. Kịch bản demo (nghiệm thu toàn bộ MVP)

Seed: Style `JN-SLIM-01`; vải `DN-12-RIGID` (12 oz, rigid); màu Indigo và Black được phép, Grey không được phép; loại wash "Stone wash"; một lô vải đủ số mét; template "Jean Standard" ở trạng thái PUBLISHED; QC Profile với ngưỡng **placeholder để demo** (FULL_PROCESS: co rút ≤ 3,0 %, phai màu ≤ 1; SKIP_CLEAN_WASH: co rút ≤ 5,0 %, phai màu ≤ 2).

1. **Process Engineer** cho xem template đã publish và thử publish một bản hỏng (có step mồ côi): hệ thống liệt kê các vi phạm.
2. **Planner** tạo đơn 100 cái (size 28/30/32/34), wash = Stone wash, chọn vải `DN-12-RIGID`; Grey không hiện ra; chọn Indigo; BOM xuất hiện.
3. **Warehouse Keeper** phân bổ từ lô; đơn thứ hai cho thấy trường hợp thiếu vải và Material Request.
4. **Planner** bấm Confirm: instance với đủ các step xuất hiện; EMBROIDERY, DYEING, FABRIC_INSPECT, PP_SAMPLE bị SKIPPED theo condition.
5. **Operator** chạy CUTTING (nhập vượt dung sai bị từ chối, BR-07), SEWING (số lượng lớn hơn số đã cắt bị từ chối, BR-08), EFFECT_WASH, CLEAN_WASH, FINISHING.
6. **QC Inspector** kiểm FINAL_QC: lần đầu kết quả REWORK quay về FINISHING (có ghi lý do); sau khi làm lại, PASS.
7. **Planner** tạo packing và bàn giao (hiện `FULL_PROCESS`); đơn COMPLETED.
8. **Biến thể:** đơn thứ hai với `skipCleanWash = true`: Confirm bị chặn tới khi upload giấy xác nhận; CLEAN_WASH bị SKIPPED; cùng số đo (co rút 4,0 %, phai màu 2) ĐẠT theo `SKIP_CLEAN_WASH` nhưng KHÔNG đạt theo `FULL_PROCESS`.
9. **Manager** mở dashboard; **Admin** cho xem chuỗi AuditLog của đơn.

## 7. Yêu cầu phi chức năng

| Khía cạnh | Yêu cầu |
|---|---|
| Chi phí | Chi phí hosting = 0 (chỉ dùng free tier) |
| Hiệu năng | Các API thông thường dưới khoảng 1 giây khi đã "thức" (giả định; đo ở S0). Chấp nhận cold start của host API miễn phí (~1 phút) và giảm nhẹ bằng keep-alive ping |
| Quy mô | Xưởng nhỏ: hàng chục user, hàng trăm đơn. Không cần scale ngang |
| Toàn vẹn | Thay đổi nhiều dòng phải nằm trong transaction; bảo toàn số lượng khi đồng thời; AuditLog append-only |
| Bảo mật | JWT cho mọi request; RBAC; RLS deny-all; bucket file private với signed URL; không có secret trong repo (repo public) |
| Khả dụng | Màn hình operator ít thao tác và chạy tốt trên màn hình cỡ tablet; hỗ trợ Chrome/Edge bản mới |
| Bảo trì | Modular Monolith; engine thuần và có unit test; docs song ngữ và luôn đồng bộ |
| i18n | Giao diện bằng tiếng Việt (quyết định D8); chuỗi vẫn nằm trong dictionary. Bảng thuật ngữ: `docs/design/DESIGN.md` |
| Backup | Free tier không bảo đảm rõ về backup: giữ migration và seed trong git và có script export trước buổi demo cuối |

## 8. Ràng buộc và giả định

- Free tier (kiểm tra lại trên trang của nhà cung cấp trước khi dựa vào các con số): Render free web service ngủ sau 15 phút không có traffic (~1 phút cold start); Supabase free project bị pause sau khoảng một tuần không hoạt động và có hạn mức DB/storage nhỏ; hosting static của Cloudflare dư dùng cho app này.
- Team làm việc qua PR trên repo public; không được commit dữ liệu khách hàng thật.
- Các giả định Q1–Q19 của Appendix được theo dõi ở `BUSINESS_RECONCILIATION.md` §6.

## 9. Kế hoạch phát hành

| Sprint | Kết quả |
|---|---|
| S0 | Walking skeleton đã deploy (web → API → DB → Auth), CI |
| S1 | Đăng nhập, RBAC, master data, Matrix, dữ liệu QC Profile |
| S2 | Engine core, template designer, validation, publish |
| S3 | Tạo/Confirm đơn/snapshot, BOM, phân bổ |
| S4 | Worklist, số lượng, Gate, phân tách nhiệm vụ |
| S5 | QC, rework, bàn giao, dashboard, demo E2E |

Chi tiết: `.agents/tasks/`.

## 10. Quyết định còn mở

Theo dõi trong `PROJECT_STATE.md` (O1 deadline, O2 Cloudflare Pages hay Workers, O4 step song song, O5 custom/Hold/Cancel, O6 minh chứng, O7 số QC).

## 11. Thuật ngữ

| Thuật ngữ | Ý nghĩa |
|---|---|
| **BO (Back Office)** | Hệ thống nội bộ dùng bởi nhân viên xưởng, không dành cho người mua lẻ |
| **Dynamic Workflow** | Chuỗi công đoạn lưu dưới dạng dữ liệu có phiên bản thay vì viết cứng trong code |
| **Workflow Template / Version** | Quy trình tham chiếu cho một nhóm Style / một phiên bản bất biến của nó |
| **Workflow Instance / Step Instance** | Lần chạy thực tế của template cho một đơn / lần chạy của một step |
| **Snapshot** | Lúc Confirm, đơn "ghim" version PUBLISHED; sửa template về sau không ảnh hưởng |
| **Condition** | Quy tắc quyết định step có chạy hay không (ví dụ chỉ chạy nếu đơn có wash) |
| **Gate (gatekeeper)** | Các điều kiện phải đúng trước khi step sau mở (đủ số lượng, minh chứng, QC đạt) |
| **BOM (Bill of Materials)** | Nhu cầu vật tư của đơn: vải, chỉ, nút, đinh tán, khoá kéo, nhãn, bao bì |
| **Material Request** | Yêu cầu mua vật tư còn thiếu |
| **Bundle** | Một nhóm bán thành phẩm đã cắt, có gắn tag, đi cùng nhau qua chuyền |
| **WIP** | Work in progress: hàng đang sản xuất dở dang |
| **CMT (Cut, Make, Trim)** | Mô hình gia công: xưởng cắt và may hàng theo đơn của khách |
| **AQL** | Acceptance Quality Limit: ngưỡng chất lượng chấp nhận được theo lấy mẫu |
| **Fabric_Inspect (FABRIC_INSPECT)** | Kiểm vải đầu vào và thử co rút trước khi cắt |
| **PP Sample (PP_SAMPLE)** | Mẫu tiền sản xuất, được duyệt trước khi cắt |
| **Effect wash** | Wash tạo hiệu ứng (stone, mài rách) |
| **Clean wash (giặt sạch)** | Lần giặt ổn định co rút và phai màu để khách không thấy khác biệt lần giặt đầu; mặc định bật, bỏ qua được khi khách yêu cầu |
| **QC Profile** | Bộ ngưỡng QC cuối theo Style: `FULL_PROCESS` hoặc `SKIP_CLEAN_WASH` |
| **Customer acknowledgement** | Giấy xác nhận có chữ ký của khách, bắt buộc khi bỏ qua clean wash (BR-19) |
| **Rework loop** | QC trả đơn về một step; bị giới hạn bởi `maxRework` |
| **RBAC** | Phân quyền dựa trên role |
| **AuditLog** | Bản ghi append-only: ai đã đổi gì và khi nào |
