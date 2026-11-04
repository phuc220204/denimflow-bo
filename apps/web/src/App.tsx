import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ProtectedLayout } from './layouts/protected-layout';
import { AuthProvider } from './lib/auth-context';
import { CatalogPage } from './pages/catalog';
import { HomePage } from './pages/home';
import { LoginPage } from './pages/login';
import { NotFoundPage } from './pages/not-found';
import { UsersPage } from './pages/users';
import { WorkflowDesignerPage } from './pages/workflow/workflow-designer';
import { OrdersPage } from './pages/orders';
import { InventoryPage } from './pages/inventory';
import { WorklistPage } from './pages/worklist';
import { AuditPage } from './pages/audit';
import { i18n } from './lib/i18n/dictionary';

// Loaded on demand: Recharts is only needed on the dashboard, so other roles never download it.
const WipDashboardPage = React.lazy(() =>
  import('./pages/dashboard').then((module) => ({ default: module.WipDashboardPage })),
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<ProtectedLayout />}>
              <Route index element={<HomePage />} />
              <Route path="users" element={<UsersPage />} />
              <Route path="catalog" element={<CatalogPage />} />
              <Route path="workflow" element={<WorkflowDesignerPage />} />
              <Route path="orders" element={<OrdersPage />} />
              <Route path="inventory" element={<InventoryPage />} />
              <Route path="worklist" element={<WorklistPage />} />
              <Route path="audit" element={<AuditPage />} />
              <Route
                path="dashboard"
                element={
                  <React.Suspense
                    fallback={<p className="text-sm text-text-muted">{i18n.common.loading}</p>}
                  >
                    <WipDashboardPage />
                  </React.Suspense>
                }
              />
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
};
