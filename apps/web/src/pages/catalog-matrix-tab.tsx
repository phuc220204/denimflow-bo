import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Check, CheckCircle2, Grid, Info, RefreshCw, Search, X } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useAuth } from '../lib/auth-context';
import { fetchMatrix, toggleMatrixRuleApi } from '../lib/api';

export const FabricColorMatrixTab: React.FC = () => {
  const { user, token } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'ADMIN';

  const [search, setSearch] = useState('');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['catalog', 'matrix'],
    queryFn: fetchMatrix,
  });

  const toggleMutation = useMutation({
    mutationFn: (dto: { fabricTypeId: string; colorId: string; isAllowed: boolean }) =>
      toggleMatrixRuleApi(dto, token),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['catalog', 'matrix'] });
      setSuccessMsg(
        `Đã ${variables.isAllowed ? 'cho phép' : 'cấm'} kết hợp Vải – Màu thành công (BR-04)!`,
      );
      setTimeout(() => setSuccessMsg(null), 3000);
    },
    onError: (err: Error) => {
      setErrorMsg(err.message || 'Không thể cập nhật ma trận vải - màu');
      setTimeout(() => setErrorMsg(null), 5000);
    },
  });

  const fabrics = data?.fabrics || [];
  const colors = data?.colors || [];
  const rules = data?.rules || [];

  // Create lookup map: `${fabricId}_${colorId}` -> boolean
  const ruleMap = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const r of rules) {
      map.set(`${r.fabricTypeId}_${r.colorId}`, r.isAllowed);
    }
    return map;
  }, [rules]);

  // Filter fabrics by search
  const filteredFabrics = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return fabrics;
    return fabrics.filter(
      (f) =>
        f.code.toLowerCase().includes(q) ||
        f.name.toLowerCase().includes(q) ||
        (f.composition && f.composition.toLowerCase().includes(q)),
    );
  }, [fabrics, search]);

  const handleToggle = (fabricTypeId: string, colorId: string, currentAllowed: boolean) => {
    if (!isAdmin) return;
    toggleMutation.mutate({
      fabricTypeId,
      colorId,
      isAllowed: !currentAllowed,
    });
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-text-muted">
        <RefreshCw className="h-6 w-6 animate-spin text-primary mr-2" />
        Đang tải ma trận phối vải - màu xưởng may...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6 text-center text-rose-600 border border-rose-200 rounded-lg bg-rose-50">
        <AlertCircle className="h-8 w-8 mx-auto mb-2 text-rose-500" />
        <p className="font-semibold">Lỗi tải dữ liệu ma trận</p>
        <p className="text-xs text-text-muted mt-1">
          {error instanceof Error ? error.message : 'Không thể kết nối máy chủ'}
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-4">
          Thử lại
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface p-4 rounded-lg border border-border">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-text flex items-center gap-1.5">
              <Grid className="h-4 w-4 text-primary" />
              Ma trận tương thích Vải – Màu (Fabric–Color Matrix)
            </h2>
            <Badge tone="info" className="text-xs">
              BR-04 &bull; FR-02
            </Badge>
          </div>
          <p className="text-xs text-text-muted mt-1 max-w-2xl">
            Bật/tắt các màu được phép phối cho từng loại vải denim. Khi Điều độ lập kế hoạch đơn
            hàng, hệ thống chỉ cho phép chọn những màu được đánh dấu{' '}
            <strong className="text-emerald-700">Hợp lệ</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-text-muted" />
            <Input
              placeholder="Tìm theo mã hoặc tên vải..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="flex items-center gap-1.5 h-9"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Làm mới
          </Button>
        </div>
      </div>

      {/* Alert Messages */}
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

      {/* Matrix Table */}
      <div className="rounded-lg border border-border bg-surface overflow-x-auto shadow-sm">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-border bg-background/60">
              <th className="p-3 font-semibold text-text min-w-[220px] sticky left-0 bg-background/95 backdrop-blur z-10 border-r border-border">
                Loại Vải Denim
              </th>
              {colors.map((c) => (
                <th key={c.id} className="p-3 text-center min-w-[140px] font-semibold text-text">
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="font-mono text-[11px] text-text">{c.code}</span>
                    <span
                      className="text-[10px] text-text-muted truncate max-w-[130px]"
                      title={c.name}
                    >
                      {c.name}
                    </span>
                    {c.colorFamily && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-muted text-text-muted">
                        Tông {c.colorFamily}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredFabrics.map((f) => (
              <tr key={f.id} className="hover:bg-background/40 transition-colors">
                {/* Fabric Info Column (Sticky) */}
                <td className="p-3 sticky left-0 bg-surface hover:bg-background/40 z-10 border-r border-border">
                  <div className="font-semibold text-text flex items-center gap-1.5">
                    <span className="font-mono text-primary text-xs">{f.code}</span>
                    <Badge tone="outline" className="text-[10px] py-0 px-1 font-normal">
                      {f.stretchType === 'STRETCH' ? 'Co giãn' : 'Không giãn'}
                    </Badge>
                  </div>
                  <div className="text-[11px] text-text truncate max-w-[200px]" title={f.name}>
                    {f.name}
                  </div>
                  <div className="text-[10px] text-text-muted">
                    {f.weightOz ? `${f.weightOz} oz` : ''}
                    {f.composition ? ` &bull; ${f.composition}` : ''}
                  </div>
                </td>

                {/* Matrix Cell for Each Color */}
                {colors.map((c) => {
                  const isAllowed = ruleMap.get(`${f.id}_${c.id}`) ?? false;

                  return (
                    <td key={c.id} className="p-3 text-center">
                      <button
                        type="button"
                        disabled={!isAdmin || toggleMutation.isPending}
                        onClick={() => handleToggle(f.id, c.id, isAllowed)}
                        title={
                          isAdmin
                            ? `Bấm để ${isAllowed ? 'hủy cho phép' : 'cho phép'} phối vải ${f.code} với màu ${c.code}`
                            : 'Chỉ Quản trị viên (Admin) mới có quyền đổi quy tắc ma trận'
                        }
                        className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                          isAllowed
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200 shadow-sm'
                            : 'bg-gray-100 text-gray-500 border border-gray-200 hover:bg-gray-200 opacity-70'
                        } ${isAdmin ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                      >
                        {isAllowed ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-600 stroke-[2.5]" />
                            <span>Cho phép</span>
                          </>
                        ) : (
                          <>
                            <X className="h-3.5 w-3.5 text-gray-400" />
                            <span>Không phối</span>
                          </>
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Business Rule Rationale Card */}
      <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-4 text-xs text-blue-900 flex items-start gap-3">
        <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold">Mục đích bảo vệ chất lượng của quy tắc BR-04:</p>
          <p className="text-blue-800 leading-relaxed">
            Mỗi loại denim có cấu trúc sợi, độ co rút và phản ứng màu khác nhau. Việc ép vải phối
            màu không tương thích sẽ gây loang màu, lệch tông sau khi wash và hỏng toàn bộ lô hàng
            gia công. Quản trị viên kích hoạt các ô xanh để khóa chặt danh mục màu an toàn cho
            chuyền cắt và may.
          </p>
        </div>
      </div>
    </div>
  );
};
