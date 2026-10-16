# DenimFlow BO — Prompt thiết kế UI (Stitch → Antigravity)

File này gồm: (A) quy trình, (B) khối style dán đầu mọi prompt, (C) prompt cho từng màn hình để dán vào Stitch, (D) prompt giao cho Antigravity để code theo thiết kế qua MCP của Stitch.

**Giao diện ứng dụng bằng tiếng Việt** (quyết định D8). Phần hướng dẫn của file này viết tiếng Việt; phần prompt dán vào công cụ viết **hướng dẫn bằng tiếng Anh** (công cụ sinh UI hiểu tốt hơn) nhưng **chữ hiển thị trên màn hình là tiếng Việt** trong dấu nháy kép. Token màu, font, thuật ngữ nằm ở [`DESIGN.md`](DESIGN.md), đó là nguồn chuẩn; file này chỉ chứa prompt.

> Giới hạn: tôi chưa dùng thử Stitch hay Antigravity. Phần kết nối MCP dựa trên một bài hướng dẫn bên thứ ba (agentpedia.codes); hãy đối chiếu với tài liệu chính thức của Google. Khả năng Stitch hiển thị tiếng Việt có dấu đúng hay không cũng chưa được kiểm chứng: hãy thử Prompt 0 trước (mục C).

---

## A. Quy trình đề xuất

1. **Chạy Prompt 0 (style tile) trước**, chỉnh tới khi màu, font và **dấu tiếng Việt hiển thị đúng** (ví dụ "Đơn hàng", "Đã xác nhận", "Đang sản xuất"). Nếu Stitch làm sai dấu, ghi nhận và sửa chữ bằng tay trong bước code; thiết kế chỉ là tham chiếu bố cục.
2. **Mỗi prompt màn hình đều mở đầu bằng `STYLE PREAMBLE`** (mục B). Stitch không đảm bảo nhớ ngữ cảnh giữa các lần sinh, lặp lại preamble là cách rẻ nhất để giữ đồng nhất.
3. **Sinh theo lô** (mục C), ưu tiên các luồng nằm trên đường demo: Login + App shell → Planner → Operator và QC → Process Engineer → Admin, Warehouse, Manager.
4. **Đặt `DESIGN.md` vào repo** (đã có sẵn tại `docs/design/DESIGN.md`). Nếu Stitch xuất `DESIGN.md` riêng, so sánh rồi hợp nhất, đừng để hai bản lệch nhau.
5. **Kết nối Stitch MCP vào Antigravity** (D.1), rồi giao việc từng màn hình **sau khi T0.5 (apps/web skeleton) đã merge**, vì agent cần Vite + Tailwind + shadcn/ui có sẵn để map thiết kế vào.
6. **Tinh chỉnh bằng prompt nhỏ** ("làm bảng gọn hơn", "đổi badge Làm lại sang màu cảnh báo") thay vì sinh lại cả màn hình. Một bài hướng dẫn nhắc hạn mức khoảng 350 lượt chuẩn và 50 lượt thử nghiệm mỗi tháng; hãy kiểm tra hạn mức thật trong tài khoản.

Quy tắc nội dung để mọi màn hình hợp lý về nghiệp vụ: dùng đúng vai trò, trạng thái, mã bước trong tài liệu, và đúng nhãn ở bảng thuật ngữ của `DESIGN.md`. Dữ liệu mẫu bám kịch bản demo trong PRD §6 (mã hàng `JN-SLIM-01`, vải `DN-12-RIGID`, màu Indigo và Đen). Số theo kiểu Việt Nam: `1.240`, `2,1 %`; ngày `17/10/2026`.

---

## B. `STYLE PREAMBLE` (dán ở đầu MỌI prompt màn hình)

