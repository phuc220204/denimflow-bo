# DenimFlow BO — Design System

Source of truth for the look and feel of `apps/web`. Agents: read this before building any UI. Owner decision D8: **the UI is in Vietnamese** (single language, strings still go through the dictionary).

Internal back-office for a jeans subcontracting workshop. Calm, professional, data-dense, easy on the eyes for all-day use.

## Principles

- Flat only: NO gradients, no glassmorphism, no glow, no decorative illustration, no emoji.
- Light theme only (dark mode is out of scope).
- Color carries meaning, not decoration: one brand color (denim blue) for actions; semantic colors only for status.
- Never rely on color alone: every status badge shows its text label.
- Data first: tables, forms and clear hierarchy. Minimal chrome.
- Business rules shown in the UI are hints only; the API is the authority.

## Color tokens

| Token | Hex | Use |
|---|---|---|
| background | #F6F7F9 | page background |
| surface | #FFFFFF | cards, tables, dialogs |
| border | #E2E5EA | 1px borders, dividers |
| text | #1F2933 | primary text |
| text-muted | #5B6672 | secondary text, helper text, table headers |
| primary | #2F5D8A | primary buttons, links, active nav text, focus ring |
| primary-hover | #254A70 | primary hover / pressed |
| primary-tint | #E8EFF6 | active nav item background, selected row, info badge background |
| success / success-text / success-tint | #2E7D5B / #24694A / #E6F2EC | DONE, PASS, COMPLETED |
| warning / warning-text / warning-tint | #B7791F / #8A5A0B / #FBF3E0 | REWORK, WAITING_QC, shortage |
| danger / danger-text / danger-tint | #B33A3A / #8F2D2D / #F8E8E8 | REJECT, errors, destructive actions |
| neutral-tint | #EEF0F3 | PENDING, SKIPPED, DRAFT badge background |

Contrast: `text`, `text-muted` and `primary` on white are at least 4.5:1 (checked by calculation). Badges use the `*-text` color on the `*-tint` background. Re-check with a contrast tool when a token changes.

## Status badges (text + tinted background, no gradient)

| Enum | Value → tone |
|---|---|
| OrderStatus | DRAFT neutral · CONFIRMED info · IN_PRODUCTION primary-tint · ON_HOLD warning · COMPLETED success · CANCELLED danger |
| StepStatus | PENDING neutral · READY info · IN_PROGRESS primary-tint · WAITING_QC warning · REWORK warning · DONE success · SKIPPED neutral with dashed border |
| VersionStatus | DRAFT neutral · PUBLISHED success · RETIRED neutral |
| QcResult | PASS success · REWORK warning · REJECT danger |
| RequestStatus | OPEN warning · ORDERED info · RECEIVED success · CANCELLED neutral |

## Typography

- Font: **Inter** with the **Vietnamese subset** loaded (for example `@fontsource-variable/inter` includes `vietnamese`; with Google Fonts add `subset=vietnamese`). Fallback `system-ui`. Without that subset, diacritics fall back to another font and look broken.
- Monospace (`ui-monospace`, `JetBrains Mono`) only for codes such as `JN-SLIM-01`, `CUTTING`, `PO-2026-0007`. Codes are ASCII, so no Vietnamese glyphs are needed there.
- Scale (px): 12 caption · 13 table/dense · 14 body (base) · 16 section title · 20 page title · 24 KPI number.
- Weights: 400 body, 500 labels and table headers, 600 titles. Tabular numbers for all quantities.
- Vietnamese diacritics are tall: use line-height of at least 1.5 for body text and 1.3 for titles, and never clip text with a fixed height.

## Layout and shape

- Spacing base 8px; page padding 24px; card padding 16px.
- Radius 6px (inputs, buttons, cards); badges 4px. Border 1px. Shadow only on dialogs and dropdown menus (very subtle).
- App shell: left sidebar 240px (white, border-right), top bar 56px (breadcrumb, role badge, user menu), content max width 1280px, centered.
- Tables: sticky header, 40px rows, no zebra, hover row = primary-tint at low strength, numbers right-aligned.
- Forms: label above the field, helper text below, errors in `danger-text` with an icon and a message; 36px control height.
- Vietnamese labels are usually 10–30 % longer than English: no fixed-width buttons or badges, allow wrapping in table headers, give sidebar items room for two lines.

## Components (shadcn/ui style)

Button (primary, outline, ghost, destructive), Input, Select, Combobox, Textarea, Checkbox, Switch, Tabs, Badge, Table, Dialog, Sheet (side panel), Toast, Tooltip, Empty state (one line + one action), Stepper (read-only), File drop zone, Pagination.

## Accessibility

Visible 2px focus ring in `primary`; everything keyboard reachable; minimum hit area 32px; destructive actions need confirmation; status is never color-only.

## Formats (locale `vi-VN`)

