# Bắt đầu (cho thành viên mới)

Từ lúc clone repo đến khi chạy được bộ kiểm tra và API trên máy. Tài liệu đầy đủ (biến môi trường, deploy, CI) xem [`DEVELOPMENT_SETUP.md`](DEVELOPMENT_SETUP.md); quy trình nhánh, commit, pull request xem [`Tutorial_denimflow-bo.md`](../../Tutorial_denimflow-bo.md); chọn task xem [`docs/TASK_BOARD.md`](../TASK_BOARD.md).

Kiểm tra lần cuối: 2026-10-18, trên Windows 11 với Git Bash, với `main` sau PR #28 và bản sửa seed.

## 1. Hiện đã có gì

| Phần | Trạng thái |
|---|---|
| Monorepo root (pnpm workspace, TypeScript strict, ESLint, Prettier, Husky) | Xong (#3) |
| `packages/shared` và `packages/engine` (điều kiện, kiểm tra BR-01, gate, BOM) | Đã merge qua #26 (chưa review) |
| `apps/api`: auth (Supabase), user, catalog, workflow, đơn hàng, kho | Đã merge qua #26; hotfix bảo mật #28 (bắt buộc đăng nhập, phân quyền, dữ liệu sai trả 422) |
| `apps/web`: đăng nhập, menu theo role, catalog, user, thiết kế workflow, đơn hàng | Đã merge qua #26 |
| CI (GitHub Actions, job `CI`, bắt buộc trước khi merge) | Xong, đang xanh |
| Supabase | `denimflow-dev` đã có và đã migrate; `denimflow-prod` chưa (T0.1) |
| Seed (`pnpm db:seed`): catalog, 7 tài khoản demo, template "Jean Standard", BOM, lô vải | Chạy được (xem §6) |

## 2. Cài công cụ

| Công cụ | Phiên bản | Kiểm tra |
|---|---|---|
| Git | bản gần đây | `git --version` |
| Node.js | 24 (xem `.nvmrc`) | `node --version` |
| pnpm | ghim trong `package.json` gốc (`packageManager`) | `pnpm --version` |
| Docker Desktop | bản gần đây, đang chạy | `docker info` |
| VS Code | extension nên cài: ESLint, Prettier, Prisma | — |

- pnpm: chạy `corepack enable` một lần; corepack sẽ dùng đúng version trong `packageManager`. (Cài bằng `npm i -g pnpm` cũng được; pnpm tự chuyển sang version đã ghim.)
- Windows: chạy `git config --global core.longpaths true` và đặt repo ở đường dẫn ngắn (ví dụ `C:\dev\denimflow-bo`). Đường dẫn quá sâu sẽ gặp giới hạn độ dài đường dẫn của Windows ("Filename too long").

## 3. Clone và cài đặt

```bash
git clone https://github.com/phuc220204/denimflow-bo.git
cd denimflow-bo
pnpm install --frozen-lockfile
```

- `--frozen-lockfile` cài đúng như `pnpm-lock.yaml` ghi và báo lỗi nếu `package.json` với lockfile không khớp. CI dùng cùng cờ này.
- Lệnh cài cũng chạy `prisma generate` cho API (`postinstall`), tạo Prisma client trong `apps/api/src/generated/` (đã git ignore).
- pnpm chặn script cài đặt của dependency nếu chưa được cho phép. `pnpm-workspace.yaml` → `allowBuilds` chỉ cho phép `esbuild`, `prisma` và `@prisma/engines`. Nếu bạn thêm dependency cần chạy script, pnpm dừng với lỗi `ERR_PNPM_IGNORED_BUILDS`; hỏi team trước khi cho phép.

## 4. Chạy bộ kiểm tra giống CI

Test của API cần một Postgres tạm trong Docker. Test không bao giờ đụng Supabase.

```bash
pnpm --filter @denimflow/api db:test:up      # Postgres 17 ở localhost:54329
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build
pnpm --filter @denimflow/api db:test:down    # tắt khi xong (container bị xoá)
```

Cả năm lệnh phải pass trước khi mở pull request. `pnpm format` tự sửa định dạng.

## 5. Chạy API với database local (không có Supabase)

Dùng một database thứ hai trong cùng container Docker. Hợp để làm API và gọi `/health`; **đăng nhập thì cần Supabase** (§6), vì không còn đăng nhập local. Làm UI khi chưa có Supabase thì đặt `VITE_ENABLE_MSW=true` trong `apps/web/.env`.

```bash
pnpm --filter @denimflow/api db:test:up
docker exec denimflow-test-db createdb -U postgres denimflow_dev
cp apps/api/.env.example apps/api/.env
```

Sửa `apps/api/.env`, đặt hai dòng sau (giá trị local, an toàn):

```
DATABASE_URL=postgresql://postgres:postgres@localhost:54329/denimflow_dev
DIRECT_URL=postgresql://postgres:postgres@localhost:54329/denimflow_dev
```

Sau đó:

```bash
pnpm --filter @denimflow/api db:migrate:deploy
pnpm --filter @denimflow/api dev
```

Mở http://localhost:3000/health, kết quả mong đợi `{"status":"ok","db":"up"}`. Dừng server bằng Ctrl+C.

Lưu ý:
- `db:test:down` xoá container, kể cả `denimflow_dev`. Sau lần `db:test:up` tiếp theo, chạy lại bước `createdb` và `db:migrate:deploy`.
- Biến đã đặt sẵn trong shell được ưu tiên hơn `apps/api/.env`.
- `apps/api/.env` đã bị git ignore. Không bao giờ commit file này.

## 6. Sau khi có project Supabase (T0.1)

Xin owner giá trị **dev** của `apps/api/.env` (gửi riêng), hoặc tự điền theo [`DEVELOPMENT_SETUP.md`](DEVELOPMENT_SETUP.md) §4 và §5. Không bao giờ đặt connection string của production trong `.env` local.

```bash
pnpm --filter @denimflow/api db:migrate:deploy   # áp các migration đã commit
pnpm --filter @denimflow/api db:seed             # chỉ owner/người phụ trách: tạo hoặc cập nhật tài khoản demo
pnpm --filter @denimflow/api dev                 # API ở :3000
pnpm --filter @denimflow/api smoke:roles         # ở terminal khác: đăng nhập từng role và kiểm tra quyền
```

- `db:seed` idempotent (chạy lại an toàn). Cần `SEED_DEFAULT_PASSWORD` (ít nhất 12 ký tự) và sẽ đặt lại mật khẩu các tài khoản demo về giá trị đó.
- Tài khoản demo: `admin@`, `pe@`, `planner@`, `warehouse@`, `operator@`, `qc@`, `manager@` + `denimflow.internal`. Copy [`account-dev.example.md`](../../account-dev.example.md) thành `account-dev.md` (đã git ignore) và điền mật khẩu owner gửi riêng; AI agent đọc mật khẩu từ file đó.
- `smoke:roles` chỉ in mã HTTP, không ghi dữ liệu. Kết quả mong đợi: `ALL CHECKS PASSED`.

## 7. Quy trình hằng ngày

1. Chọn task trong [`docs/TASK_BOARD.md`](../TASK_BOARD.md) và đọc task file của nó trong `.agents/tasks/`.
2. `git switch main && git pull`, rồi `git switch -c <tên nhánh ghi trong task file>`.
3. Code, chạy §4, commit (Conventional Commits). Kiểm tra `git branch --show-current` trước mỗi commit: không bao giờ commit trên `main`.
4. Push nhánh và mở pull request theo template. CI phải xanh và có một thành viên approve.

Chi tiết: [`Tutorial_denimflow-bo.md`](../../Tutorial_denimflow-bo.md). Khi dùng AI coding agent, cho nó đọc [`AGENTS.md`](../../AGENTS.md) trước.

## 8. Lỗi thường gặp

| Hiện tượng | Nguyên nhân | Cách sửa |
|---|---|---|
| `Could not migrate the test database. Is it running?` | Docker hoặc container test chưa chạy | Mở Docker Desktop, rồi `pnpm --filter @denimflow/api db:test:up` |
| `docker: ... port is already allocated` (54329) | Container cũ hoặc một Postgres khác đang dùng port | `pnpm --filter @denimflow/api db:test:down`, hoặc tắt process kia |
| `failed to connect to the docker API` | Docker Desktop chưa mở | Mở Docker Desktop và chờ đến khi chạy xong |
| `ERR_PNPM_IGNORED_BUILDS` | Dependency mới muốn chạy script cài đặt | Hỏi team; chỉ cho phép package tin cậy bằng `pnpm approve-builds <tên>` |
| Cảnh báo `Unsupported engine` | Node không phải bản 24 | Cài Node 24 (nvm-windows: `nvm install 24 && nvm use 24`) |
| `Invalid environment configuration` khi chạy API | Thiếu biến bắt buộc trong `apps/api/.env` hoặc biến không phải URL | So với `apps/api/.env.example` (thông báo lỗi có liệt kê tên biến) |
| Prisma từ chối `migrate reset` khi AI agent chạy | Cơ chế an toàn của Prisma cho lệnh xoá dữ liệu | Tự chạy nếu thật sự muốn xoá database, hoặc tạo lại container Docker |
| `Filename too long` | Giới hạn độ dài đường dẫn của Windows | `git config --global core.longpaths true`, chuyển repo sang đường dẫn ngắn |
| Hook `pre-commit` từ chối commit | ESLint gặp lỗi không tự sửa được | Sửa lỗi, `git add`, commit lại. Không dùng `--no-verify` |
