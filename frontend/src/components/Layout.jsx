import { NavLink, Outlet } from "react-router-dom";
import { ThemeToggle } from "./Theme";

const NAV_ITEMS = [
  { to: "/", label: "Tổng quan", end: true, icon: "dashboard" },
  { to: "/devices", label: "Thiết bị", icon: "devices" },
  { to: "/alerts", label: "Cảnh báo", icon: "alerts" },
];

function NavIcon({ name }) {
  if (name === "dashboard") {
    return <svg viewBox="0 0 24 24"><path d="M4 13h6V4H4v9Zm0 7h6v-4H4v4Zm10 0h6v-9h-6v9Zm0-16v4h6V4h-6Z" /></svg>;
  }

  if (name === "devices") {
    return <svg viewBox="0 0 24 24"><path d="M5 5h14v10H5V5Zm-2 0v10a2 2 0 0 0 2 2h5v2H7v2h10v-2h-3v-2h5a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2Z" /></svg>;
  }

  return <svg viewBox="0 0 24 24"><path d="M12 3a2 2 0 0 0-2 2v.35A7 7 0 0 0 5 12v4l-2 2v1h18v-1l-2-2v-4a7 7 0 0 0-5-6.65V5a2 2 0 0 0-2-2Zm0 19a3 3 0 0 0 2.83-2h-5.66A3 3 0 0 0 12 22Z" /></svg>;
}

export default function Layout() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">NM</div>
          <div>
            <strong>Network Monitoring AI</strong>
            <small>TTTN M10</small>
          </div>
        </div>

        <nav className="main-nav" aria-label="Điều hướng chính">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? "nav-link nav-link--active" : "nav-link")}
            >
              <span className="nav-link__icon" aria-hidden="true"><NavIcon name={item.icon} /></span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-actions">
          <ThemeToggle />
          <div className="sidebar-footer">
            <span className="pulse-dot" aria-hidden="true" />
            Giám sát thời gian thực
          </div>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
