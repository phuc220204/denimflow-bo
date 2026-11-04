import { test, expect } from '@playwright/test';

test('FR-01 / FR-21: real browser login, dashboard and route authorization', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email làm việc').fill('manager@denimflow.internal');
  await page.getByLabel('Mật khẩu', { exact: true }).fill('e2e-only-password');
  await page.getByRole('button', { name: /Đăng nhập/ }).click();
  await expect(page).toHaveURL('/');
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Bảng điều khiển', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Bảng điều khiển', exact: true })).toBeVisible();
  await page.goto('/workflow');
  await expect(page.getByText(/403|không có quyền|không được phép/i).first()).toBeVisible();
});
