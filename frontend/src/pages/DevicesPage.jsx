import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { deviceApi } from "../api/api";
import DeviceForm from "../components/DeviceForm";
import EmptyState from "../components/EmptyState";
import ErrorBanner from "../components/ErrorBanner";
import LoadingState from "../components/LoadingState";
import Modal from "../components/Modal";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import useAutoRefresh from "../hooks/useAutoRefresh";
import { formatDateTime } from "../utils";

export default function DevicesPage() {
  const [devices, setDevices] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [actionError, setActionError] = useState("");
  const polling = useAutoRefresh(async (signal) => setDevices(await deviceApi.list({ signal })));
  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("vi");
    return devices.filter((device) => (statusFilter === "all" || device.status === statusFilter) && (!term || [device.name, device.ip_address, device.location].some((value) => value?.toLocaleLowerCase("vi").includes(term))));
  }, [devices, search, statusFilter]);

  const save = async (payload) => {
    if (editing) await deviceApi.update(editing.id, payload);
    else await deviceApi.create(payload);
    setEditing(null);
    setCreating(false);
    await polling.refresh();
  };
  const remove = async (device) => {
    if (!window.confirm("Xóa thiết bị “" + device.name + "” và toàn bộ metric, cảnh báo liên quan?")) return;
    setActionError("");
    try { await deviceApi.remove(device.id); await polling.refresh(); }
    catch (error) { setActionError(error.message); }
  };

  return (
    <div className="page">
      <PageHeader eyebrow="Quản lý hạ tầng" title="Thiết bị mạng" description="Quản lý danh mục thiết bị. Trạng thái Online/Offline được Backend cập nhật từ metric." actions={<button className="button button--primary" type="button" onClick={() => setCreating(true)}>+ Thêm thiết bị</button>} />
      {(polling.error || actionError) && <ErrorBanner message={actionError || polling.error.message} onRetry={polling.refresh} />}
      <section className="panel">
        <div className="filter-bar">
          <div className="field field--search"><label htmlFor="device-search">Tìm kiếm</label><input id="device-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tên, IP hoặc vị trí" /></div>
          <div className="field field--filter"><label htmlFor="device-status">Trạng thái</label><select id="device-status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">Tất cả</option><option value="online">Online</option><option value="offline">Offline</option><option value="unknown">Chưa xác định</option></select></div>
          <button className="button button--secondary filter-refresh" type="button" onClick={polling.refresh} disabled={polling.isRefreshing}>{polling.isRefreshing ? "Đang tải…" : "Tải lại"}</button>
        </div>
        {polling.isInitialLoading && !devices.length ? <LoadingState /> : polling.error && !polling.lastSuccessAt && !devices.length ? <EmptyState title="Chưa thể tải danh sách thiết bị" description="Kết nối lại Backend rồi thử tải dữ liệu." /> : !devices.length ? <EmptyState title="Chưa có thiết bị" description="Thêm thiết bị đầu tiên để Collector có thể gửi metric." action={<button className="button button--primary" type="button" onClick={() => setCreating(true)}>Thêm thiết bị</button>} /> : !filtered.length ? <EmptyState title="Không tìm thấy thiết bị" description="Hãy thay đổi từ khóa hoặc bộ lọc trạng thái." /> : (
          <div className="table-wrap"><table><thead><tr><th>Thiết bị</th><th>Địa chỉ IP</th><th>Vị trí</th><th>Trạng thái</th><th>Cập nhật</th><th>Hành động</th></tr></thead><tbody>{filtered.map((device) => <tr key={device.id}><td><Link className="table-primary" to={"/devices/" + device.id}>{device.name}</Link></td><td className="mono">{device.ip_address}</td><td>{device.location || "—"}</td><td><StatusBadge status={device.status} /></td><td>{formatDateTime(device.updated_at)}</td><td><div className="table-actions"><button className="text-button" type="button" onClick={() => setEditing(device)}>Sửa</button><button className="text-button text-button--danger" type="button" onClick={() => remove(device)}>Xóa</button></div></td></tr>)}</tbody></table></div>
        )}
      </section>
      {(creating || editing) && <Modal title={editing ? "Chỉnh sửa thiết bị" : "Thêm thiết bị"} onClose={() => { setCreating(false); setEditing(null); }}><DeviceForm device={editing} onSubmit={save} onCancel={() => { setCreating(false); setEditing(null); }} /></Modal>}
    </div>
  );
}
