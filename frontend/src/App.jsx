import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import ProductsPage from './pages/ProductsPage.jsx';
import OrdersPage from './pages/OrdersPage.jsx';
import OrderDetailPage from './pages/OrderDetailPage.jsx';
import UsersPage from './pages/UsersPage.jsx';
import CategoriesPage from './pages/CategoriesPage.jsx';
import CarsPage from './pages/CarsPage.jsx';
import TechVariantsPage from './pages/TechVariantsPage.jsx';
import PromotionsPage from './pages/PromotionsPage.jsx';
import FaqsPage from './pages/FaqsPage.jsx';
import SiteContentPage from './pages/SiteContentPage.jsx';
import ReviewsManagePage from './pages/ReviewsManagePage.jsx';
import SupportChatsPage from './pages/SupportChatsPage.jsx';
import { useProfile } from './api/useProfile.js';
import AdminStatsPage from './pages/AdminStatsPage.jsx';
import AdminAuditLogsPage from './pages/AdminAuditLogsPage.jsx';
import { AdminLayout, DashboardHome, ManagerLayout, RequireGroup } from './components/DashboardLayouts.jsx';

function App() {
  const { profile, loading } = useProfile();
  const groups = profile?.groups || [];
  const isAdmin = groups.includes('Администратор');

  return (
    <Routes>
      <Route path="/" element={<DashboardHome profile={profile} loading={loading} />} />

      <Route
        path="/admin"
        element={
          <RequireGroup profile={profile} loading={loading} allowedGroups={['Администратор']}>
            <AdminLayout />
          </RequireGroup>
        }
      >
        <Route index element={<Navigate to="orders" replace />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="orders/:orderId" element={<OrderDetailPage />} />
        <Route path="products" element={<ProductsPage isAdmin role="admin" />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="categories" element={<CategoriesPage isAdmin />} />
        <Route path="cars" element={<CarsPage isAdmin />} />
        <Route path="tech" element={<TechVariantsPage isAdmin />} />
        <Route path="stats" element={<AdminStatsPage />} />
        <Route path="logs" element={<AdminAuditLogsPage />} />
        <Route path="promotions" element={<PromotionsPage isAdmin />} />
        <Route path="faq" element={<FaqsPage />} />
        <Route path="site-content" element={<SiteContentPage />} />
        <Route path="reviews" element={<ReviewsManagePage isAdmin />} />
        <Route path="support" element={<SupportChatsPage />} />
      </Route>

      <Route
        path="/manager"
        element={
          <RequireGroup profile={profile} loading={loading} allowedGroups={['Менеджер', 'Администратор']}>
            <ManagerLayout />
          </RequireGroup>
        }
      >
        <Route index element={<Navigate to="orders" replace />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="orders/:orderId" element={<OrderDetailPage />} />
        <Route path="products" element={<ProductsPage isAdmin={isAdmin} role="manager" />} />
        <Route path="categories" element={<CategoriesPage isAdmin={false} />} />
        <Route path="cars" element={<CarsPage isAdmin={false} canDelete={false} />} />
        <Route path="tech" element={<TechVariantsPage isAdmin={false} />} />
        <Route path="promotions" element={<PromotionsPage isAdmin={isAdmin} />} />
        <Route path="faq" element={<FaqsPage />} />
        <Route path="site-content" element={<SiteContentPage />} />
        <Route path="reviews" element={<ReviewsManagePage isAdmin={isAdmin} />} />
        <Route path="support" element={<SupportChatsPage />} />
      </Route>

      <Route path="*" element={<p>Страница не найдена</p>} />
    </Routes>
  );
}

export default App;
