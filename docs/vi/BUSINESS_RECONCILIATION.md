# BUSINESS_RECONCILIATION — DenimFlow BO

Phiên bản 0.1 · 2026-10-16 · Ngôn ngữ: VI (bản dịch) · Bản chuẩn: `docs/en/BUSINESS_RECONCILIATION.md`

## 1. Mục đích và thứ tự ưu tiên

File này đối chiếu **ý định nghiệp vụ** (Proposal V2.0 và Appendix, nằm trong `docs/reference/`) với **việc triển khai**: với mỗi business rule và requirement, file ghi rõ rule được thực thi ở đâu, thuộc module nào, sprint nào và trạng thái hiện tại. File cũng ghi lại mọi chỗ triển khai diễn giải hoặc lệch khỏi Proposal (§7).

Thứ tự ưu tiên khi các nguồn mâu thuẫn: `docs/reference` (ý định) → file này (cách diễn giải đã thống nhất) → `PRD.md` → code. Mâu thuẫn không bao giờ được tự ý chọn một bên: hỏi owner, rồi thêm một dòng vào §7.

Giá trị trạng thái: `TODO`, `IN PROGRESS`, `DONE`, `DEFERRED` (ngoài MVP, có chủ đích), `DEVIATION` (triển khai khác Proposal, xem §7).

## 2. Business rules (BR-01 .. BR-19)

"Layer" = nơi thực thi rule: **E** engine (`packages/engine`), **A** API service, **D** ràng buộc/trigger của database, **W** web (chỉ để hỗ trợ UX, không bao giờ là nơi thực thi duy nhất).