```text
Design a desktop web screen (1440x900) for "DenimFlow BO", an internal back-office tool of a jeans subcontracting workshop. Users are office staff and shop-floor supervisors using it all day. Style: calm, professional enterprise admin UI, light theme, strictly flat. NO gradients, no glassmorphism, no glow, no decorative illustrations, no emoji, no heavy shadows. Colors: page background #F6F7F9; cards and tables #FFFFFF with 1px border #E2E5EA; primary text #1F2933; secondary text #5B6672; single brand color denim blue #2F5D8A (hover #254A70, tint #E8EFF6) used for primary buttons, links and the active sidebar item. Status colors used only for status badges (tinted background + darker text of the same hue, text label always visible): success #24694A on #E6F2EC, warning #8A5A0B on #FBF3E0, danger #8F2D2D on #F8E8E8, neutral #5B6672 on #EEF0F3. Typography: Inter with Vietnamese support, base 14px, table text 13px, page title 20px, weights 400/500/600, line-height at least 1.5 for body text, tabular numbers for quantities, monospace only for codes (JN-SLIM-01, CUTTING, PO-2026-0007). Shape: 6px radius, 1px borders, 8px spacing grid, compact tables with 40px rows and sticky header, labels above form fields. Layout: left sidebar 240px (white, border-right, active item has blue tint background) and a 56px top bar with breadcrumb, role badge and user menu. Component look: shadcn/ui. Keep it data-dense but uncluttered.
LANGUAGE: ALL visible UI text must be in Vietnamese with correct diacritics, exactly as written in quotes below. Vietnamese labels are longer than English, so do not use fixed-width buttons or badges and let table headers wrap. Numbers use Vietnamese format (1.240 and 2,1 %), dates use dd/mm/yyyy.
```

---

## C. Prompt cho từng màn hình (dán vào Stitch)

Mỗi prompt bên dưới: dán `STYLE PREAMBLE` (mục B) trước, rồi dán nội dung màn hình. Ngoại lệ là Prompt 0.

### Prompt 0 — Style tile (chạy đầu tiên)

```text
[STYLE PREAMBLE]

Create a single "style tile" screen showing the design system in use, not a real page. Section titles: "Bảng màu" (color swatches with hex values), "Kiểu chữ" (typography scale, with the sample sentence "Đơn hàng PO-2026-0007 đang sản xuất, giao ngày 30/10/2026"), "Nút" (buttons "Lưu", "Huỷ", "Xoá", plus a disabled one), "Ô nhập liệu" (input, select, textarea in normal, focus and error states, error text "Trường này là bắt buộc"), "Nhãn trạng thái" (a row of badges: "Nháp", "Đã xác nhận", "Đang sản xuất", "Chờ QC", "Làm lại", "Xong", "Bỏ qua", "Đạt", "Loại"), "Bảng dữ liệu" (small table with 4 rows and columns "Mã đơn", "Mã hàng", "Số lượng", "Trạng thái"), "Thông báo" (a toast "Đã lưu thay đổi"), "Hộp thoại" (a small confirm dialog "Bạn có chắc chắn muốn xoá?" with "Huỷ" and "Xoá"), "Trạng thái trống" (one line "Chưa có đơn hàng nào" and a button "Tạo đơn mới"). Arrange on a clean grid.
```

### Lô 1 — Nền tảng

**1.1 Đăng nhập**

```text
[STYLE PREAMBLE]

Screen: Login. Centered card (400px wide) on the page background, no sidebar. Text wordmark "DenimFlow BO" with the subtitle "Hệ thống quản lý gia công quần jean". Fields: "Email", "Mật khẩu" (with show/hide toggle). Primary full-width button "Đăng nhập". Below, muted text: "Tài khoản do quản trị viên cấp." Also show an inline error state: "Email hoặc mật khẩu không đúng". No social login, no sign-up link, no illustration.
```

**1.2 Khung ứng dụng + Trang chủ**

