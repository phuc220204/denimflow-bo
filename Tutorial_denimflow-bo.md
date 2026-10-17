# DenimFlow BO — Tutorial làm việc nhóm

Tài liệu dành cho **thành viên trong nhóm**: cấu hình môi trường, quy ước nhánh và commit, checklist trước khi push, quy trình đóng góp và cách làm việc với AI agent. Mô tả kiến trúc và công nghệ nằm trong `README.md`; luật dành cho agent nằm trong `AGENTS.md` và `.agents/rules/`.

> Quy ước ở đây là bản đọc dành cho người của `.agents/rules/03-git-and-pr-workflow.md`. Hai nơi phải luôn khớp nhau: sửa một nơi thì sửa nơi kia trong cùng PR.

## Repository

```text
https://github.com/<owner>/denimflow-bo
```

Thay `<owner>` bằng tài khoản GitHub của chủ repo. Repo **public**, nhánh `main` được bảo vệ bằng ruleset (xem mục "Quy trình đóng góp").

## Environment

Mỗi app có một file `.env` riêng. Hai file này **đã bị git ignore**, tuyệt đối không commit. Repo chỉ chứa `.env.example` với giá trị giả: copy ra rồi điền giá trị thật.

```powershell
copy apps\api\.env.example apps\api\.env
copy apps\web\.env.example apps\web\.env
```

### API

File:

```text
apps/api/.env
```

Nội dung:

```env
NODE_ENV=development
PORT=3000
DATABASE_URL=<chuỗi kết nối pooled (transaction mode) của project DEV>
DIRECT_URL=<chuỗi kết nối direct hoặc session pooler của project DEV>
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<key SECRET (service role), chỉ API được dùng>
SUPABASE_STORAGE_BUCKET=denimflow-files
CORS_ORIGINS=http://localhost:5173
SEED_DEFAULT_PASSWORD=<mật khẩu tự chọn cho user demo>
```

### Web

File:

```text
apps/web/.env
```

Nội dung:

```env
VITE_API_URL=http://localhost:3000
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<key anon/publishable (công khai)>
```

### Lấy giá trị ở đâu và quy tắc an toàn

| Biến | Lấy ở | Lưu ý |
|---|---|---|
| `DATABASE_URL`, `DIRECT_URL` | Supabase Dashboard → **Connect** | Dùng project `denimflow-dev` khi làm local. Không đặt chuỗi của `prod` trên máy cá nhân |
| `SUPABASE_URL` | Supabase → Project settings → API | Dùng chung cho API và web |
| `SUPABASE_ANON_KEY` (web) | cùng chỗ trên | Key công khai, được phép nằm trong bundle JavaScript |
| `SUPABASE_SERVICE_ROLE_KEY` | cùng chỗ trên | **Secret.** Chỉ nằm trong `apps/api/.env` và dashboard Render. Không bao giờ vào `apps/web` hay chat |
| `SEED_DEFAULT_PASSWORD` | tự đặt | Mật khẩu của các user demo, dùng khi chạy seed |

Vì sao tách như vậy: mọi biến `VITE_*` bị biên dịch thẳng vào JavaScript mà ai cũng tải được. Nếu để service role key ở đó thì người lạ có toàn quyền với database. Nếu lỡ commit secret lên repo public, xoá file ở commit sau **không đủ** vì key vẫn nằm trong lịch sử: phải thu hồi (rotate) key ngay trên Supabase.

## Quy ước tên nhánh

Format:

```text
<type>/<module>-<mô-tả-ngắn>
```

| `type` | Dùng khi |
|---|---|
| `feat` | Thêm tính năng hoặc cải tiến |
| `fix` | Sửa lỗi |
| `docs` | Chỉ đổi tài liệu |
| `refactor` | Cấu trúc lại code, không đổi hành vi |
| `test` | Thêm hoặc sửa test |
| `chore` | Việc vặt: dependency, cấu hình |
| `ci` | Workflow GitHub Actions |

`module` là một trong: `catalog`, `workflow`, `order`, `execution`, `quality`, `inventory`, `audit`, `engine`, `shared`, `web`, `api`, `db`, `ci`, `docs`.

### Ví dụ

```text
feat/order-confirm-snapshot
feat/engine-gate-chain
fix/execution-quantity-race
refactor/web-worklist-hooks
docs/database-design
chore/db-seed-demo-data
ci/keep-alive
```

### Quy tắc