| ID | Rule | Layer | Module | Sprint | Trạng thái |
|---|---|---|---|---|---|
| BR-01 | Chỉ publish template hợp lệ: đúng một step bắt đầu, có step kết thúc, mọi step đều có đường tới step kết thúc, không có step mồ côi, mọi rework loop đều có giới hạn số lần lặp | E, A (publish), W (preview) | workflow | S2 | XONG |
| BR-02 | Version là bất biến. Sửa template tạo version mới; template đang có đơn chạy chỉ được vô hiệu hoá, không được xoá | A, D (trigger + partial unique index) | workflow | S2 | XONG |
| BR-03 | Khi Confirm, snapshot version PUBLISHED của Style; Style chưa có template PUBLISHED thì không Confirm được | A, E | order | S3 | XONG |
| BR-04 | Chỉ được chọn màu nằm trong Fabric–Color Matrix của loại vải đã chọn | A, D (dữ liệu), W (lọc) | order, catalog | S1 dữ liệu / S3 | XONG |
| BR-05 | Khi step CUTTING bắt đầu, vải–màu–wash bị khoá. Muốn đổi cần BR-13 hoặc huỷ đơn | A | order | S3 (khoá có hiệu lực từ S4) | XONG |
| BR-06 | Không được bắt đầu CUTTING nếu vải chưa được phân bổ đủ theo BOM | E (Gate) | inventory, execution | S3–S4 | XONG |
| BR-07 | Tổng số lượng cắt theo từng size không vượt kế hoạch + dung sai đã cấu hình | E, A | execution | S4 | XONG |
| BR-08 | Bảo toàn số lượng: số lượng vào step sau ≤ số lượng đạt của step trước; phần chênh lệch phải khớp với lỗi hoặc hao hụt đã ghi nhận | E, A, D (row lock + CHECK) | execution | S4 | XONG |
| BR-09 | Nhuộm/wash thuê ngoài: số lượng nhận về phải đối soát với số lượng gửi đi; lệch thì phải có lý do | A | execution | S4 | XONG |
| BR-10 | QC Fail/Rework phải chọn step quay về và ghi lý do. Vượt số vòng rework tối đa thì giao cho Planner | E, A | quality | S5 | TODO |
| BR-11 | Phân tách nhiệm vụ: người thực hiện step không được duyệt QC của step đó; Process Engineer không được xác nhận hoàn thành các step sản xuất | A | execution, quality | S4 / S5 | MỘT PHẦN (Process Engineer nhận BR-11 khi làm step sản xuất, T4.2/T4.5; hàm kiểm tra người thực hiện `assertNotPerformer` đã sẵn, áp vào quyết định QC ở T5.1) |
| BR-12 | Huỷ đơn cần lý do. Trước CUTTING thì giải phóng mọi allocation; từ CUTTING trở đi phải ghi nhận vải đã cắt và chi phí | A | order | sau MVP (FR-10) | DEFERRED |
| BR-13 | Đổi workflow khi đang chạy: chỉ được chèn/bỏ qua step chưa bắt đầu, không được bỏ step bắt buộc, cần Process Engineer duyệt | E, A | workflow, execution | sau MVP (FR-19/20) | DEFERRED |
| BR-14 | Gatekeeper: một step chỉ mở khi mọi step trước đã hoàn thành và các Gate đều đạt | E | execution | S4 | XONG |
| BR-15 | Step cấu hình "cần minh chứng" không được hoàn thành nếu chưa có ≥ 1 file đính kèm | E (Gate), A | execution | S4 (cùng FR-14, stretch) | TODO |
| BR-16 | Mọi chuyển trạng thái, thay đổi workflow và lần nhập số lượng đều ghi AuditLog (ai, khi nào, giá trị cũ, giá trị mới); AuditLog không được sửa hay xoá | A (cùng transaction), D (trigger append-only) | audit | nền móng S0, mọi sprint | XONG |
| BR-17 | Đơn có yêu cầu custom phải qua nhánh CUSTOM_REVIEW: đánh giá khả thi (từ chối nếu bất khả thi); nếu khả thi thì clone template gần nhất thành workflow riêng, kiểm tra (BR-01), Process Engineer duyệt, thay thế snapshot; bắt buộc duyệt mẫu trước khi cắt | A, E | workflow, order | sau MVP (FR-27) | DEFERRED (xem R-04) |
| BR-18 | Giặt sạch (clean wash) chạy mặc định. Chỉ được bỏ qua khi khách yêu cầu để giảm giá; Planner ghi lý do và xác nhận của khách, step chuyển SKIPPED và ghi AuditLog; QC cuối khi đó dùng SKIP_CLEAN_WASH | A, E | order, execution | S3 | XONG |
| BR-19 | Mỗi Style có hai QC Profile (FULL_PROCESS, SKIP_CLEAN_WASH) với ngưỡng co rút và phai màu riêng, do Process Engineer cấu hình. Đơn có `skipCleanWash = true` chỉ được Confirm khi đã đính kèm giấy xác nhận có chữ ký của khách; QC cuối và biên bản bàn giao dùng SKIP_CLEAN_WASH, ngược lại dùng FULL_PROCESS. Đổi quyết định bỏ qua sau Confirm là thay đổi runtime (BR-13) và cần giấy xác nhận mới | A, E, W | order, quality | dữ liệu S1, Confirm S3, QC S5 | XONG (Lát cắt Confirm XONG) |

## 3. Template workflow mặc định "Jean Standard"

Bảng này là đặc tả của seed data (`prisma/seed.ts`). Step type, condition và cờ QC là **đề xuất** (R-06, R-07, R-09); cần xác nhận với owner nếu mâu thuẫn với thực tế xưởng.

Tên role theo enum `Role` trong `DATABASE_DESIGN.md` §5. Condition dùng JSON AST (R-09); bảng ghi dạng dễ đọc.