```text
[STYLE PREAMBLE]

Screen: App shell with a placeholder home page for the production planner role. Sidebar groups: "Sản xuất" (items "Đơn hàng", "Đóng gói và bàn giao") and "Tổng quan" (item "Bảng điều khiển"). Top bar: breadcrumb "Trang chủ", role badge "Điều độ sản xuất", user menu with "Đăng xuất". Home content: a short greeting "Xin chào, Lan", three summary cards ("Đơn nháp" 3, "Đang sản xuất" 5, "Chờ vật tư" 1) and a compact table titled "Đơn hàng gần đây" with columns "Mã đơn", "Mã hàng", "Số lượng", "Ngày giao", "Trạng thái". In a second frame or small captions show the sidebar menus of the other roles: Quản trị viên ("Người dùng", "Mã hàng", "Loại vải", "Màu", "Ma trận vải–màu", "Nhật ký kiểm toán"), Kỹ sư quy trình ("Mẫu quy trình", "Hồ sơ QC"), Thủ kho ("Lô vải", "Cấp phát", "Yêu cầu vật tư"), Công nhân trạm ("Việc của tôi"), Nhân viên QC ("Hàng chờ kiểm tra"), Quản lý ("Bảng điều khiển").
```

### Lô 2 — Điều độ sản xuất (đường demo chính)

**2.1 Danh sách đơn hàng**

```text
[STYLE PREAMBLE]

Screen: Production orders list. Page title "Đơn hàng" with primary button "Tạo đơn mới". Filter bar: search box with placeholder "Tìm theo mã đơn hoặc mã hàng", select "Trạng thái", date range "Hạn giao". Table columns: "Mã đơn" (monospace, PO-2026-0007), "Mã hàng" (JN-SLIM-01), "Vải / Màu" (DN-12-RIGID / Indigo), "Số lượng" (100), "Ngày giao", "Công đoạn hiện tại" (for example "May"), "Trạng thái" (badge), row action menu. Show 8 rows with mixed statuses "Nháp", "Đã xác nhận", "Đang sản xuất", "Hoàn tất"; one row has an extra small warning badge "Vượt giới hạn làm lại". Pagination at the bottom.
```

**2.2 Tạo / sửa đơn hàng (Nháp)**

```text
[STYLE PREAMBLE]

Screen: Create production order (draft). Single-page form in cards plus a sticky right summary panel. Page title "Tạo đơn hàng". Card "Thông tin chung": "Mã hàng" (combobox, JN-SLIM-01), "Mã tham chiếu của khách", "Ngày giao", "Kiểu giặt" (select, "Giặt đá (Stone wash)"). Card "Vải và màu": "Loại vải" select (DN-12-RIGID, 12 oz, "Không co giãn"); "Màu" select that lists only allowed colors (Indigo, Đen) with helper text "Màu Xám không khả dụng cho loại vải này." Card "Dải size": editable table with columns "Size" (28, 30, 32, 34) and "Số lượng", total row "Tổng: 100 chiếc". Card "Tuỳ chọn": switches "Cần thêu / in", "Cần kiểm vải đầu vào", "Cần duyệt mẫu PP", "Cần nhuộm", "Bỏ giặt sạch" (with a warning-tinted note "Cần có xác nhận của khách hàng đã ký trước khi xác nhận đơn"). Sticky right panel "Tóm tắt đơn hàng": Mã hàng, Loại vải, Màu, Tổng số lượng, "Hồ sơ QC: Quy trình đầy đủ" and buttons "Lưu nháp" (outline) and "Kiểm tra và xác nhận" (primary). No BOM fields on this screen.
```

**2.3 Chi tiết đơn hàng (tab Quy trình)**

