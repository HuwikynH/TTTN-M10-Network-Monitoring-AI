import { Link } from "react-router-dom";
import EmptyState from "../components/EmptyState";

export default function NotFoundPage() {
  return <div className="page page--center"><EmptyState title="Không tìm thấy trang" description="Đường dẫn bạn mở không tồn tại trong hệ thống." action={<Link className="button button--primary" to="/">Quay về tổng quan</Link>} /></div>;
}