- Chữ thường, ngăn cách bằng dấu `-`, tối đa khoảng 5 từ.
- **Một task = một nhánh = một PR.** Tên nhánh nên khớp task trong `.agents/tasks/` (ví dụ T3.5 → `feat/order-confirm`, đúng như dòng `Branch:` trong file task).
- Luôn tạo nhánh mới từ `main` đã cập nhật.
- Dự án **không có** nhánh `dev` hay `hotfix/`: `main` luôn phải deploy được, và một bản sửa gấp cũng đi qua nhánh `fix/` và PR như mọi thay đổi khác.

## Quy ước commit

Dự án dùng **Conventional Commits**. Format:

```bash
git commit -m "<type>(<scope>): <mô tả ngắn>"
```

Ví dụ:

```bash
git commit -m "feat(order): confirm order in a single transaction"
```

`<type>` gồm: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`, `perf`, `build`.
`<scope>` là module hoặc package giống phần `module` của tên nhánh.

### Ví dụ

```bash
git commit -m "feat(engine): add gate chain for step readiness"
git commit -m "fix(execution): lock step row before quantity entry"
git commit -m "docs(db): document audit log trigger"
git commit -m "test(workflow): cover BR-01 orphan step case"
git commit -m "chore(db): seed demo fabric lots"
git commit -m "ci: add keep-alive workflow"
```

### Quy tắc

- Viết tiếng Anh, thể mệnh lệnh, chữ thường, không có dấu chấm cuối, tối đa khoảng 72 ký tự.
- Thân commit (nếu cần) giải thích **vì sao**, không lặp lại cái gì. Ghi rule/task liên quan: `Refs: BR-03, T3.2`.
- **Tiêu đề PR** cũng viết theo format này, vì khi Squash and merge, tiêu đề PR trở thành commit duy nhất trên `main`. Vì vậy lịch sử nhỏ của nhánh (commit "wip", "fix typo") không ảnh hưởng gì.
- Không commit `.env`, `node_modules`, file build, dữ liệu khách hàng thật.

Tránh:

```bash
git commit -m "update"
git commit -m "Fix bug."
git commit -m "[FEATURE] (web): Create landing page"   # kiểu cũ, không dùng ở repo này
```

## Checklist trước khi push lên GitHub

Trước khi commit/push, chạy hết các lệnh dưới đây. Không báo lỗi, không báo warning, test pass và build thành công thì mới push. CI sẽ chạy đúng bấy nhiêu việc, nên chạy ở máy trước giúp bạn không phải chờ CI đỏ.

### Auto-format

Kiểm tra định dạng, nếu có lỗi thì tự sửa:

```bash
pnpm format:check
pnpm format
```

### Linting

```bash
pnpm lint
```

### TypeScript type check

```bash
pnpm typecheck
```

### Test

```bash
pnpm test
```

### Verify build

```bash
pnpm build
```

Chạy gộp một lần:

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

### Checklist thêm (không có lệnh tự động)

- [ ] Có đổi schema? → đã có migration, đã bật RLS cho bảng mới, đã cập nhật `docs/*/DATABASE_DESIGN.md` (EN **và** VI).
- [ ] Có đổi hành vi nghiệp vụ? → đã cập nhật `docs/*/BUSINESS_RECONCILIATION.md` (EN và VI).
- [ ] Có biến môi trường mới? → đã thêm vào `.env.example` và `docs/*/DEVELOPMENT_SETUP.md`.
- [ ] Không có secret, `.env` hay dữ liệu thật trong diff: xem lại bằng `git diff --staged`.
- [ ] Đã cập nhật `PROJECT_STATE.md` nếu thay đổi trạng thái hoặc quyết định.

## Quy trình đóng góp (từng bước)

### Bước 1. Clone repo và cài dependency

> Hướng dẫn cài đặt từng bước, cập nhật theo trạng thái hiện tại của repo (Docker, chạy API khi chưa có Supabase, lỗi hay gặp): [`docs/vi/GETTING_STARTED.md`](docs/vi/GETTING_STARTED.md). Chọn task ở [`docs/TASK_BOARD.md`](docs/TASK_BOARD.md).

```bash
git clone https://github.com/<owner>/denimflow-bo.git
cd denimflow-bo
pnpm install
```

`pnpm install` cài dependency cho mọi workspace và tự cấu hình Git hook (Husky) trên máy bạn. Sau đó tạo file `.env` như mục **Environment**.

### Bước 2. Tạo nhánh từ `main` mới nhất

```bash
git switch main
git pull
git switch -c feat/order-confirm-snapshot
```

### Bước 3. Code và chạy thử

```bash
pnpm dev                  # web (cổng 5173) và API (cổng 3000) cùng lúc
pnpm --filter @denimflow/engine test    # chạy riêng test engine, rất nhanh
```

### Bước 4. Chạy checklist trước khi commit

Xem mục **Checklist trước khi push**.

### Bước 5. Commit

```bash
git add <các file của task>
git commit -m "feat(order): confirm order in a single transaction"
```

Khi bạn commit, hook `pre-commit` tự chạy `lint-staged` trên **các file đã stage**: ESLint sửa lỗi tự sửa được, Prettier định dạng lại. Nếu còn lỗi không tự sửa được, commit bị từ chối. Đọc thông báo ở terminal, sửa lỗi, `git add` lại rồi commit lại. Đừng dùng `git commit --no-verify` để lách hook.

Nên `git add` từng file hoặc thư mục của task thay vì `git add .` để không vô tình đưa file ngoài ý muốn vào commit.

### Bước 6. Cập nhật nhánh nếu `main` đã đi xa hơn

```bash
git fetch origin
git merge origin/main
```

Dùng `merge` cho đơn giản và an toàn với người mới. Nếu bị xung đột ở `pnpm-lock.yaml`: lấy bản của `main` (`git checkout origin/main -- pnpm-lock.yaml`) rồi chạy `pnpm install` để sinh lại.

### Bước 7. Push nhánh

```bash
git push -u origin feat/order-confirm-snapshot
```

### Bước 8. Mở Pull Request

Trên GitHub, bấm **Compare & pull request**:

- **Base branch**: `main`.
- **Compare branch**: nhánh của bạn.
- **Tiêu đề**: theo Conventional Commits, ví dụ `feat(order): confirm order in a single transaction`.
- **Mô tả**: điền theo template (làm gì, vì sao, liên quan FR/BR/task nào, cách kiểm tra, ảnh chụp màn hình nếu có đổi UI).
- GitHub Actions tự chạy `format:check`, `lint`, `typecheck`, `test`, `build`. CI phải xanh.

### Bước 9. Review và merge

Ruleset của `main` yêu cầu:

- Phải qua Pull Request, **không push thẳng**. Thử push thẳng sẽ gặp lỗi `GH013: Repository rule violations`.
- Cần **1 approval** từ người khác. Người push commit cuối không tự approve được.
- Comment review phải được resolve hết.
- Chỉ dùng **Squash and merge**; lịch sử một đường thẳng.
- Không force push, không xoá `main`.

Người review: đọc diff, kiểm tra checklist trong template, chạy thử nếu thay đổi UI hoặc nghiệp vụ, để lại comment cụ thể. Người tạo PR: sửa theo comment, push thêm commit vào cùng nhánh.

### Bước 10. Dọn dẹp sau khi merge

Nhánh trên GitHub được tự xoá sau khi merge. Ở máy bạn:

```bash
git switch main
git pull
git branch -d feat/order-confirm-snapshot
```

## Làm việc với AI agent (vibe code)

Dự án được phát triển có sự hỗ trợ của AI agent. Agent đọc luật từ `AGENTS.md`, nhưng bạn vẫn là người chịu trách nhiệm cho từng dòng được merge.

### Cách giao việc

1. Chọn **một** task trong `.agents/tasks/` (ví dụ `S3 / T3.5`).
2. Bảo agent đọc đúng thứ tự trong `AGENTS.md` mục 2 "Read before you code".
3. Yêu cầu agent **lập kế hoạch trước** và chờ bạn đồng ý khi task chạm hơn khoảng 3 file hoặc đổi schema.
4. Agent làm trên nhánh của task, không đụng `main`.

Prompt mẫu:

```text
Đọc AGENTS.md (mục 2), PROJECT_STATE.md và task T3.5 trong .agents/tasks/S3-order-confirm-snapshot.md.
Trước khi viết code, hãy đưa kế hoạch các bước nhỏ và các file sẽ sửa, giải thích vì sao.
Chưa tạo hay sửa file nào cho đến khi tôi đồng ý.
Làm trên nhánh feat/order-confirm (theo dòng Branch của task). Trả lời bằng tiếng Việt, giữ nguyên thuật ngữ tiếng Anh.
```

### Quy tắc khi dùng agent

- **Một task = một nhánh = một PR.** Không để agent gộp nhiều task vào một lần.
- Tự đọc `git diff` trước khi commit. Nếu agent sửa file không liên quan, yêu cầu hoàn tác phần đó.
- Không dán key, token, connection string thật vào cuộc trò chuyện với agent.
- Không cho agent push lên `main` hay tự merge PR. Việc push nhánh và mở PR chỉ làm khi bạn bảo.
- Việc của người (`[owner: human]` trong task file) như tạo project Supabase, cấu hình dashboard: agent chỉ hướng dẫn, bạn tự làm.
- Nếu agent đề xuất thêm thư viện, yêu cầu nó nêu lý do, license và phương án thay thế.
- Khi agent làm sai hoặc tài liệu thiếu, **sửa tài liệu** (rule/skill/docs) để lần sau không lặp lại, thay vì chỉ sửa code.

## Phân vai và sở hữu module (điền tên)

Phân vai theo module giúp tránh xung đột khi nhiều người cùng sửa. Nhóm điền tên thật và cập nhật `.github/CODEOWNERS` sau Sprint 0.

| Thành viên | Phụ trách chính | Sở hữu |
|---|---|---|
| M1: ______ | Tech lead, Workflow Engine, review | `packages/engine`, `modules/workflow`, ADR |
| M2: ______ | BE luồng sản xuất | `modules/order`, `execution`, `inventory` |
| M3: ______ | BE nền tảng, DevOps | Auth/RBAC, `catalog`, `quality`, `audit`, CI/CD, deploy |
| M4: ______ | FE vận hành | app shell, `catalog`, `orders`, `station-worklist` |
| M5: ______ | FE thiết kế, docs, QA | `workflow-designer`, `dashboard`, `quality` UI, tài liệu, E2E |

Thay đổi ở `packages/shared` ảnh hưởng cả FE và BE: làm bằng PR nhỏ, merge sớm, rồi hai phía mới dựa vào.

## Lỗi thường gặp

| Triệu chứng | Nguyên nhân | Cách xử lý |
|---|---|---|
| `GH013: Repository rule violations` khi push | Đang push thẳng lên `main` | Xem mục dưới "Lỡ commit lên `main` ở máy" |
| Commit bị từ chối, in lỗi ESLint/Prettier | Hook `pre-commit` phát hiện lỗi | Đọc lỗi, sửa, `git add` lại, commit lại. Chạy `pnpm format` để tự sửa định dạng |
| CI đỏ nhưng máy bạn xanh | Quên một bước, hoặc khác phiên bản Node/pnpm | Chạy đủ chuỗi lệnh trong checklist; kiểm tra `.nvmrc` và `packageManager` |
| Xung đột `pnpm-lock.yaml` | Hai người đổi dependency song song | Lấy bản của `main`, chạy lại `pnpm install` |
| `git status` thấy cả file bị đổi dù bạn không sửa | Khác kiểu xuống dòng CRLF/LF | Giữ `.gitattributes`; chạy `git add --renormalize .` |
| Xuất hiện file/thư mục tên có chữ `copy` | Dán file trong VS Code Explorer khi đã có file trùng tên | Dùng File Explorer của Windows và chọn "Replace", hoặc dùng lệnh `Move-Item`/`Copy-Item` |
| API chậm khoảng 1 phút ở request đầu | Render free đang "ngủ" | Chờ, hoặc gọi `/health` trước; workflow keep-alive giảm nhẹ |
| Lỗi CORS ở trình duyệt | `CORS_ORIGINS` thiếu origin của web | Sửa biến, chạy lại API |
| Lỡ commit `.env` hoặc key | Quên kiểm tra `git diff --staged` | **Thu hồi (rotate) key ngay**, rồi nhờ người rành git xoá khỏi lịch sử. Xoá file ở commit sau là chưa đủ |

### Lỡ commit lên `main` ở máy

Chưa push thì chưa sao. Giữ lại công việc trên nhánh mới rồi đưa `main` về giống GitHub:

```bash
git switch -c feat/my-work        # giữ commit trên nhánh mới
git switch main
git reset --hard origin/main      # CHỈ chạy sau khi đã tạo nhánh ở trên
git switch feat/my-work
```

`git reset --hard` xoá thay đổi chưa lưu ở nhánh hiện tại. Vì vậy phải tạo nhánh mới trước.

## Đọc tiếp

| Chủ đề | File |
|---|---|
| Kiến trúc, công nghệ, cấu trúc repo | `README.md` |
| Luật cho agent | `AGENTS.md`, `.agents/rules/` |
| Setup môi trường, deploy, xử lý sự cố | `docs/vi/DEVELOPMENT_SETUP.md` |
| Yêu cầu sản phẩm và demo | `docs/vi/PRD.md` |
| Schema database | `docs/vi/DATABASE_DESIGN.md` |
| Business rules và truy vết FR | `docs/vi/BUSINESS_RECONCILIATION.md` |
| Backlog theo sprint | `.agents/tasks/` |
| Link tài liệu thư viện | `HELP.md` |
