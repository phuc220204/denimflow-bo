# Diễn tập demo

1. Review/CI rồi merge #33, #34, #37, #30; cập nhật #41 từ main. E2E đầy đủ phải pass trên chính branch #41 và CI trước khi merge.
2. Khởi động Postgres test bằng `pnpm --filter @denimflow/api db:test:up`. Tạo DB `denimflow_e2e` trong container test, hoặc đặt `TEST_DATABASE_URL` trỏ loopback DB `denimflow_test`. Test host từ chối Supabase/DB từ xa.
3. Chạy `pnpm --filter @denimflow/web exec playwright install chromium`, rồi `pnpm --filter @denimflow/web test:e2e`. Lệnh `test:e2e:smoke` chỉ kiểm tra browser login/dashboard/RBAC, độc lập các feature chưa merge. CI bắt buộc chạy toàn bộ `test:e2e`. Thiếu feature cần thiết sẽ làm test host lỗi, không tự bỏ qua test.
4. Auth/Storage chỉ được giả lập trong `scripts/e2e-server.mjs`, bind loopback, không được nạp khi chạy production. Mật khẩu fixture chỉ dùng test host, không đăng nhập được Supabase/API production.
5. Điền secrets trong Environment production. Reseed qua Actions → Migrate → seed=true (hoặc dispatch bằng `pnpm --filter @denimflow/api demo:reseed`). Thao tác này đặt lại mật khẩu 7 tài khoản demo theo secret đã cấu hình; giữ kín mật khẩu. Kiểm tra approval production và kết quả workflow.
6. Trước demo mở API `/health`, đợi `db=up`, mở web đã deploy, đăng nhập rồi diễn tập PRD §6. Đo request đầu sau thời gian idle; phản hồi warm không được ghi là cold start.
7. Trình bày FULL_PROCESS (QC lỗi, rework FINISHING, PASS, bàn giao) và SKIP_CLEAN_WASH (bắt buộc acknowledgement, chấp nhận độ co 4%/phai màu 2). Kiểm tra packing thực tế, WIP và audit.

Dependency dev mới: `@playwright/test` 1.64.1, Apache-2.0, Microsoft duy trì; metadata npm cập nhật 2026-11-04. Dùng để kiểm tra browser và API thật; Vitest component test không thay thế được. Không thêm dependency production.
