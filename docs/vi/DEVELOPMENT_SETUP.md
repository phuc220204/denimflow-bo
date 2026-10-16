# DEVELOPMENT_SETUP — DenimFlow BO

Phiên bản 0.1 · 2026-10-16 · Ngôn ngữ: VI (bản dịch) · Bản chuẩn: `docs/en/DEVELOPMENT_SETUP.md`

> **Trạng thái:** `apps/` và `packages/` chưa tồn tại; chúng được tạo ở Sprint 0 (`.agents/tasks/S0-scaffold-and-pipeline.md`). Các lệnh dưới đây là lệnh **dự kiến** và chỉ có hiệu lực sau khi S0 được merge. Nhãn trên dashboard của dịch vụ bên thứ ba hay thay đổi: khi nhãn khác, hãy theo tài liệu chính thức trong `HELP.md` và sửa lại file này.

## 1. Tổng quan

```
Browser ─► Cloudflare (web tĩnh) ─► Render (NestJS API) ─► Supabase Postgres
   │                                        └──────────────► Supabase Storage (bucket private)
   └──────────────► Supabase Auth (đăng nhập, JWT)  ◄── API xác thực JWT
```

| Thành phần | Dịch vụ | Chi phí |
|---|---|---|
| Source, CI | GitHub, GitHub Actions | 0 (repo public) |
| Web (tĩnh) | Cloudflare Pages hoặc Workers static assets (quyết định O2 ở S0) | 0 |
| API | Render free web service | 0 (ngủ sau 15 phút không có traffic, ~1 phút cold start) |
| DB, Auth, Storage | Supabase free | 0 (hạn mức nhỏ; project bị pause sau khoảng một tuần không hoạt động) |

Dùng hai project Supabase: **`denimflow-dev`** (phát triển local, thử migration) và **`denimflow-prod`** (hệ thống đã deploy). Chọn cùng region cho database và host API để giảm độ trễ (region Đông Nam Á là lựa chọn hợp lý cho team ở Việt Nam).

## 2. Điều kiện cần

| Công cụ | Phiên bản | Kiểm tra |
|---|---|---|
| Git | bản gần đây | `git --version` |
| Node.js | LTS hiện hành (xem `.nvmrc`) | `node --version` |
| pnpm | phiên bản ghim trong `package.json` gốc (`packageManager`) | `pnpm --version`; cài bằng `corepack enable` hoặc `npm i -g pnpm` |
| Editor | VS Code (UTF-8, LF) | — |

Tài khoản: GitHub, Supabase, Render, Cloudflare. Mẹo Windows: dùng PowerShell hoặc Git Bash; giữ đường dẫn repo ngắn (tránh đường dẫn quá dài); `.gitattributes` ép dùng LF, đừng ghi đè.

## 3. Clone, cài đặt, chạy (sau Sprint 0)

```powershell
git clone https://github.com/<owner>/denimflow-bo.git
cd denimflow-bo
pnpm install --frozen-lockfile
copy apps\api\.env.example apps\api\.env      # rồi điền giá trị của project DEV
copy apps\web\.env.example apps\web\.env
pnpm --filter @denimflow/api db:migrate:dev   # áp migration lên database DEV
pnpm --filter @denimflow/api db:seed          # catalog demo, user, template
pnpm dev                                       # web ở :5173, API ở :3000
```

Lệnh dùng hằng ngày:

| Lệnh | Mục đích |
|---|---|
| `pnpm dev` | Web + API ở chế độ watch |
| `pnpm format:check` / `pnpm lint` / `pnpm typecheck` / `pnpm test` / `pnpm build` | Các cổng chất lượng (CI chạy y hệt); `pnpm format` tự sửa định dạng |
| `pnpm --filter @denimflow/engine test` | Unit test engine (nhanh, không cần DB) |
| `pnpm --filter @denimflow/api db:migrate:dev --name <name>` | Tạo và áp một migration |
| `pnpm --filter @denimflow/api db:studio` | Xem database dev |

Đừng bao giờ chạy lệnh migrate/seed lên `denimflow-prod` từ laptop một cách vô ý: giữ connection string của prod ra khỏi file `.env` local; migration production chạy từ workflow `migrate` (§8).

## 4. Biến môi trường

Giá trị thật chỉ nằm trong các file `.env` đã bị git ignore và trong dashboard của nhà cung cấp. Repo chứa các file `.env.example` với giá trị giả. File của web **không** được chứa secret phía server.