| # | Code | Công đoạn | stepType | Role / station chịu trách nhiệm | Bắt buộc | Chạy khi (condition) | requiresQc | Gate để tính là hoàn thành |
|---|---|---|---|---|---|---|---|---|
| 1 | ORDER_CONFIRM | Nhận và xác nhận đơn | APPROVAL | PRODUCTION_PLANNER | có | luôn luôn | không | Đủ Style, dải size, số lượng, hạn giao; biết đơn có custom hay không; đã đính kèm giấy xác nhận nếu `skipCleanWash` (BR-19) |
| C | CUSTOM_REVIEW | Nhánh custom: đánh giá khả thi, tạo workflow riêng | APPROVAL | PRODUCTION_PLANNER + PROCESS_ENGINEER | không | `isCustom` (sau MVP, R-04) | không | Khả thi và workflow riêng đã được duyệt (BR-17) |
| 2 | FABRIC_COLOR_SELECT | Chọn vải và màu | SELECTION | PRODUCTION_PLANNER | có | luôn luôn | không | Cặp vải–màu hợp lệ theo matrix (BR-04) |
| 3 | BOM_ALLOCATE | Tính BOM và phân bổ vật tư | MATERIAL | PRODUCTION_PLANNER + WAREHOUSE_KEEPER | có | luôn luôn | không | Phân bổ đủ hoặc đã có Material Request |
| 4 | FABRIC_INSPECT | Kiểm vải đầu vào / thử co rút | QC | QC_INSPECTOR | không | `fabricInspectRequired` | không | Độ co rút trong ngưỡng |
| 5 | PP_SAMPLE | Duyệt mẫu tiền sản xuất | APPROVAL | PRODUCTION_PLANNER + QC_INSPECTOR | không | `ppSampleRequired` (bắt buộc khi `isCustom`) | không | Mẫu được duyệt |
| 6 | CUTTING | Trải vải và cắt | PRODUCTION | STATION_OPERATOR / CUTTING | có | luôn luôn | không | Số lượng cắt theo size trong kế hoạch + dung sai (BR-07); đã gắn tag bundle |
| 7 | EMBROIDERY | Thêu / in | PRODUCTION | STATION_OPERATOR / EMBROIDERY | không | `embroideryRequired` | không | Đủ số lượng |
| 8 | SEWING | May | PRODUCTION | STATION_OPERATOR / SEWING | có | luôn luôn | có (in-line) | Số lượng may ≤ số lượng cắt (BR-08); qua kiểm tra in-line |
| 9 | DYEING | Nhuộm | PRODUCTION | STATION_OPERATOR / DYEING | không | `dyeRequired` | không | Nhận về đủ số lượng; màu khớp chuẩn; vùng nhuộm cục bộ đúng (BR-09 nếu thuê ngoài) |
| 10 | EFFECT_WASH | Wash hiệu ứng (giặt mài) | PRODUCTION | STATION_OPERATOR / WASH | không | `washTypeId` được chọn | không | Nhận về đủ số lượng; hiệu ứng khớp mẫu |
| 11 | CLEAN_WASH | Giặt sạch | PRODUCTION | STATION_OPERATOR / WASH | không (có thể bỏ qua) | KHÔNG `skipCleanWash` | không | Khi chạy: đủ số lượng, co rút và phai màu trong ngưỡng; khi bỏ qua: SKIPPED + AuditLog (BR-18) |
| 12 | FINISHING | Hoàn thiện (cắt chỉ, ủi, gắn nhãn, nút) | PRODUCTION | STATION_OPERATOR / FINISHING | có | luôn luôn | không | Đủ số lượng; có minh chứng nếu bật (BR-15) |
| 13 | FINAL_QC | QC cuối | QC | QC_INSPECTOR | có | luôn luôn | n/a (chính là đợt kiểm) | Đạt AQL và ngưỡng của QC Profile của đơn (BR-19) |
| 14 | PACK_HANDOVER | Đóng gói và bàn giao | PRODUCTION | PRODUCTION_PLANNER (đóng gói) | có | luôn luôn | không | Đủ số lượng đạt; đã lập biên bản bàn giao |

Transition: tuần tự theo `seq`, bỏ qua step có condition sai. Transition rework (`kind = REWORK`) từ FINAL_QC quay về SEWING, CLEAN_WASH (nếu có chạy) hoặc FINISHING; step đích mang `maxRework` (seed mặc định 2).

Đề xuất cho nhuộm (từ Proposal, mục 5): `dyeMode = TOTAL` → mặc định `dyeSource = OUTSOURCED`; `dyeMode = PARTIAL` → mặc định `INTERNAL`. Planner có thể đổi theo từng đơn.

## 4. State machine

### ProductionOrder

| State | Ý nghĩa | Chuyển tiếp được phép |
|---|---|---|
| DRAFT | Planner đang nhập dữ liệu | CONFIRMED (BR-03, BR-19) |
| CONFIRMED | Đã snapshot, chờ vào sản xuất | IN_PRODUCTION (khi CUTTING bắt đầu), ON_HOLD, CANCELLED |
| IN_PRODUCTION | Các step đang chạy | COMPLETED (step cuối xong), ON_HOLD, CANCELLED |
| ON_HOLD | Tạm dừng (thiếu vật tư, chờ khách) | Quay lại state trước đó, CANCELLED |
| COMPLETED | Đã đóng gói và bàn giao | trạng thái cuối |
| CANCELLED | Đã huỷ kèm lý do (BR-12) | trạng thái cuối |