```text
[STYLE PREAMBLE]

Screen: Order detail for order PO-2026-0007, status badge "Đã xác nhận". Header: order number, status badge, "Mã hàng JN-SLIM-01", "Ngày giao 30/10/2026", and one button "Tạo phiếu đóng gói" (disabled, tooltip "Chỉ dùng được sau khi QC cuối đạt"). Tabs: "Tổng quan", "Định mức và vật tư", "Quy trình", "Chất lượng", "Đóng gói và bàn giao", "Lịch sử". Show the "Quy trình" tab: a vertical read-only stepper of 14 steps, each with the Vietnamese name, the code in small monospace text, the responsible role, a status badge and good/defect quantities where relevant. Data: "Nhận và xác nhận đơn" Xong; "Chọn vải và màu" Xong; "Định mức và cấp phát vật tư" Xong; "Kiểm vải đầu vào" Bỏ qua; "Duyệt mẫu PP" Bỏ qua; "Cắt" Xong (100 / 0); "Thêu / in" Bỏ qua; "May" Đang làm (62 / 1); "Nhuộm" Bỏ qua; "Giặt hiệu ứng" Chờ; "Giặt sạch" Chờ; "Hoàn thiện" Chờ; "QC cuối" Chờ; "Đóng gói và bàn giao" Chờ. Skipped steps are muted with a dashed badge and a tooltip "Bỏ qua do điều kiện sai: cần nhuộm = không". Right card "Bản chụp quy trình": "Mẫu: Jean Standard v3" and the note "Thay đổi mẫu quy trình không ảnh hưởng đơn này".
```

**2.4 Hộp thoại xác nhận đơn**

```text
[STYLE PREAMBLE]

Screen: Confirm-order dialog over a dimmed order detail page. Title "Xác nhận đơn PO-2026-0007". Body: a checklist of preconditions, each with an icon and text: "Mã hàng đã có mẫu quy trình được xuất bản" (OK), "Dải size đầy đủ" (OK), "Cặp vải–màu hợp lệ" (OK), "Vật tư đã được cấp phát" (OK), "Xác nhận của khách hàng đã đính kèm" (required because "Bỏ giặt sạch" is on; show a drop zone "Kéo thả file PDF hoặc ảnh đã ký" in warning tint). Summary line: "Xác nhận sẽ tạo quy trình gồm 14 công đoạn và không thể hoàn tác." Footer: "Huỷ" (outline), "Xác nhận đơn" (primary, disabled until all conditions are OK). Add a second frame with an error banner "Chưa thể xác nhận: còn 2 điều kiện chưa đạt" and the two failed items.
```

**2.5 Đóng gói và bàn giao**

```text
[STYLE PREAMBLE]

Screen: "Đóng gói và bàn giao" tab of an order whose final QC passed. Left card "Phiếu đóng gói": table by size (28, 30, 32, 34) with columns "Size", "Số lượng đạt", "Số thùng", "Số chiếc/thùng" and a total row. Right card "Biên bản bàn giao" (preview): "Mã đơn", "Mã hàng", "Màu", "Tổng số lượng đạt", "Hồ sơ QC đã dùng" (badge "Quy trình đầy đủ"), "Kết quả QC cuối" (badge "Đạt" with date), "Người bàn giao", "Ngày". Primary button "Phát hành biên bản bàn giao". Second state: success banner "Đã phát hành biên bản bàn giao" and the order status badge "Hoàn tất".
```

### Lô 3 — Công nhân trạm và QC

**3.1 Việc của tôi (Worklist)**

```text
[STYLE PREAMBLE]

Screen: "Việc của tôi" for a station operator assigned to the sewing station. Top: station badge "May" with small monospace "SEWING" and a summary "Sẵn sàng 2 · Đang làm 1 · Làm lại 1". Tabs: "Sẵn sàng", "Đang làm", "Làm lại". A list of cards (not a table) with large touch-friendly targets, each showing order number, "JN-SLIM-01 · Indigo", step name, "Kế hoạch: 100 chiếc", due date, status badge and a primary button: "Bắt đầu" (ready), "Nhập số lượng" (in progress), "Bắt đầu làm lại" (rework). The rework card has a warning-tinted note "Lý do từ QC: Gấu quần không đều ở size 32". Muted line at the top: "Đang hiển thị công đoạn của trạm May".
```

