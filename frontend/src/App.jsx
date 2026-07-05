import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import Loading from "./components/Loading";
import { ThemeProvider } from "./components/Theme";

const AlertsPage = lazy(() => import("./pages/AlertsPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const DeviceDetailPage = lazy(() => import("./pages/DeviceDetailPage"));
const DevicesPage = lazy(() => import("./pages/DevicesPage"));

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Suspense fallback={<div className="route-loading"><Loading message="Đang mở trang..." /></div>}>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<DashboardPage />} />
              <Route path="devices" element={<DevicesPage />} />
              <Route path="devices/:deviceId" element={<DeviceDetailPage />} />
              <Route path="alerts" element={<AlertsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ThemeProvider>
  );
}