### `apps/api/.env`

| Biến | Ý nghĩa | Lấy ở đâu |
|---|---|---|
| `NODE_ENV` | `development` / `production` | — |
| `PORT` | Port của API (3000 ở local; Render tự cấp) | — |
| `DATABASE_URL` | Connection string dạng pooled (transaction mode) dùng lúc chạy | Supabase → Connect |
| `DIRECT_URL` | Connection string direct hoặc session pooler dùng cho migration | Supabase → Connect |
| `SUPABASE_URL` | URL của project | Supabase → Project settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Key **secret** (service role); chỉ API dùng | như trên |
| `SUPABASE_JWT_SECRET` | Chỉ khi project còn dùng JWT secret dùng chung kiểu cũ; nếu không, API xác thực bằng JWKS của project | Supabase → JWT settings |
| `SUPABASE_STORAGE_BUCKET` | Tên bucket private, ví dụ `denimflow-files` | bạn tự tạo |
| `CORS_ORIGINS` | Danh sách origin của web được phép, cách nhau bằng dấu phẩy | URL của web |
| `SEED_DEFAULT_PASSWORD` | Mật khẩu ban đầu cho user demo từ seed (không bao giờ commit) | bạn tự chọn |

### `apps/web/.env`

| Biến | Ý nghĩa |
|---|---|
| `VITE_API_URL` | Base URL của API |
| `VITE_SUPABASE_URL` | URL project Supabase |
| `VITE_SUPABASE_ANON_KEY` | Key anon/publishable **công khai** (an toàn khi lộ; RLS là deny-all) |

Giá trị `VITE_*` được biên dịch vào JavaScript công khai. Không bao giờ đặt secret vào đó. Supabase đã đổi tên các loại key theo thời gian (anon/service role so với publishable/secret): dùng key công khai ở web và key secret chỉ ở API.

## 5. Database (Supabase + Prisma)

1. Tạo project trên Supabase; ghi lại database password (lưu trong password manager, không đưa vào git).
2. **Cài đặt Auth:** tắt đăng ký công khai (user do Admin tạo qua API); đặt Site URL và redirect URL là origin của web.
3. **Storage:** tạo bucket **private** (`denimflow-files`).
4. **Connection string:** Dashboard → Connect. Dùng chuỗi **transaction pooler** làm `DATABASE_URL` và chuỗi **direct hoặc session pooler** làm `DIRECT_URL`. Host direct chỉ có IPv6 ở một số gói; nếu mạng hoặc host của bạn chỉ có IPv4 thì dùng session pooler cho `DIRECT_URL`.
5. Prisma: đặt `DATABASE_URL` cho runtime và `DIRECT_URL` cho migration theo tài liệu Prisma của **phiên bản major đang cài** (cách đặt file config khác nhau giữa các phiên bản; xem `HELP.md`). Transaction pooling cần tuỳ chọn pgbouncer của Prisma.
6. Áp migration: `pnpm --filter @denimflow/api db:migrate:dev` (dev) hoặc workflow `migrate` (prod). Sau đó chạy `db:seed` trên dev.
7. Kiểm tra RLS: chạy query "bảng chưa bật RLS" trong `DATABASE_DESIGN.md` §8.

Lưu ý free tier: project bị pause sau khoảng một tuần không hoạt động (khôi phục từ dashboard; workflow keep-alive và việc dùng thường xuyên giúp tránh); backup không được bảo đảm ở free tier, nên có thể dựng lại từ migration + seed và hãy export dữ liệu trước buổi demo cuối.

## 6. Deploy API lên Render

1. Render → New → **Web Service** → kết nối repo GitHub. Instance type **Free**. Cùng region với Supabase nếu có thể.
2. Root directory: thư mục gốc của repo (lockfile của monorepo nằm ở gốc).
3. Build command (điều chỉnh theo script cuối cùng):
   ```
   corepack enable && pnpm install --frozen-lockfile && pnpm --filter @denimflow/shared build && pnpm --filter @denimflow/engine build && pnpm --filter @denimflow/api db:generate && pnpm --filter @denimflow/api build
   ```
4. Start command: `node apps/api/dist/main.js`
5. Health check path: `/health`.
6. Environment: toàn bộ biến của `apps/api/.env` **với giá trị production**, thêm `NODE_VERSION` khớp `.nvmrc`. Đặt `CORS_ORIGINS` là URL web đã deploy.
7. Auto-deploy từ `main`.