**3.2 Thực hiện công đoạn và nhập số lượng**

```text
[STYLE PREAMBLE]

Screen: Step execution for the sewing step of order PO-2026-0007, as a wide side sheet or full page. Header: step name "May", order number, badge "Đang làm", and "Công đoạn trước (Cắt): 100 chiếc đạt". Table "Nhập số lượng theo bó" with columns "Mã bó", "Size", "Đạt", "Lỗi", "Người nhập", "Thời gian" and an inline add-row. Right panel: "Đã may 62 · còn được nhập 38" with a flat blue progress bar, and an inline error example "Số lượng vượt quá số lượng đạt của công đoạn trước". Footer buttons: "Lưu số liệu" (outline) and "Hoàn thành công đoạn" (primary, disabled until the totals are valid). Optional drop zone "Minh chứng (không bắt buộc)".
```

**3.3 Hàng chờ kiểm tra (QC)**

```text
[STYLE PREAMBLE]

Screen: "Hàng chờ kiểm tra" for the QC inspector. Table: "Mã đơn", "Mã hàng / Màu", "Công đoạn" (for example "QC cuối", "May (kiểm tại chuyền)"), "Số lượng", "Hồ sơ QC" (badge "Quy trình đầy đủ" or "Bỏ giặt sạch"), "Chờ từ", action button "Kiểm tra". 5 rows. One row shows a disabled button and the muted note "Bạn đã thực hiện công đoạn này nên không thể duyệt".
```

**3.4 Phiếu kiểm tra QC**

```text
[STYLE PREAMBLE]

Screen: QC inspection form, title "Kiểm tra QC cuối — PO-2026-0007". Left: inputs "Cỡ mẫu", a defect table "Danh sách lỗi" (columns "Loại lỗi" select, "Số lượng", "Mức độ"), "Độ co đo được (%)" with value 3,4 and "Mức phai màu" with value 1. Right card "Ngưỡng của hồ sơ QC Quy trình đầy đủ": "Độ co ≤ 3,0 %" with a danger-tinted indicator "Không đạt: 3,4 > 3,0", and "Phai màu ≤ 1" with a success-tinted indicator "Đạt". Below: line "Đề xuất của hệ thống: Làm lại" and a segmented control for the inspector's decision "Đạt / Làm lại / Loại". When "Làm lại" or "Loại" is chosen, show required fields "Công đoạn quay lại" (select, for example "Hoàn thiện") and "Lý do" (textarea). Primary button "Gửi quyết định". Note: "Quyết định thuộc về nhân viên QC; hệ thống chỉ đề xuất."
```

### Lô 4 — Kỹ sư quy trình

**4.1 Danh sách mẫu quy trình**

```text
[STYLE PREAMBLE]

Screen: "Mẫu quy trình". Primary button "Tạo mẫu mới". Table columns: "Tên" (Jean Standard), "Số phiên bản", "Bản đã xuất bản" (badge "v3 · Đã xuất bản"), "Bản nháp" (badge "v4 · Nháp"), "Số mã hàng áp dụng", "Cập nhật lần cuối". Row actions: "Mở", "Tạo bản nháp từ bản đã xuất bản".
```

**4.2 Trình chỉnh sửa mẫu quy trình (màn quan trọng nhất)**

