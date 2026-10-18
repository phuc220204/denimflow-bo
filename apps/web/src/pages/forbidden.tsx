import { AlertTriangle, ArrowLeft, ShieldAlert } from 'lucide-react';
import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { useAuth } from '../lib/auth-context';
import { i18n } from '../lib/i18n/dictionary';

export const ForbiddenPage: React.FC = () => {
  const { user } = useAuth();
  const roleName = user ? i18n.roles[user.role] || user.role : 'Khách';

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center p-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600 mb-4">
        <ShieldAlert className="h-8 w-8" />
      </div>

      <span className="text-xs font-semibold tracking-wider text-red-600 uppercase mb-1">
        Mã lỗi 403 &bull; Không có quyền truy cập
      </span>

      <h1 className="text-2xl font-bold text-text mb-2">Khu vực giới hạn quyền hạn</h1>

      <p className="max-w-md text-sm text-text-muted mb-6 leading-relaxed">
        Tài khoản của bạn hiện đang đăng nhập với vai trò{' '}
        <span className="font-semibold text-text">{roleName}</span>. Theo quy định phân quyền sản
        xuất của xưởng may, bạn không được phép xem hoặc chỉnh sửa khu vực này.
      </p>

      <div className="flex items-center gap-3">
        <Link to="/">
          <Button variant="primary" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Về bàn làm việc của tôi
          </Button>
        </Link>
      </div>

      <div className="mt-8 rounded-lg border border-border bg-surface p-4 text-left max-w-md w-full text-xs text-text-muted">
        <div className="flex items-center gap-2 font-semibold text-text mb-1">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          Quy định bảo mật phân quyền (RBAC)
        </div>
        <p>
          Mỗi vai trò (Admin, Kỹ sư quy trình, Kế hoạch, Thủ kho, Tổ trưởng chuyền, KCS, Quản đốc)
          chỉ được truy cập các phân hệ được cấp phép tương ứng với nhiệm vụ trên chuyền may.
        </p>
      </div>
    </div>
  );
};
