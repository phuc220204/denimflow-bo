import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  CheckCircle2,
  Lock,
  RefreshCw,
  Search,
  Unlock,
  UserCheck,
  UserCog,
  UserPlus,
  Users as UsersIcon,
  X,
} from 'lucide-react';
import React, { useState } from 'react';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { useAuth } from '../lib/auth-context';
import {
  createUserApi,
  fetchStations,
  fetchUsersApi,
  updateUserAssignmentApi,
  updateUserStatusApi,
  type UserStaffItem,
} from '../lib/api';
import { i18n } from '../lib/i18n/dictionary';
import type { Role } from '@denimflow/shared';

const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'bg-purple-100 text-purple-800 border-purple-300',
  PROCESS_ENGINEER: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  PRODUCTION_PLANNER: 'bg-blue-100 text-blue-800 border-blue-300',
  WAREHOUSE_KEEPER: 'bg-amber-100 text-amber-800 border-amber-300',
  STATION_OPERATOR: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  QC_INSPECTOR: 'bg-rose-100 text-rose-800 border-rose-300',
  MANAGER: 'bg-cyan-100 text-cyan-800 border-cyan-300',
};

const ALL_ROLES: Role[] = [
  'ADMIN',
  'PROCESS_ENGINEER',
  'PRODUCTION_PLANNER',
  'WAREHOUSE_KEEPER',
  'STATION_OPERATOR',
  'QC_INSPECTOR',
  'MANAGER',
];

