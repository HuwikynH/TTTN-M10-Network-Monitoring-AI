import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { resetDemoData, USE_MOCK_DATA } from "../api/api";
import { useTheme } from "../context/ThemeContext";
import DemoDataBadge from "./DemoDataBadge";

const navigation = [
  { to: "/", label: "Tổng quan", end: true, icon: "grid" },
  { to: "/traffic", label: "Giám sát lưu lượng", icon: "pulse" },
  { to: "/devices", label: "Thiết bị", icon: "server" },
  { to: "/alerts", label: "Cảnh báo", icon: "bell" },
];

function Icon({ name }) {
  const paths = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    pulse: <path d="M3 12h4l2.2-6 4.2 12 2.2-6H21" />,
    server: <><rect x="3" y="4" width="18" height="6" rx="2" /><rect x="3" y="14" width="18" height="6" rx="2" /><path d="M7 7h.01M7 17h.01" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
  };
  return <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export default function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  useEffect(() => setMenuOpen(false), [location.pathname]);
  useEffect(() => {
    document.body.classList.toggle("menu-open", menuOpen);
    return () => document.body.classList.remove("menu-open");
  }, [menuOpen]);

  const handleResetDemo = () => {
    if (!window.confirm("Khôi phục toàn bộ dữ liệu mô phỏng về trạng thái ban đầu?")) return;
    resetDemoData();
    window.location.reload();
  };

  return (
    <div className="app-shell">
      <aside className={"sidebar" + (menuOpen ? " sidebar--open" : "")}>
        <div className="brand"><div className="brand-mark" aria-hidden="true">NM</div><div><strong>Network Monitoring AI</strong><small>TTTN M10</small></div></div>
        <nav className="main-nav" aria-label="Điều hướng chính">
          {navigation.map((item) => <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => isActive ? "nav-link nav-link--active" : "nav-link"}><Icon name={item.icon} /><span>{item.label}</span></NavLink>)}
        </nav>
        <div className="sidebar-footer"><span className="system-label">Network Operations Center</span><span className="system-version">{USE_MOCK_DATA ? "Mock API • localStorage" : "Frontend • REST API"}</span></div>
      </aside>
      {menuOpen && <button className="sidebar-backdrop" type="button" aria-label="Đóng menu" onClick={() => setMenuOpen(false)} />}
      <div className="app-content">
        <header className="topbar">
          <button className="icon-button mobile-menu-button" type="button" aria-label="Mở menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}><span /><span /><span /></button>
          <div className="topbar-context"><span className="topbar-dot" />Hệ thống giám sát đang sẵn sàng</div>
          <div className="topbar-actions">
            {USE_MOCK_DATA && <DemoDataBadge compact />}
            {USE_MOCK_DATA && <button className="demo-reset-button" type="button" onClick={handleResetDemo} title="Xóa thay đổi cục bộ và nạp lại bộ dữ liệu demo ban đầu">Đặt lại demo</button>}
            <button className="theme-toggle" type="button" onClick={toggleTheme} aria-label={"Chuyển sang giao diện " + (theme === "dark" ? "sáng" : "tối")}><span aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span><span>{theme === "dark" ? "Sáng" : "Tối"}</span></button>
          </div>
        </header>
        <main className="main-content"><Outlet /></main>
      </div>
    </div>
  );
}