```text
[STYLE PREAMBLE]

Screen: Workflow template editor, title "Mẫu Jean Standard — phiên bản v4" with badge "Nháp". Three-column layout. Left (320px): ordered list of 14 steps with drag handles, each showing Vietnamese name, code in small monospace, a type badge ("Lựa chọn", "Vật tư", "Sản xuất", "Kiểm tra chất lượng", "Phê duyệt") and small icons for mandatory, evidence and QC. Center: a read-only flow graph of steps as simple rounded rectangles connected by thin lines; normal transitions are solid gray lines and rework transitions are dashed warning-colored arrows (for example from "QC cuối" back to "Hoàn thiện"). Right (360px): property panel for the selected step "Cắt": "Tên công đoạn", "Loại công đoạn", "Vai trò phụ trách", "Trạm", switches "Bắt buộc", "Yêu cầu minh chứng", "Yêu cầu QC", field "Số lần làm lại tối đa", and a condition builder "Điều kiện" with a row "cần nhuộm" "bằng" "đúng", an "Và / Hoặc" group toggle and "Thêm điều kiện". Top bar: breadcrumb, buttons "Kiểm tra hợp lệ" (outline) and "Xuất bản" (primary). Bottom drawer "Kết quả kiểm tra" listing violations, for example "Công đoạn EMBROIDERY (Thêu / in) không có chuyển tiếp đi ra (BR-01)". All graph colors flat, no gradients.
```

**4.3 Hồ sơ QC**

```text
[STYLE PREAMBLE]

Screen: "Hồ sơ QC" configuration for a style. Two cards side by side: "Quy trình đầy đủ" and "Bỏ giặt sạch". Each has numeric fields "Độ co tối đa (%)" and "Mức phai màu tối đa", a short description, and "Đang dùng bởi 4 mã hàng". Warning-tinted notice at the bottom: "Ngưỡng dùng cho demo; cần xác nhận số thật với xưởng." Button "Lưu".
```

### Lô 5 — Quản trị viên, Thủ kho, Quản lý

**5.1 Người dùng**

```text
[STYLE PREAMBLE]

Screen: "Người dùng". Table columns: "Họ tên", "Email", "Vai trò", "Trạm" (only for production workers), "Trạng thái" ("Đang hoạt động" / "Đã vô hiệu hoá"), "Đăng nhập gần nhất". Button "Thêm người dùng" opens a side sheet with "Họ và tên", "Email", "Vai trò" (select of 7 roles: Quản trị viên, Kỹ sư quy trình, Điều độ sản xuất, Thủ kho, Công nhân trạm, Nhân viên QC, Quản lý), "Trạm" (visible only for "Công nhân trạm"), and the note "Mật khẩu tạm thời chỉ hiển thị một lần." Row menu: "Sửa", "Vô hiệu hoá".
```

**5.2 Danh mục (Mã hàng, Loại vải, Màu, Kiểu giặt)**

```text
[STYLE PREAMBLE]

Screen: Master data with tabs "Mã hàng", "Loại vải", "Màu", "Kiểu giặt". Show the "Loại vải" tab: table with "Mã" (DN-12-RIGID), "Tên", "Trọng lượng" (12 oz), "Độ co giãn" (badge "Không co giãn" or "Co giãn"), "Đang dùng", and row actions. One delete button is disabled with tooltip "Đang được dùng bởi 3 đơn hàng". Toolbar: search and button "Thêm loại vải".
```

**5.3 Ma trận vải–màu**

```text
[STYLE PREAMBLE]

Screen: "Ma trận vải–màu". A grid: rows are fabric types (DN-12-RIGID, DN-10-STRETCH, DN-14-RIGID), columns are colors ("Indigo", "Đen", "Xám", "Xanh nhạt"). Each cell is a toggle: allowed (primary tint with check) or not allowed (empty with a muted dash). Legend "Cho phép" / "Không cho phép" and the note "Đơn hàng chỉ được chọn các cặp được cho phép." A bottom bar: "Bạn có thay đổi chưa lưu" with buttons "Bỏ thay đổi" and "Lưu thay đổi".
```

**5.4 Cấp phát vật tư (Thủ kho)**

