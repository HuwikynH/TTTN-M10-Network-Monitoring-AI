import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import LoadingState from "./components/LoadingState";

const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const DevicesPage = lazy(() => import("./pages/DevicesPage"));
const DeviceDetailPage = lazy(() => import("./pages/DeviceDetailPage"));
const AlertsPage = lazy(() => import("./pages/AlertsPage"));
const TrafficMonitorPage = lazy(() => import("./pages/TrafficMonitorPage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));

export default function App() {
  return (
    <Suspense fallback={<LoadingState label="Đang mở trang…" fullPage />}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="traffic" element={<TrafficMonitorPage />} />
          <Route path="devices" element={<DevicesPage />} />
          <Route path="devices/:deviceId" element={<DeviceDetailPage />} />
          <Route path="alerts" element={<AlertsPage />} />
          <Route path="404" element={<NotFoundPage />} />
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