export const UsersPage: React.FC = () => {
  const { token, user: currentUser } = useAuth();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Form state
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('DenimFlow@2026!');
  const [newFullName, setNewFullName] = useState('');
  const [newRole, setNewRole] = useState<Role>('STATION_OPERATOR');
  const [newStationId, setNewStationId] = useState<string>('');

  // Assignment Modal state
  const [editingAssignmentUser, setEditingAssignmentUser] = useState<UserStaffItem | null>(null);
  const [assignRole, setAssignRole] = useState<Role>('STATION_OPERATOR');
  const [assignStationId, setAssignStationId] = useState<string>('');

  // 1. Fetch Users
  const {
    data: users = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => fetchUsersApi(token),
  });

  // 2. Fetch Stations for dropdown
  const { data: stations = [] } = useQuery({
    queryKey: ['catalog-stations'],
    queryFn: fetchStations,
  });

  // 3. Mutation: Create User
  const createMutation = useMutation({
    mutationFn: (dto: {
      email: string;
      password: string;
      fullName: string;
      role: Role;
      stationId?: string | null;
    }) => createUserApi(dto, token),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setIsCreateOpen(false);
      setNewEmail('');
      setNewFullName('');
      setNewStationId('');
      setActionSuccess(`Đã tạo thành công tài khoản cho nhân viên '${created.fullName}'`);
      setActionError(null);
      setTimeout(() => setActionSuccess(null), 4000);
    },
    onError: (err: Error) => {
      setActionError(err.message || 'Không thể tạo nhân viên mới');
    },
  });

  // 4. Mutation: Update Status
  const statusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      updateUserStatusApi(id, isActive, token),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setActionSuccess(
        `Đã ${updated.isActive ? 'mở khóa' : 'tạm khóa'} tài khoản '${updated.fullName}'`,
      );
      setActionError(null);
      setTimeout(() => setActionSuccess(null), 4000);
    },
    onError: (err: Error) => {
      setActionError(err.message || 'Không thể cập nhật trạng thái');
    },
  });

  // 5. Mutation: Update Role & Station Assignment
  const assignMutation = useMutation({
    mutationFn: ({ id, role, stationId }: { id: string; role?: Role; stationId?: string | null }) =>
      updateUserAssignmentApi(id, { role, stationId }, token),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setEditingAssignmentUser(null);
      setActionSuccess(`Đã cập nhật vai trò & trạm làm việc cho '${updated.fullName}'`);
      setActionError(null);
      setTimeout(() => setActionSuccess(null), 4000);
    },
    onError: (err: Error) => {
      setActionError(err.message || 'Không thể cập nhật phân bổ nhân viên');
    },
  });

  const handleOpenAssign = (u: UserStaffItem) => {
    setEditingAssignmentUser(u);
    setAssignRole(u.role);
    setAssignStationId(u.stationId || '');
    setActionError(null);
  };

  const handleAssignSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAssignmentUser) return;
    setActionError(null);
    assignMutation.mutate({
      id: editingAssignmentUser.id,
      role: assignRole,
      stationId: assignStationId || null,
    });
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    createMutation.mutate({
      email: newEmail,
      password: newPassword,
      fullName: newFullName,
      role: newRole,
      stationId: newStationId || null,
    });
  };

  // Filtered users
  const filteredUsers = users.filter((u) => {
    const matchSearch =
      u.fullName.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.stationName && u.stationName.toLowerCase().includes(search.toLowerCase()));

    const matchRole = roleFilter === 'ALL' || u.role === roleFilter;
    const matchStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'ACTIVE' && u.isActive) ||
      (statusFilter === 'INACTIVE' && !u.isActive);

    return matchSearch && matchRole && matchStatus;
  });

  const activeCount = users.filter((u) => u.isActive).length;
  const inactiveCount = users.filter((u) => !u.isActive).length;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-text">
              Quản lý Nhân sự & Phân quyền xưởng may
            </h1>
            <Badge tone="info" className="bg-primary-tint text-primary border-primary">
              Admin Only (FR-01)
            </Badge>
          </div>
          <p className="text-sm text-text-muted mt-1">
            Quản lý tài khoản 7 vai trò, kích hoạt/khóa tài khoản nhân viên và liên kết phân bổ trạm
            sản xuất.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Làm mới
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-2"
          >
            <UserPlus className="h-4 w-4" />
            Tạo tài khoản nhân viên
          </Button>
        </div>
      </div>

      {/* Notifications */}
      {actionSuccess && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-800">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
          <span>{actionSuccess}</span>
        </div>
      )}
      {actionError && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800">
          <AlertCircle className="h-5 w-5 shrink-0 text-rose-600" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Tổng số tài khoản</CardDescription>
            <CardTitle className="text-2xl font-bold text-text flex items-center justify-between">
              {users.length}
              <UsersIcon className="h-5 w-5 text-text-muted" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-text-muted">Được quản lý trong hệ thống xưởng</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Đang hoạt động</CardDescription>
            <CardTitle className="text-2xl font-bold text-emerald-600 flex items-center justify-between">
              {activeCount}
              <UserCheck className="h-5 w-5 text-emerald-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-text-muted">Được cấp quyền đăng nhập & thao tác</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Tạm khóa</CardDescription>
            <CardTitle className="text-2xl font-bold text-rose-600 flex items-center justify-between">
              {inactiveCount}
              <Lock className="h-5 w-5 text-rose-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-text-muted">Bị chặn đăng nhập với mã 403 (T1.1)</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-surface p-4 rounded-lg border border-border">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-text-muted" />
          <Input
            placeholder="Tìm theo tên nhân viên, email hoặc trạm làm việc..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="ALL">Tất cả vai trò</option>
            {ALL_ROLES.map((r) => (
              <option key={r} value={r}>
                {i18n.roles[r] || r}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="ACTIVE">Đang hoạt động</option>
            <option value="INACTIVE">Tạm khóa</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-lg border border-border bg-surface overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-text-muted">Đang tải danh sách nhân sự...</div>
        ) : isError ? (
          <div className="p-8 text-center text-rose-600">
            {error instanceof Error ? error.message : 'Không thể tải danh sách nhân sự'}
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-8 text-center text-text-muted">
            Không tìm thấy nhân viên nào phù hợp với bộ lọc tìm kiếm.
          </div>
        ) : (
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-border bg-background/50 text-xs font-semibold text-text-muted uppercase">
                <th className="px-4 py-3">Họ và tên</th>
                <th className="px-4 py-3">Email đăng nhập</th>
                <th className="px-4 py-3">Vai trò xưởng may</th>
                <th className="px-4 py-3">Trạm làm việc</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredUsers.map((u) => {
                const isCurrent = currentUser?.id === u.id;
                const roleBadgeClass = ROLE_COLORS[u.role] || 'bg-gray-100 text-gray-800';

                return (
                  <tr key={u.id} className="hover:bg-background/40 transition-colors">
                    <td className="px-4 py-3 font-medium text-text">
                      <div className="flex items-center gap-2">
                        {u.fullName}
                        {isCurrent && (
                          <span className="text-[10px] bg-primary-tint text-primary px-1.5 py-0.5 rounded font-semibold">
                            (Bạn)
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-text-muted font-mono text-xs">{u.email}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${roleBadgeClass}`}
                      >
                        {i18n.roles[u.role] || u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-text-muted text-xs">
                      {u.stationName ? (
                        <span className="font-medium text-text">{u.stationName}</span>
                      ) : (
                        <span className="italic text-gray-400">— Chưa phân trạm —</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {u.isActive ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                          Hoạt động
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800">
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-600" />
                          Tạm khóa
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenAssign(u)}
                          className="text-xs h-8 text-primary border-primary/40 hover:bg-primary-tint"
                          title="Phân công trạm & vai trò sản xuất"
                        >
                          <UserCog className="h-3.5 w-3.5 mr-1" />
                          Phân trạm & Quyền
                        </Button>
                        <Button
                          variant={u.isActive ? 'outline' : 'primary'}
                          size="sm"
                          disabled={isCurrent || statusMutation.isPending}
                          onClick={() =>
                            statusMutation.mutate({
                              id: u.id,
                              isActive: !u.isActive,
                            })
                          }
                          className={`text-xs h-8 ${
                            u.isActive
                              ? 'text-rose-600 hover:bg-rose-50 border-rose-200'
                              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          }`}
                        >
                          {u.isActive ? (
                            <span className="flex items-center gap-1">
                              <Lock className="h-3.5 w-3.5" />
                              Khóa tài khoản
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <Unlock className="h-3.5 w-3.5" />
                              Mở khóa
                            </span>
                          )}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal Dialog: Tạo tài khoản mới */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-surface rounded-xl border border-border shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-background/50">
              <div className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-lg text-text">Thêm nhân viên xưởng may</h3>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-text-muted hover:text-text p-1 rounded-md transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-text mb-1">
                  Họ và tên nhân viên <span className="text-red-500">*</span>
                </label>
                <Input
                  required
                  placeholder="Ví dụ: Nguyễn Văn A"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text mb-1">
                  Email đăng nhập nội bộ <span className="text-red-500">*</span>
                </label>
                <Input
                  type="email"
                  required
                  placeholder="Ví dụ: nguyen.van.a@denimflow.internal"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text mb-1">
                  Mật khẩu khởi tạo <span className="text-red-500">*</span>
                </label>
                <Input
                  type="text"
                  required
                  placeholder="Mật khẩu từ 6 ký tự"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <p className="text-[11px] text-text-muted mt-1">
                  Mặc định gợi ý:{' '}
                  <code className="bg-background px-1 py-0.5 rounded">DenimFlow@2026!</code>
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-text mb-1">
                  Vai trò sản xuất (Role) <span className="text-red-500">*</span>
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as Role)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {ALL_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {i18n.roles[r] || r}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-text mb-1">
                  Phân công trạm làm việc (Dành cho Tổ trưởng / KCS)
                </label>
                <select
                  value={newStationId}
                  onChange={(e) => setNewStationId(e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">— Không gắn trạm cụ thể —</option>
                  {stations.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} - {s.name} ({s.stationType})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border mt-6">
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Hủy bỏ
                </Button>
                <Button type="submit" variant="primary" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Đang tạo...' : 'Xác nhận tạo tài khoản'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Dialog: Phân bổ trạm & vai trò */}
      {editingAssignmentUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-surface rounded-xl border border-border shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-background/50">
              <div className="flex items-center gap-2">
                <UserCog className="h-5 w-5 text-primary" />
                <div>
                  <h3 className="font-semibold text-lg text-text">Phân trạm & Vai trò nhân sự</h3>
                  <p className="text-xs text-text-muted">
                    {editingAssignmentUser.fullName} ({editingAssignmentUser.email})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingAssignmentUser(null)}
                className="text-text-muted hover:text-text p-1 rounded-md transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAssignSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-text mb-1">
                  Vai trò sản xuất (Role) <span className="text-red-500">*</span>
                </label>
                <select
                  value={assignRole}
                  onChange={(e) => setAssignRole(e.target.value as Role)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {ALL_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {i18n.roles[r] || r}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-text-muted mt-1">
                  Quyết định quyền truy cập các phân hệ nghiệp vụ và quyền ký duyệt lệnh.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-text mb-1">
                  Trạm sản xuất trực thuộc (Station)
                </label>
                <select
                  value={assignStationId}
                  onChange={(e) => setAssignStationId(e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">— Chưa phân trạm làm việc (hoặc Không cố định) —</option>
                  {stations.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} - {s.name} ({s.stationType})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-text-muted mt-1">
                  Gắn nhân viên vào trạm cụ thể để bàn giao mẻ hàng và ghi nhận sản lượng theo ca.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingAssignmentUser(null)}
                >
                  Hủy bỏ
                </Button>
                <Button type="submit" variant="primary" disabled={assignMutation.isPending}>
                  {assignMutation.isPending ? 'Đang lưu...' : 'Lưu phân bổ'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
