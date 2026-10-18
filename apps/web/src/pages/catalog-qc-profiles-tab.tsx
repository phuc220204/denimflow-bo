import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Edit2,
  FileCheck,
  FileText,
  RefreshCw,
  Sliders,
  X,
} from 'lucide-react';
import React, { useState } from 'react';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { useAuth } from '../lib/auth-context';
import {
  fetchStyles,
  fetchStyleQcProfiles,
  updateStyleQcProfileApi,
  type QcProfileItem,
  type StyleItem,
} from '../lib/api';

interface EditProfileState {
  style: StyleItem;
  profile: QcProfileItem;
}

export const QcProfilesTab: React.FC = () => {
  const { user, token } = useAuth();
  const queryClient = useQueryClient();
  const canEdit = user?.role === 'ADMIN' || user?.role === 'PROCESS_ENGINEER';

  const [selectedStyleId, setSelectedStyleId] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditProfileState | null>(null);
  const [shrinkageInput, setShrinkageInput] = useState<string>('3.0');
  const [fadingInput, setFadingInput] = useState<string>('1');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 1. Fetch Styles
  const {
    data: styles = [],
    isLoading: loadingStyles,
    refetch: refetchStyles,
  } = useQuery({
    queryKey: ['styles'],
    queryFn: fetchStyles,
  });

  // Effective selected style
  const activeStyle = styles.find((s) => s.id === selectedStyleId) || styles[0] || null;

  // 2. Fetch QC Profiles for active style
  const {
    data: qcProfiles = [],
    isLoading: loadingProfiles,
    refetch: refetchProfiles,
  } = useQuery({
    queryKey: ['catalog', 'styles', activeStyle?.id, 'qc-profiles'],
    queryFn: () => (activeStyle ? fetchStyleQcProfiles(activeStyle.id) : Promise.resolve([])),
    enabled: !!activeStyle,
  });

  // 3. Mutation: Update QC Profile
  const updateMutation = useMutation({
    mutationFn: (data: {
      styleId: string;
      profileType: 'FULL_PROCESS' | 'SKIP_CLEAN_WASH';
      dto: { maxShrinkagePercent: number; maxColorFadingLevel: number };
    }) => updateStyleQcProfileApi(data.styleId, data.profileType, data.dto, token),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({
        queryKey: ['catalog', 'styles', activeStyle?.id, 'qc-profiles'],
      });
      setEditing(null);
      setSuccessMsg(
        `Đã lưu tiêu chuẩn kiểm định ${updated.profileType === 'FULL_PROCESS' ? 'Giặt sạch đầy đủ' : 'Bỏ giặt sạch'} thành công (BR-19, BR-16)!`,
      );
      setTimeout(() => setSuccessMsg(null), 4000);
    },
    onError: (err: Error) => {
      setErrorMsg(err.message || 'Không thể cập nhật tiêu chuẩn QC Profile');
    },
  });

  const handleOpenEdit = (style: StyleItem, profile: QcProfileItem) => {
    setEditing({ style, profile });
    setShrinkageInput(String(profile.maxShrinkagePercent));
    setFadingInput(String(profile.maxColorFadingLevel));
    setErrorMsg(null);
  };

  const handleSaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;

    const shrinkage = parseFloat(shrinkageInput);
    const fading = parseInt(fadingInput, 10);

    if (isNaN(shrinkage) || shrinkage < 0 || shrinkage > 100) {
      setErrorMsg('Độ co rút tối đa phải là số từ 0% đến 100%');
      return;
    }

    if (isNaN(fading) || fading < 0 || fading > 5) {
      setErrorMsg('Mức phai màu tối đa phải từ 0 (không phai) đến 5 (phai nặng)');
      return;
    }

    updateMutation.mutate({
      styleId: editing.style.id,
      profileType: editing.profile.profileType,
      dto: {
        maxShrinkagePercent: shrinkage,
        maxColorFadingLevel: fading,
      },
    });
  };

  if (loadingStyles) {
    return (
      <div className="flex h-64 items-center justify-center text-text-muted">
        <RefreshCw className="h-6 w-6 animate-spin text-primary mr-2" />
        Đang tải danh sách kiểu dáng...
      </div>
    );
  }

  const fullProcessProfile = qcProfiles.find((p) => p.profileType === 'FULL_PROCESS');
  const skipCleanWashProfile = qcProfiles.find((p) => p.profileType === 'SKIP_CLEAN_WASH');
  const hasBothProfiles = !!fullProcessProfile && !!skipCleanWashProfile;

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface p-4 rounded-lg border border-border">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-text flex items-center gap-1.5">
              <Sliders className="h-4 w-4 text-primary" />
              Cấu hình Ngưỡng dung sai QC Profile (Quality Control Profiles)
            </h2>
            <Badge tone="info" className="text-xs bg-primary-tint text-primary border-primary">
              BR-19 &bull; FR-28
            </Badge>
            <Badge tone="info" className="text-xs">
              Dữ liệu mẫu demo (R-14)
            </Badge>
          </div>
          <p className="text-xs text-text-muted mt-1 max-w-3xl">
            Mỗi kiểu dáng jeans (Style) bắt buộc có 02 cấu hình QC:{' '}
            <strong className="text-text">FULL_PROCESS</strong> (Giặt sạch đầy đủ) và{' '}
            <strong className="text-text">SKIP_CLEAN_WASH</strong> (Bỏ giặt sạch theo cam kết ký của
            khách). KCS sẽ dựa vào đúng profile của đơn hàng để phán quyết Đạt / Làm lại / Từ chối
            (BR-10, BR-19).
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            refetchStyles();
            refetchProfiles();
          }}
          className="flex items-center gap-1.5 h-9 shrink-0"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Làm mới
        </Button>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-800">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-300 bg-rose-50 p-3 text-xs text-rose-800">
          <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Style Selector Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-border">
        <span className="text-xs font-semibold text-text-muted whitespace-nowrap">
          Chọn kiểu dáng:
        </span>
        {styles.map((s) => {
          const isSelected = activeStyle?.id === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setSelectedStyleId(s.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                isSelected
                  ? 'bg-primary text-white shadow-sm font-semibold'
                  : 'bg-surface text-text hover:bg-background border border-border'
              }`}
            >
              <span className="font-mono">{s.styleCode}</span> &bull; {s.name}
            </button>
          );
        })}
      </div>

      {/* Style Details & Missing Profiles Warning */}
      {activeStyle && !hasBothProfiles && !loadingProfiles && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
          <span>
            <strong>Cảnh báo nghiệp vụ (BR-19):</strong> Kiểu dáng {activeStyle.styleCode} chưa đủ
            02 profile bắt buộc. Cần khởi tạo đủ cả FULL_PROCESS và SKIP_CLEAN_WASH trước khi xác
            nhận đơn may.
          </span>
        </div>
      )}

      {/* QC Profile Cards Grid */}
      {activeStyle && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 1. FULL_PROCESS Profile Card */}
          <Card className="border border-border shadow-sm flex flex-col justify-between">
            <CardHeader className="border-b border-border pb-4 bg-background/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                    <FileCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base text-text">FULL_PROCESS</CardTitle>
                    <CardDescription className="text-xs">
                      Quy trình tiêu chuẩn &bull; Có công đoạn Giặt sạch
                    </CardDescription>
                  </div>
                </div>
                <Badge
                  tone="success"
                  className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[11px]"
                >
                  Mặc định cho đơn hàng
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="pt-5 space-y-4 flex-1">
              <p className="text-xs text-text-muted leading-relaxed">
                Áp dụng khi sản phẩm trải qua công đoạn <strong>CLEAN_WASH (Giặt sạch)</strong> để
                định hình co giãn và độ bền màu. Khách hàng nhận quần có thể mặc và giặt nước đầu
                tiên mà không biến dạng.
              </p>

              {loadingProfiles ? (
                <div className="py-4 text-xs text-text-muted text-center">Đang tải thông số...</div>
              ) : fullProcessProfile ? (
                <div className="grid grid-cols-2 gap-3 bg-surface p-3 rounded-lg border border-border text-center">
                  <div className="p-2 bg-background rounded border border-border">
                    <span className="text-[11px] text-text-muted block">Độ co rút tối đa</span>
                    <span className="text-lg font-bold text-text font-mono">
                      &le; {fullProcessProfile.maxShrinkagePercent}%
                    </span>
                    <span className="text-[10px] text-emerald-600 block mt-0.5">
                      Tiêu chuẩn khắt khe
                    </span>
                  </div>

                  <div className="p-2 bg-background rounded border border-border">
                    <span className="text-[11px] text-text-muted block">Mức phai màu tối đa</span>
                    <span className="text-lg font-bold text-text font-mono">
                      Cấp {fullProcessProfile.maxColorFadingLevel}
                    </span>
                    <span className="text-[10px] text-emerald-600 block mt-0.5">
                      Thang đo 0 (chuẩn) - 5
                    </span>
                  </div>
                </div>
              ) : (
                <div className="py-4 text-xs text-amber-700 bg-amber-50 rounded p-2 text-center">
                  Chưa cấu hình profile này
                </div>
              )}

              <div className="text-[11px] text-text-muted flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-text-muted" />
                <span>Không yêu cầu biên bản cam kết bỏ giặt</span>
              </div>
            </CardContent>

            <div className="p-4 border-t border-border bg-background/30 flex justify-end">
              {fullProcessProfile && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!canEdit}
                  onClick={() => handleOpenEdit(activeStyle, fullProcessProfile)}
                  className="flex items-center gap-1.5 text-xs"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                  {canEdit ? 'Điều chỉnh ngưỡng dung sai' : 'Chỉ xem'}
                </Button>
              )}
            </div>
          </Card>

          {/* 2. SKIP_CLEAN_WASH Profile Card */}
          <Card className="border border-border shadow-sm flex flex-col justify-between">
            <CardHeader className="border-b border-border pb-4 bg-background/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base text-text">SKIP_CLEAN_WASH</CardTitle>
                    <CardDescription className="text-xs">
                      Bỏ giặt sạch &bull; Dung sai nới lỏng theo cam kết
                    </CardDescription>
                  </div>
                </div>
                <Badge
                  tone="warning"
                  className="bg-amber-50 text-amber-700 border-amber-300 text-[11px]"
                >
                  Cần ký cam kết (BR-18, 19)
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="pt-5 space-y-4 flex-1">
              <p className="text-xs text-text-muted leading-relaxed">
                Áp dụng khi khách yêu cầu <strong>bỏ qua bước giặt sạch để hạ giá thành</strong>.
                Sản phẩm chưa ổn định nên dung sai co rút và phai màu được nới lỏng hơn bình thường.
              </p>

              {loadingProfiles ? (
                <div className="py-4 text-xs text-text-muted text-center">Đang tải thông số...</div>
              ) : skipCleanWashProfile ? (
                <div className="grid grid-cols-2 gap-3 bg-surface p-3 rounded-lg border border-border text-center">
                  <div className="p-2 bg-background rounded border border-border">
                    <span className="text-[11px] text-text-muted block">Độ co rút tối đa</span>
                    <span className="text-lg font-bold text-amber-700 font-mono">
                      &le; {skipCleanWashProfile.maxShrinkagePercent}%
                    </span>
                    <span className="text-[10px] text-amber-600 block mt-0.5">
                      Dung sai nới lỏng
                    </span>
                  </div>

                  <div className="p-2 bg-background rounded border border-border">
                    <span className="text-[11px] text-text-muted block">Mức phai màu tối đa</span>
                    <span className="text-lg font-bold text-amber-700 font-mono">
                      Cấp {skipCleanWashProfile.maxColorFadingLevel}
                    </span>
                    <span className="text-[10px] text-amber-600 block mt-0.5">
                      Thang đo 0 (chuẩn) - 5
                    </span>
                  </div>
                </div>
              ) : (
                <div className="py-4 text-xs text-amber-700 bg-amber-50 rounded p-2 text-center">
                  Chưa cấu hình profile này
                </div>
              )}

              <div className="text-[11px] text-amber-800 bg-amber-50/80 p-2 rounded flex items-center gap-1.5 border border-amber-200">
                <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                <span>
                  Bắt buộc đính kèm văn bản cam kết có chữ ký khách hàng trước khi Confirm đơn
                </span>
              </div>
            </CardContent>

            <div className="p-4 border-t border-border bg-background/30 flex justify-end">
              {skipCleanWashProfile && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!canEdit}
                  onClick={() => handleOpenEdit(activeStyle, skipCleanWashProfile)}
                  className="flex items-center gap-1.5 text-xs"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                  {canEdit ? 'Điều chỉnh ngưỡng dung sai' : 'Chỉ xem'}
                </Button>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Modal Dialog: Cập nhật tiêu chuẩn QC Profile */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-surface rounded-xl border border-border shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-background/50">
              <div className="flex items-center gap-2">
                <Sliders className="h-5 w-5 text-primary" />
                <div>
                  <h3 className="font-semibold text-base text-text">
                    Cập nhật tiêu chuẩn QC ({editing.profile.profileType})
                  </h3>
                  <p className="text-xs text-text-muted">
                    Mã hàng:{' '}
                    <span className="font-mono font-medium">{editing.style.styleCode}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditing(null)}
                className="text-text-muted hover:text-text p-1 rounded-md"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-text mb-1">
                  Độ co rút tối đa (%) <span className="text-red-500">*</span>
                </label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  required
                  value={shrinkageInput}
                  onChange={(e) => setShrinkageInput(e.target.value)}
                  placeholder="Ví dụ: 3.0"
                />
                <p className="text-[11px] text-text-muted mt-1">
                  KCS sẽ đo kích thước mẫu trước và sau giặt; nếu độ co &gt; giá trị này sẽ báo
                  Lỗi/Rework.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-text mb-1">
                  Mức phai màu tối đa cho phép (Cấp 0 đến 5) <span className="text-red-500">*</span>
                </label>
                <select
                  value={fadingInput}
                  onChange={(e) => setFadingInput(e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="0">Cấp 0 - Tuyệt đối không phai màu</option>
                  <option value="1">Cấp 1 - Phai màu rất nhẹ (Chuẩn xuất khẩu)</option>
                  <option value="2">Cấp 2 - Phai màu nhẹ chấp nhận được</option>
                  <option value="3">
                    Cấp 3 - Phai màu trung bình (Chỉ chấp nhận khi bỏ giặt sạch)
                  </option>
                  <option value="4">Cấp 4 - Phai màu nhiều</option>
                  <option value="5">Cấp 5 - Phai màu rất nặng</option>
                </select>
              </div>

              <div className="rounded bg-blue-50 p-3 text-xs text-blue-800 border border-blue-200">
                <span className="font-semibold block mb-0.5">
                  Quy định ghi vết kiểm toán (BR-16):
                </span>
                Mọi thay đổi ngưỡng dung sai QC sẽ được hệ thống ghi nhận bất biến vào bảng AuditLog
                với thời gian và ID tài khoản của bạn.
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border mt-6">
                <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                  Hủy bỏ
                </Button>
                <Button type="submit" variant="primary" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? 'Đang lưu...' : 'Xác nhận cập nhật'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