MVP triển khai DRAFT → CONFIRMED → IN_PRODUCTION → COMPLETED. ON_HOLD và CANCELLED có trong enum và bảng state nhưng use-case của chúng thuộc sau MVP (FR-10).

### StepInstance

| State | Ý nghĩa | Chuyển tiếp được phép |
|---|---|---|
| PENDING | Chưa đến lượt | READY (các step trước xong và Gate đạt, BR-14), SKIPPED (condition sai hoặc BR-18) |
| READY | Hiện trên worklist của trạm | IN_PROGRESS (Start) |
| IN_PROGRESS | Đang nhập số lượng/minh chứng | WAITING_QC (step cần QC) hoặc DONE (đã thoả BR-15) |
| WAITING_QC | Chờ QC Inspector | DONE (đạt), REWORK (fail/rework, BR-10) |
| REWORK | Đang làm lại | IN_PROGRESS; vượt `maxRework` thì Planner xử lý |
| DONE | Hoàn thành | mở các step tiếp theo |
| SKIPPED | Bỏ qua | được tính là đã xong khi đánh giá Gate, nhưng chỉ là "đi xuyên qua": step trước nó vẫn phải hoàn thành (R-17) |

Diễn giải cho step loại QC (R-06): với `stepType = QC`, quyết định của đợt kiểm *chính là* việc hoàn thành step. PASS ⇒ DONE. REWORK ⇒ step đích được chọn chuyển sang REWORK (`reworkCount` + 1), step QC quay về PENDING và chạy lại sau khi step đích hoàn thành. REJECT ⇒ đơn được gắn cờ cho Planner.

## 5. Truy vết functional requirement (FR-01 .. FR-29)

MVP = 14 FR của Proposal. Mục đánh dấu ◐ là **phần tối thiểu** được kéo vào MVP vì có BR bắt buộc phụ thuộc (R-11).

