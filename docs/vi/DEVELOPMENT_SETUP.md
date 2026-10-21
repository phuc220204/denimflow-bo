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
| Docker Desktop | bản gần đây (chạy database test tạm thời) | `docker --version` |
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
| `pnpm --filter @denimflow/api db:test:up` / `db:test:down` | Bật/tắt Postgres test trong Docker (port 54329). Test của API cần nó và không bao giờ đụng Supabase; đổi bằng `TEST_DATABASE_URL` |
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

1. Render → New → **Web Service** → kết nối repo GitHub. Instance type **Free**, region **Singapore** (cùng Supabase).
2. **Root Directory:** để trống (root của repo; lockfile và workspace pnpm nằm ở đó).
3. **Build Command** (gọi pnpm đúng version ghim trong `package.json`; docs của Render không đảm bảo có pnpm/corepack nên dùng `npx`):
   ```
   npx --yes pnpm@12.14.0 install --frozen-lockfile && npx --yes pnpm@12.14.0 --filter "@denimflow/api..." build
   ```
   Bước install chạy `prisma generate` (`postinstall` của API); `--filter "@denimflow/api..."` build `shared`, `engine` rồi API theo đúng thứ tự phụ thuộc.
4. **Start Command:** `node apps/api/dist/main.js`
5. **Health Check Path:** `/health`.
6. **Environment:** `NODE_ENV=production`, `NODE_VERSION=24` (Render đọc `NODE_VERSION` trước `.nvmrc`), và mọi biến của `apps/api/.env` với giá trị **production**: `DATABASE_URL` (transaction pooler của `denimflow-prod`), `DIRECT_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET`, `CORS_ORIGINS` (URL web đã deploy). `PORT` do Render tự cấp. API khi chạy không cần `SEED_DEFAULT_PASSWORD`.
7. **Auto-Deploy:** khi có commit vào `main`. Tuỳ chọn **Build Filters** (đường dẫn tính từ root repo): include `apps/api/**`, `packages/**`, `pnpm-lock.yaml`.

**Không** chạy migration trong start command (mỗi lần thức dậy sẽ chạy lại): dùng workflow `migrate.yml` (§8). Hành vi của instance free: ngủ sau 15 phút không có truy cập, mất khoảng 1 phút để thức; số giờ chạy mỗi tháng có giới hạn (vừa đủ một service luôn bật; đừng thêm service thứ hai). Trước buổi demo, mở URL `/health` trước vài phút.

## 7. Deploy web lên Cloudflare (Workers static assets)

Quyết định O2: **Workers với static assets** ([ADR 0001](../adr/0001-web-on-cloudflare-workers-static-assets.md)). Worker được mô tả trong `apps/web/wrangler.jsonc` (asset lấy từ `./dist`, SPA fallback `not_found_handling = "single-page-application"`).

Cloudflare dashboard → **Workers & Pages** → Create → import repo GitHub (Workers Builds). Cấu hình (Settings → Build):

| Trường | Giá trị |
|---|---|
| Git branch | `main` (pull request có bản build preview) |
| Root directory | để trống (root của repo) |
| Build command | `pnpm --filter "@denimflow/web..." build` |
| Deploy command | `npx wrangler deploy --config apps/web/wrangler.jsonc` |
| Preview command | giữ mặc định (chỉ dùng cho bản preview của pull request) |
| Build variables | `PNPM_VERSION=12.14.0` (image build mặc định pnpm 10), `NODE_VERSION=24`, `VITE_API_URL` (URL Render), `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (publishable key của `denimflow-prod`) |

Các giá trị `VITE_*` được đóng gói vào bundle lúc build: đổi giá trị thì phải build lại. Không bao giờ đặt secret ở đây.

Sau lần deploy đầu: thêm URL web vào `CORS_ORIGINS` của API (Render) và vào Supabase (`denimflow-prod`) → Authentication → URL Configuration (Site URL và redirect URLs).

## 8. CI/CD (GitHub Actions)

| Workflow | Kích hoạt | Làm gì |
|---|---|---|
| `ci.yml` | PR, push lên `main` | Một job tên **`CI`** (bắt buộc theo ruleset `protect-main`): install (có cache, `--frozen-lockfile`), format check, lint, typecheck, test (Postgres 17 service container qua `TEST_DATABASE_URL`), build, kiểm tra export CJS/ESM của shared |
| `migrate.yml` | thủ công (`workflow_dispatch`) | Chạy trong GitHub Environment **`production`**: `prisma migrate deploy` với `PROD_DIRECT_URL`; bật input `seed` thì chạy thêm `db:seed` |
| `keep-alive.yml` | theo lịch (~10 phút), thủ công | `curl` tới `/health` của API để giảm cold start của Render và việc Supabase bị pause. URL nằm trong repository variable `API_HEALTH_URL` (Settings → Secrets and variables → Actions → Variables); job được skip khi biến còn trống |

Secret của environment **`production`** (Settings → Environments → production; muốn có bước duyệt tay thì thêm required reviewers ở đó):

| Secret | Giá trị |
|---|---|
| `PROD_DIRECT_URL` | Chuỗi kết nối session pooler (hoặc direct) của `denimflow-prod` |
| `PROD_SUPABASE_URL` | `https://<prod-ref>.supabase.co` (chỉ dùng cho seed) |
| `PROD_SUPABASE_SERVICE_ROLE_KEY` | Secret key của `denimflow-prod` (chỉ dùng cho seed) |
| `PROD_SEED_DEFAULT_PASSWORD` | Mật khẩu các tài khoản demo trên prod, ≥ 12 ký tự, **khác dev** (chỉ dùng cho seed) |

Các workflow dùng `permissions: contents: read`, và action được ghim theo SHA commit đầy đủ (comment ghi version); khi nâng cấp thì đổi cả hai. GitHub có thể trễ lịch chạy và tắt lịch trên repo public không có hoạt động trong 60 ngày; keep-alive là tiện ích, không phải bảo đảm. Ping mỗi 10 phút giữ Render thức khoảng 744 giờ/tháng, nằm trong 750 giờ miễn phí cho một service.

Ruleset `protect-main` bắt buộc check **`CI`** và 1 approval trước khi merge (T0.8). `.github/CODEOWNERS` tự động mời owner review.

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