- Numbers: `Intl.NumberFormat('vi-VN')` → `1.240` (thousands with a dot), `2,1 %` (decimal comma).
- Dates: `dd/MM/yyyy` (for example `17/10/2026`); date-time `dd/MM/yyyy HH:mm`.
- Quantities of fabric in meters: `215,0 m`. Pieces: `100 chiếc`.

## Vietnamese UI glossary (use these labels everywhere; add new terms here)

Code identifiers, enum values and API fields stay in English. Only the displayed label is Vietnamese, taken from the dictionary in `apps/web/src/lib/i18n`. Where a technical code helps the user (a step or station), show it as small monospace secondary text next to the Vietnamese label.

### Roles (`Role`)

| Value | Label |
|---|---|
| ADMIN | Quản trị viên |
| PROCESS_ENGINEER | Kỹ sư quy trình |
| PRODUCTION_PLANNER | Điều độ sản xuất |
| WAREHOUSE_KEEPER | Thủ kho |
| STATION_OPERATOR | Công nhân trạm |
| QC_INSPECTOR | Nhân viên QC |
| MANAGER | Quản lý |

### Statuses

| Enum | Values → labels |
|---|---|
| OrderStatus | DRAFT Nháp · CONFIRMED Đã xác nhận · IN_PRODUCTION Đang sản xuất · ON_HOLD Tạm dừng · COMPLETED Hoàn tất · CANCELLED Đã huỷ |
| StepStatus | PENDING Chờ · READY Sẵn sàng · IN_PROGRESS Đang làm · WAITING_QC Chờ QC · REWORK Làm lại · DONE Xong · SKIPPED Bỏ qua |
| VersionStatus | DRAFT Nháp · PUBLISHED Đã xuất bản · RETIRED Ngừng dùng |
| QcResult | PASS Đạt · REWORK Làm lại · REJECT Loại |
| RequestStatus | OPEN Mới · ORDERED Đã đặt · RECEIVED Đã nhận · CANCELLED Đã huỷ |
| QcProfileType | FULL_PROCESS Quy trình đầy đủ · SKIP_CLEAN_WASH Bỏ giặt sạch |
| StretchType | RIGID Không co giãn · STRETCH Co giãn |

### Steps of "Jean Standard" (code → label)

| Code | Label |
|---|---|
| ORDER_CONFIRM | Nhận và xác nhận đơn |
| FABRIC_COLOR_SELECT | Chọn vải và màu |
| BOM_ALLOCATE | Định mức và cấp phát vật tư |
| FABRIC_INSPECT | Kiểm vải đầu vào |
| PP_SAMPLE | Duyệt mẫu PP |
| CUTTING | Cắt |
| EMBROIDERY | Thêu / in |
| SEWING | May |
| DYEING | Nhuộm |
| EFFECT_WASH | Giặt hiệu ứng |
| CLEAN_WASH | Giặt sạch |
| FINISHING | Hoàn thiện |
| FINAL_QC | QC cuối |
| PACK_HANDOVER | Đóng gói và bàn giao |

### Stations (`StationType`) and step types (`StepType`)

| Value | Label |
|---|---|
| CUTTING / SEWING / EMBROIDERY / DYEING / WASH / FINISHING / QC / PACKING | Cắt / May / Thêu-in / Nhuộm / Giặt / Hoàn thiện / QC / Đóng gói |
| SELECTION / MATERIAL / PRODUCTION / QC / APPROVAL | Lựa chọn / Vật tư / Sản xuất / Kiểm tra chất lượng / Phê duyệt |

### Domain terms

| English / code | Vietnamese UI |
|---|---|
| Production order | Đơn hàng |
| Style | Mã hàng |
| Fabric type | Loại vải |
| Color | Màu |
| Fabric–Color Matrix | Ma trận vải–màu |
| Wash type | Kiểu giặt |
| Size run | Dải size |
| BOM | Định mức nguyên liệu (BOM) |
| Fabric lot | Lô vải |
| Allocation | Cấp phát |
| Material Request | Yêu cầu vật tư |
| Workflow template | Mẫu quy trình |
| Workflow instance | Quy trình của đơn |
| Worklist | Việc của tôi |
| Bundle | Bó |
| Good / Defect quantity | Số lượng đạt / Số lượng lỗi |
| QC Profile | Hồ sơ QC |
| Shrinkage | Độ co |
| Fading level | Mức phai màu |
| Sample size | Cỡ mẫu |
| Customer acknowledgement | Xác nhận của khách hàng |
| Handover record | Biên bản bàn giao |
| Packing list | Phiếu đóng gói |
| Audit log | Nhật ký kiểm toán |
| Dashboard | Bảng điều khiển |
| Publish | Xuất bản |
| Confirm | Xác nhận |

Keep the glossary identical across screens. If a new term appears, add it here in the same PR.
