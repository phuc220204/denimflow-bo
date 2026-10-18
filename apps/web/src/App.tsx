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
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
};