```text
[STYLE PREAMBLE]

Screen: "Cấp phát vật tư" for the warehouse keeper. Left: table "Lô vải" with columns "Số lô", "Loại vải", "Màu", "Ngày nhập", "Số mét còn lại", "Số mét đã cấp". Right: card "Định mức nguyên liệu — PO-2026-0007" with lines: Vải DN-12-RIGID cần 215,0 m; Chỉ; Nút; Đinh tán; Khoá kéo; Nhãn, with a button "Cấp phát" on the fabric line that opens a small dialog showing lot, "Số mét còn lại 480,0 m", field "Số mét cấp" and validation "Không được vượt quá số còn lại 480,0 m". Second state: warning banner "Thiếu 35,0 m" with button "Tạo yêu cầu vật tư". Below: table "Yêu cầu vật tư" with badges "Mới", "Đã đặt", "Đã nhận".
```

**5.5 Bảng điều khiển (Quản lý)**

```text
[STYLE PREAMBLE]

Screen: "Bảng điều khiển", read-only. Top row of flat KPI tiles (no icons in colored circles): "Đơn đang sản xuất" 12, "Đơn chờ QC" 3, "Số lượng đạt tuần này" 1.240, "Tỷ lệ lỗi" 2,1 %. Below: a horizontal bar chart "Hàng đang làm theo công đoạn" (14 steps, one blue color), a stacked bar "Đạt / Lỗi / Làm lại theo công đoạn" using blue, danger and warning tints (flat), and a table "Đơn chờ QC". Light gridlines, direct labels, no 3D, no gradients, no shadows. Filters "Khoảng thời gian" and "Mã hàng".
```

**5.6 Nhật ký kiểm toán**

```text
[STYLE PREAMBLE]

Screen: "Nhật ký kiểm toán". Filters: "Loại đối tượng", "Mã đối tượng", "Người thực hiện", "Hành động", "Khoảng thời gian". Append-only table with columns "Thời gian", "Người thực hiện" (name + role), "Hành động" (monospace, for example ORDER_CONFIRMED), "Đối tượng" (type + id), "Tóm tắt". Clicking a row opens a side sheet with "Trước / Sau" as a two-column diff and a "Dữ liệu JSON" monospace block. Muted footer note: "Bản ghi kiểm toán không thể sửa hoặc xoá."
```

---

## D. Giao cho Antigravity code theo thiết kế

### D.1 Kết nối Stitch MCP (đối chiếu tài liệu chính thức của Google)

Theo hướng dẫn bên thứ ba:

1. Trên stitch.withgoogle.com: menu hồ sơ → **Stitch Settings** → **Create API Key**. **Không dán key vào chat, không commit.**
2. Trong Antigravity: nút ba chấm ở khung agent → **MCP Servers** → tìm `stitch` → Install → dán key. Hoặc cấu hình tay `mcp_config.json` với URL `https://mcp.stitch.withgoogle.com/v1` và header `Authorization: Bearer <key>`; để key trong biến môi trường, không viết thẳng vào file nằm trong repo.
3. Kiểm tra bằng cách hỏi agent: *"List the screens in my Stitch project 'DenimFlow BO'."*

### D.2 Prompt: áp design system vào `apps/web` (làm một lần, sau T0.5)

```text
Read AGENTS.md (section 2 order), .agents/rules/02-coding-conventions.md, .agents/skills/add-web-feature.md and docs/design/DESIGN.md.

Task: apply the DenimFlow BO design system to apps/web. Do NOT build any feature screen yet. The UI language is Vietnamese (decision D8).

1. Map the tokens in docs/design/DESIGN.md to Tailwind and shadcn/ui theme variables (CSS variables in the global stylesheet: background, foreground, card, border, primary, primary-foreground, muted, muted-foreground, destructive, plus custom success/warning/info tokens). No hardcoded hex colors in components after this step.
2. Load Inter WITH the Vietnamese subset (for example @fontsource-variable/inter); set the monospace font for codes; set radius to 6px. Verify Vietnamese diacritics render in Inter (not a fallback font).
3. Set up the i18n dictionary in apps/web/src/lib/i18n with a single `vi` locale. Put the enum-to-label maps (roles, order/step/version/QC/request statuses, steps, stations, domain terms) from the "Vietnamese UI glossary" in DESIGN.md there. Add vi-VN number and date formatters (1.240, 2,1 %, dd/MM/yyyy) as helpers.
4. Create reusable components: StatusBadge (kind = order | step | version | qc | request, value; label from the dictionary), PageHeader, DataTable wrapper, EmptyState, FormField.
5. Build the AppShell (sidebar 240px, top bar 56px, role-based menu from a single config object) matching the Stitch screen "App shell". Leave room for longer Vietnamese labels (no fixed widths).
6. Add a temporary /dev/style-guide route showing all components, to compare with the Stitch style tile. Guard it with import.meta.env.DEV.

Rules: no gradients anywhere; use only design tokens; no Vietnamese or English literals scattered in components (use the dictionary). Explain in Vietnamese why you chose each mapping, and ask before adding any dependency. Branch: feat/web-design-system. Plan first, wait for my OK before writing code.
```

