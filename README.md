# DenimFlow BO

**EN** — Internal Back Office for a jeans subcontracting workshop, built around a configurable **Dynamic Workflow**: the chain of operations (fabric/color selection, cutting, sewing, dyeing, washing, finishing, QC, handover) is stored as versioned data, so the process can change without redeploying.

**VI** — Hệ thống Back Office nội bộ cho xưởng gia công quần Jean, xây dựng quanh **Dynamic Workflow** cấu hình được: chuỗi công đoạn (chọn vải–màu, cắt, may, nhuộm, giặt, hoàn thiện, QC, bàn giao) được lưu dưới dạng dữ liệu có phiên bản, nên đổi quy trình không cần deploy lại.

## Stack

React + Vite + TypeScript + Tailwind · NestJS + Prisma · Supabase (Postgres, Auth, Storage) · pnpm monorepo · Cloudflare (web) + Render (API) + GitHub Actions. Hosting cost = 0.

## Documentation / Tài liệu

| Topic | English | Tiếng Việt |
|---|---|---|
| Product requirements | [PRD](docs/en/PRD.md) | [PRD](docs/vi/PRD.md) |
| Setup and deploy | [DEVELOPMENT_SETUP](docs/en/DEVELOPMENT_SETUP.md) | [DEVELOPMENT_SETUP](docs/vi/DEVELOPMENT_SETUP.md) |
| Database design | [DATABASE_DESIGN](docs/en/DATABASE_DESIGN.md) | [DATABASE_DESIGN](docs/vi/DATABASE_DESIGN.md) |
| Business rules and traceability | [BUSINESS_RECONCILIATION](docs/en/BUSINESS_RECONCILIATION.md) | [BUSINESS_RECONCILIATION](docs/vi/BUSINESS_RECONCILIATION.md) |

For AI agents: start at [AGENTS.md](AGENTS.md). Current status: [PROJECT_STATE.md](PROJECT_STATE.md). Library links: [HELP.md](HELP.md).

## Contributing / Đóng góp

`main` is protected. Create a branch (`feat/<module>-<topic>`), push it, open a Pull Request, get 1 approval, squash-merge. Direct pushes to `main` are rejected.
`main` được bảo vệ: tạo nhánh, mở Pull Request, cần 1 approval, squash merge; không push thẳng.

## Status / Trạng thái

Early stage — repository skeleton and documentation. See [PROJECT_STATE.md](PROJECT_STATE.md).