**Không** chạy migration trong start command (mỗi lần thức dậy sẽ chạy lại). Hành vi của instance free: ngủ sau 15 phút không có traffic, mất khoảng 1 phút để thức; có giới hạn số giờ instance mỗi tháng (một service chạy liên tục thì vừa đủ; đừng thêm service thứ hai). Trước buổi demo, hãy mở URL `/health` sớm vài phút.

## 7. Deploy web lên Cloudflare

Quyết định O2: Pages hay Workers static assets. Tài liệu Cloudflare hiện khuyến nghị Workers cho dự án mới trong khi Pages vẫn được hỗ trợ; hãy ghi lựa chọn vào một ADR.

Cài đặt (áp dụng cho cả hai lựa chọn):
- Build: `pnpm --filter @denimflow/web build` (bước install có thể do nền tảng tự chạy; xem build log).
- Output directory: `apps/web/dist`.
- Biến lúc build: `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `NODE_VERSION`.
- **SPA fallback:** mọi đường dẫn không tồn tại phải trả về `index.html`, nếu không thì refresh `/orders` sẽ ra 404. Với Workers static assets đó là cài đặt `not_found_handling = "single-page-application"` trong config Wrangler; hãy kiểm tra hành vi hiện tại trong tài liệu của lựa chọn bạn dùng.
- Production branch: `main`; mỗi PR có preview deployment.

Sau lần deploy đầu: thêm URL web vào redirect URL của Supabase Auth và vào `CORS_ORIGINS` của API.

## 8. CI/CD (GitHub Actions)

| Workflow | Kích hoạt | Làm gì |
|---|---|---|
| `ci.yml` | PR, push lên `main` | install (có cache), format check, lint, typecheck, test (Postgres service container), build |
| `migrate.yml` | thủ công (`workflow_dispatch`) | `prisma migrate deploy` lên production bằng `DIRECT_URL` lưu trong Actions secret; có thể đặt sau một environment được bảo vệ |
| `keep-alive.yml` | theo lịch (~10 phút) | `curl` tới `/health` của API (URL nằm trong repository variable) để giảm cold start của Render và việc Supabase bị pause |

Các workflow dùng `permissions: contents: read`. GitHub có thể trễ lịch chạy và có thể tắt lịch trên repo không hoạt động; keep-alive là tiện ích, không phải bảo đảm.

Sau lần `ci.yml` xanh đầu tiên: thêm **Require status checks to pass** vào ruleset `protect-main` (việc của owner, T0.8).

## 9. Xử lý sự cố

| Triệu chứng | Nguyên nhân có thể | Cách xử lý |
|---|---|---|
| Request đầu tiên sau khi rảnh mất ~1 phút | Instance free của Render đang ngủ | Chờ; gọi `/health` trước buổi demo; workflow keep-alive |
| Lỗi Prisma `prepared statement ... already exists` | Dùng transaction pooler mà thiếu tuỳ chọn pgbouncer của Prisma | Thêm tuỳ chọn pgbouncer vào `DATABASE_URL` theo tài liệu Prisma |
| `P1001` không kết nối được database từ CI/Render/local | Kết nối direct chỉ có IPv6 | Dùng chuỗi session pooler cho `DIRECT_URL` |
| Lỗi CORS trên trình duyệt | Origin của web chưa có trong `CORS_ORIGINS` (kiểm tra scheme, không có dấu `/` cuối) | Sửa biến, deploy lại API |
| API trả 401 cho user đã đăng nhập | Sai URL/key Supabase, token hết hạn, sai cách xác thực JWT | So lại env với project; theo tài liệu JWT của Supabase |
| Đăng nhập được nhưng role trống / 403 | Không có dòng `profiles` cho auth user, hoặc bị inactive | Tạo/kích hoạt profile (Admin) |
| Refresh một route trên web ra 404 | Chưa cấu hình SPA fallback | Xem §7 |
| Project Supabase bị pause | Không hoạt động | Khôi phục trên dashboard, rồi gọi `/health` |
| Xung đột merge lockfile | Hai người đổi dependency song song | Lấy `pnpm-lock.yaml` của `main`, chạy `pnpm install` |
| Diff cả file một cách lạ | CRLF so với LF | Giữ `.gitattributes`; `git add --renormalize .` |
| Build trên Render lỗi: không tìm thấy `@denimflow/shared` | Package chưa được build trước API | Giữ đúng thứ tự build ở §6 |