| FR | Module | Chức năng | Ưu tiên | Trong MVP | Sprint / task | Trạng thái |
|---|---|---|---|---|---|---|
| FR-01 | Auth & Master Data | Đăng nhập, RBAC | MVP | ✔ | S1 T1.1–T1.2 (nền móng S0) | XONG |
| FR-02 | Auth & Master Data | Style, FabricType, ColorOption, Fabric–Color Matrix | MVP | ✔ | S1 T1.3–T1.4 | XONG |
| FR-03 | Auth & Master Data | Tồn kho vải theo lô và phụ liệu | High | ◐ chỉ lô vải | S3 T3.4 | XONG |
| FR-04 | Workflow Designer | Tạo/sửa template (step, transition, condition, gate) | MVP | ✔ | S2 T2.2, T2.4, T2.5 | XONG |
| FR-05 | Workflow Designer | Validate, publish, gán cho Style | MVP | ✔ | S2 T2.3, T2.4 | XONG |
| FR-06 | Workflow Designer | Lịch sử version, vô hiệu hoá | Medium | — | sau MVP | DEFERRED |
| FR-07 | Production Order | Tạo và Confirm đơn | MVP | ✔ | S3 T3.1, T3.5 | XONG |
| FR-08 | Production Order | Chọn vải–màu lọc theo matrix | MVP | ✔ | S3 T3.2 | XONG |
| FR-09 | Production Order | BOM, phân bổ, Material Request | MVP | ✔ | S3 T3.3–T3.4 | XONG |
| FR-10 | Production Order | Hold, Resume, Cancel | High | — | sau MVP | DEFERRED |
| FR-11 | Execution Engine | Tạo instance từ snapshot, mở step theo Gate | MVP | ✔ | S2 T2.1, S3 T3.5, S4 T4.1 | XONG |
| FR-12 | Execution Engine | Worklist theo trạm, Start/Complete | MVP | ✔ | S4 T4.2 | XONG |
| FR-13 | Execution Engine | Nhập số lượng đạt/lỗi theo bundle, bảo toàn số lượng | MVP | ✔ | S4 T4.3 | XONG |
| FR-14 | Execution Engine | Đính kèm minh chứng | High | stretch | S4 T4.4 | TODO |
| FR-15 | Execution Engine | Sinh bundle và mã bundle | High | ◐ tại CUTTING | S4 T4.3 | XONG (phần ◐) |
| FR-16 | QC & Rework | QC theo checklist/AQL, kết quả Pass/Rework/Reject | MVP | ✔ | S5 T5.1 | TODO |
| FR-17 | QC & Rework | Điều hướng rework, giới hạn vòng lặp | MVP | ✔ | S5 T5.2 | TODO |
| FR-18 | QC & Rework | Ghi nhận lỗi theo bundle | High | tuỳ chọn | S5 T5.3 | TODO |
| FR-19 | Runtime Change | Đề xuất chèn/bỏ qua step | Medium | — | sau MVP | DEFERRED |
| FR-20 | Runtime Change | Duyệt/từ chối thay đổi | Medium | — | sau MVP | DEFERRED |
| FR-21 | Tracking & Report | Dashboard WIP | MVP | ✔ | S5 T5.5 | TODO |
| FR-22 | Tracking & Report | Báo cáo tỷ lệ lỗi và thời gian chạy | Medium | — | sau MVP | DEFERRED |
| FR-23 | Tracking & Report | Truy vết theo lô vải và bundle | High | — | sau MVP | DEFERRED |
| FR-24 | Notification & Audit | Thông báo (READY, BLOCKED, QC fail) | High | — | sau MVP | DEFERRED |
| FR-25 | Notification & Audit | Xem/lọc AuditLog | High | tuỳ chọn | S5 T5.6 | DONE (Admin và Manager, chỉ xem; lọc theo loại đối tượng, mã đối tượng, người thao tác, khoảng ngày; so sánh trước/sau) |
| FR-26 | Notification & Audit | Đóng gói, packing list, biên bản bàn giao | MVP | ✔ | S5 T5.4 | TODO |
| FR-27 | Production Order | Yêu cầu custom, đánh giá khả thi, workflow riêng | High | — | sau MVP | DEFERRED |
| FR-28 | QC & Rework | Ngưỡng QC Profile theo Style, áp dụng ở QC cuối | High | ◐ | S1 T1.5, S5 T5.1 | MỘT PHẦN (lát cắt S1 XONG) |
| FR-29 | Production Order | Giấy xác nhận của khách; chặn Confirm tới khi đính kèm | High | ◐ | S3 T3.5 | XONG |

## 6. Giả định trong Appendix (Q1 .. Q19): code đang giả định thế nào

| Q | Chủ đề | Giả định đã đưa vào code | Nếu câu trả lời đổi |
|---|---|---|---|
| Q1–Q3 | Nghĩa của BO, mô hình CMT, không thương mại | Công cụ nội bộ; không thanh toán/báo giá | Không ảnh hưởng MVP |
| Q4 | Vải/màu và workflow | Matrix giới hạn màu; Condition dùng cờ của đơn | Thêm toán hạng condition (AST) |
| Q5 | Ai chọn vải–màu | Planner | Chỉ đổi quyền theo role |
| Q6 | Nguồn vải | Theo dõi theo lô; chưa mô hình hoá nguồn | Thêm `fabric_lots.source` |
| Q7 | Công đoạn sau cắt/may | 14 step ở §3 | Sửa template seed (dữ liệu, không phải code) |
| Q8 | Sub-workflow của May | Một step | Composite pattern (tuỳ chọn) |
| Q9 | Đơn vị theo dõi | Bundle | Đổi schema `bundles` |
| Q10 | Mức độ dynamic | Designer + Condition trong MVP; đổi runtime sau MVP | Làm BR-13 |
| Q11 | Song song + rework | Có rework; **song song sau MVP (R-10)** | Đổi engine: node fork/join |
| Q12 | AQL và checklist | Đơn giản hoá: cỡ mẫu + số lỗi + co rút/phai màu đo được so với profile | Thêm bảng checklist |
| Q13 | Có bắt buộc minh chứng? | Cấu hình theo step (`requiresEvidence`) | Đổi cờ trong seed |
| Q14 | Ràng buộc triển khai | Web, Modular Monolith, stack phương án B | — |
| Q15 | Tên | DenimFlow BO (đã chốt) | — |
| Q16 | Giặt sạch | Mặc định bật, bỏ qua được (BR-18) (đã chốt) | — |
| Q17 | Nhuộm | TOTAL/PARTIAL × INTERNAL/OUTSOURCED, mặc định theo Proposal (đã chốt) | — |
| Q18 | Gia công custom | Đã chốt ý định; triển khai sau MVP (R-04) | — |
| Q19 | Ngưỡng QC và người ký | Giá trị theo Style; **số placeholder để demo (R-14)**; người ký lưu dạng tên tự do | Thay giá trị seed |