### D.3 Prompt: triển khai từng màn hình (lặp lại cho mỗi màn)

```text
Read AGENTS.md, .agents/skills/add-web-feature.md, docs/design/DESIGN.md and the relevant task in .agents/tasks/.

Task: implement the screen "<TÊN MÀN HÌNH>" (Stitch project "DenimFlow BO") in apps/web/src/features/<feature>/.

Steps:
1. Fetch the screen from Stitch through the MCP server and look at its screenshot and generated HTML/CSS. Treat it as a visual REFERENCE only. Do not copy raw HTML or inline styles into the codebase.
2. Rebuild it with our shadcn/ui components, Tailwind classes that use the design tokens (no hardcoded colors), and the shared components (AppShell, PageHeader, StatusBadge, DataTable, FormField).
3. Text: every visible string goes through the Vietnamese dictionary (apps/web/src/lib/i18n); reuse the glossary in DESIGN.md. If Stitch produced wrong or missing diacritics, fix them to match the glossary. If you need a new term, add it to the glossary in DESIGN.md in the same PR.
4. Data: use TanStack Query hooks and MSW handlers in src/mocks until the real endpoint exists. Types and Zod schemas come from @denimflow/shared. Do not invent fields that are not in docs/en/DATABASE_DESIGN.md.
5. Business rules shown in the UI (allowed colors, quantity checks) are hints only; the API stays the authority (AGENTS.md rule 7).
6. States: loading, empty, error, and forbidden (wrong role).
7. Accessibility: labels, keyboard navigation, visible focus, status not by color alone.

Deliver: a short list of how the code differs from the Stitch design and why. Then run `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build`. One screen per branch (feat/web-<screen>) and one PR. Explain in Vietnamese. Plan first and wait for my OK.
```

Thứ tự code đề xuất (bám các task sprint): Đăng nhập + khung ứng dụng (S0/S1) → Danh mục + Ma trận (S1) → Trình chỉnh sửa mẫu quy trình (S2) → Đơn hàng: danh sách, tạo, chi tiết, xác nhận (S3) → Cấp phát vật tư (S3) → Việc của tôi + nhập số lượng (S4) → Kiểm tra QC (S5) → Đóng gói, Bảng điều khiển, Nhật ký (S5).

### D.4 Lưu ý khi dùng thiết kế sinh bằng AI

- **Thiết kế chỉ là tham chiếu, không phải sự thật nghiệp vụ.** Stitch có thể bịa field hoặc luồng; luôn đối chiếu `PRD.md` và `DATABASE_DESIGN.md`.
- **Bỏ màn ngoài MVP:** đừng code Hold/Cancel, thay đổi runtime, nhánh custom (xem PRD §5 "Deferred").
- **Dấu tiếng Việt:** kiểm tra từng màn sinh ra; lỗi dấu và nhãn không nhất quán là lỗi thường gặp ở công cụ sinh UI. Nhãn chuẩn nằm ở glossary trong `DESIGN.md`.
- **`DESIGN.md` nằm trong repo**, cập nhật cùng PR khi đổi token hoặc thuật ngữ.