## 7. Nhật ký đối chiếu (quyết định và điểm lệch)

Thêm một dòng mỗi khi triển khai diễn giải hoặc khác Proposal. Không xoá dòng; đánh dấu "superseded" nếu bị thay thế.

| ID | Ngày | Chủ đề | Quyết định | Lý do / đánh đổi | Trạng thái |
|---|---|---|---|---|---|
| R-01 | 2026-10-16 | Entity `User` | Triển khai thành `profiles` (id = id user của Supabase Auth); không lưu `passwordHash` | Supabase Auth quản lý credential; ít secret hơn trong DB của mình | Agreed |
| R-02 | 2026-10-16 | Material Request | Thêm bảng `material_requests` | FR-09 cần, nhưng data model của Proposal chưa có entity | Proposed |
| R-03 | 2026-10-16 | Số lượng theo bundle | Thêm bảng append-only `step_quantity_entries`; giữ số tổng (`qtyIn/qtyGood/qtyDefect`) trên `step_instances` | FR-13 nói theo bundle; số tổng cần cho Gate chạy nhanh | Proposed |
| R-04 | 2026-10-16 | Nhánh custom (FR-27, BR-17) | Sau MVP. `isCustom` vẫn lưu; **Confirm từ chối `isCustom = true`** kèm thông báo rõ; `ppSampleRequired` bị ép true khi `isCustom` để tương thích về sau | BR-17 là bắt buộc nên lặng lẽ bỏ qua sẽ vi phạm rule; từ chối là cách trung thực | Proposed |
| R-05 | 2026-10-16 | Step ORDER_CONFIRM | Hành động Confirm hoàn thành step ORDER_CONFIRM trong cùng transaction; step kế tiếp thành READY | Không thể làm step này từ worklist trước khi instance tồn tại | Proposed |
| R-06 | 2026-10-16 | Ngữ nghĩa step loại QC | Xem §4: quyết định của đợt kiểm hoàn thành step QC; REWORK điều hướng về step đích và step QC quay về PENDING | Bảng state của Proposal không nói bản thân step QC hoạt động ra sao | Proposed |
| R-07 | 2026-10-16 | Trường của StepDefinition | Thêm `responsibleRole`, `requiresQc`, `seq`, `isStart`, `isEnd`; `stationType` cho phép null | Step của Planner/QC không có station; worklist cần role | Proposed |
| R-08 | 2026-10-16 | Cờ của đơn | Thêm `embroideryRequired`, `fabricInspectRequired`, `ppSampleRequired`; `washType` mô hình hoá thành catalog `wash_types` + `washTypeId`; `styles.hasEmbroidery` cho giá trị mặc định | Condition cần dữ liệu tường minh; danh sách loại wash còn mở | Proposed |
| R-09 | 2026-10-16 | Định dạng condition | `conditionExpr` là **JSON AST** (jsonb) kiểm bằng Zod, không phải chuỗi biểu thức | An toàn (không `eval`), dễ validate và dễ dựng bằng UI | Proposed |
| R-10 | 2026-10-16 | Step song song (Q11) | Hoãn: engine MVP là tuần tự + condition + rework | Độ phức tạp engine lớn nhất; không cần cho demo end-to-end | Proposed |
| R-11 | 2026-10-16 | Phần tối thiểu FR-03/28/29 | Kéo vào MVP dưới dạng phần tối thiểu (xem ◐ ở §5) | BR-06, BR-18, BR-19 bắt buộc và FR-16 cần QC Profile | Proposed |
| R-12 | 2026-10-16 | BR-12, BR-13 | Hoãn cùng FR-10, FR-19, FR-20 | Không nằm trong 14 FR MVP | Proposed |
| R-13 | 2026-10-16 | BR-15 minh chứng | Gate làm ở S4; UI upload là stretch (FR-14). Seed `requiresEvidence = false` cho tới khi có UI | Tránh rule chặn hoàn thành mà không có cách đáp ứng | Proposed |
| R-14 | 2026-10-16 | Ngưỡng QC (Q19) | Seed số placeholder để demo, gắn nhãn "demo" trên UI | Số thật phụ thuộc loại vải và thực tế xưởng | Open |
| R-15 | 2026-10-16 | Tham chiếu file | Các trường `fileUrl` (giấy xác nhận, minh chứng) lưu **path** trong Storage private (`file_path`), cấp qua signed URL | URL công khai trong bucket của repo public sẽ làm lộ tài liệu | Agreed |
| R-16 | 2026-10-16 | Bảng bổ sung | Thêm `handover_records` (FR-26), `bom_norms` (dữ liệu cho BOM strategy), `wash_types` | Cần để triển khai các FR đã liệt kê | Proposed |
| R-17 | 2026-10-19 | Step trước bị bỏ qua (BR-14) | Khi xét READY, engine nhìn xuyên qua step SKIPPED tới step trước nó; step đó phải DONE (hoặc cũng bị bỏ qua) | Hiểu theo nghĩa đen "SKIPPED tính như đã xong" thì khi bỏ EMBROIDERY, SEWING được mở dù CUTTING chưa xong | Proposed |
| R-18 | 2026-10-19 | Ai được Start/Complete step (FR-12) | Đúng `responsibleRole` của step (operator thì thêm điều kiện trạm cùng `stationType`); step của Planner và QC trong template dùng chung endpoint | Ma trận trong PRD chỉ ghi operator, nhưng template giao step cho Planner và QC (R-07) | Proposed |
| R-19 | 2026-10-19 | Dung sai BR-07 | `styles.cut_tolerance_percent`, mặc định 5 %, Admin chỉnh; giới hạn mỗi size = floor(kế hoạch × (100 + dung sai) / 100), tính cả đạt lẫn lỗi | BR-07 ghi "đã cấu hình" nhưng không có con số | Agreed (owner) |
| R-20 | 2026-10-19 | Bó hàng (FR-15) | Tạo khi CUTTING hoàn thành, từ số đạt đã cắt theo từng size, mỗi bó 50, mã `{orderNumber}-B001` chạy liên tục qua các size; bước cắt phải có ít nhất một lần nhập mới hoàn thành được | Tạo bó theo kế hoạch sẽ không khớp số cắt thật | Agreed (owner) |
| R-21 | 2026-10-19 | Gia công ngoài (BR-09) | Một lần nhập là gia công ngoài khi trạm của operator có `is_outsourced`; ghi số gửi và số nhận, đạt + lỗi = nhận, nhận ≤ gửi, lệch thì phải có lý do; step tính là đã nhận số gửi đi | Step chỉ mang loại trạm, không mang trạm cụ thể | Agreed (owner) |
| R-22 | 2026-10-19 | Vòng đời lần nhập số lượng | Operator chỉ nhập khi step IN_PROGRESS; bước cắt theo size, các bước sau theo bó; hoàn thành step cần đối soát đủ số đã nhận (vế hai BR-08); nhập nhầm thì huỷ bằng một dòng bù (giá trị âm, bắt buộc lý do, mỗi dòng huỷ một lần) | Giữ R-03 append-only mà vẫn sửa được nhầm lẫn | Proposed (owner đã đồng ý cách huỷ dòng) |
| R-23 | 2026-10-19 | Ai "đã thực hiện" một step (BR-11) | Người bắt đầu (`performed_by`), người hoàn thành (`completed_by`) và mọi người đã nhập số lượng của step (`step_quantity_entries.entered_by`); không ai trong số đó được duyệt QC của step | Nhiều operator có thể cùng làm một step; chỉ kiểm tra người bắt đầu thì những người còn lại vẫn tự duyệt được | Proposed |

Các dòng "Proposed" chờ owner xác nhận; đổi thành "Agreed" hoặc viết lại.
