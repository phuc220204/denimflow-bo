import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, PlusCircle, ShieldAlert, ShieldCheck, X } from 'lucide-react';
import React, { useState } from 'react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import {
  allocateFabricApi,
  fetchFabricLotsApi,
  fetchMaterialRequestsApi,
  fetchOrderAllocationsApi,
  type OrderAllocationItem,
} from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { i18n } from '../../lib/i18n/dictionary';

export const InventoryPage: React.FC = () => {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'allocations' | 'lots' | 'requests'>('allocations');

  // Allocation modal state
  const [selectedOrderAllocation, setSelectedOrderAllocation] =
    useState<OrderAllocationItem | null>(null);
  const [selectedLotId, setSelectedLotId] = useState('');
  const [allocQuantity, setAllocQuantity] = useState<number>(0);
  const [allocError, setAllocError] = useState<string | null>(null);

  // Queries
  const { data: orderAllocations = [], isLoading: allocationsLoading } = useQuery({
    queryKey: ['orderAllocations'],
    queryFn: () => fetchOrderAllocationsApi(token),
  });

  const { data: fabricLots = [], isLoading: lotsLoading } = useQuery({
    queryKey: ['fabricLots'],
    queryFn: () => fetchFabricLotsApi(token),
  });

  const { data: materialRequests = [], isLoading: requestsLoading } = useQuery({
    queryKey: ['materialRequests'],
    queryFn: () => fetchMaterialRequestsApi(token),
  });

  // Allocation mutation
  const allocateMutation = useMutation({
    mutationFn: (variables: {
      orderId: string;
      bomLineId: string;
      fabricLotId: string;
      quantity: number;
    }) => allocateFabricApi(variables, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orderAllocations'] });
      queryClient.invalidateQueries({ queryKey: ['fabricLots'] });
      queryClient.invalidateQueries({ queryKey: ['materialRequests'] });
      setSelectedOrderAllocation(null);
      setSelectedLotId('');
      setAllocQuantity(0);
      setAllocError(null);
    },
    onError: (err: Error) => {
      setAllocError(err.message || 'Không thể phân bổ vải');
    },
  });

  const isKeeperOrAdmin =
    user?.role === 'WAREHOUSE_KEEPER' || user?.role === 'ADMIN' || user?.role === 'MANAGER';

  const handleOpenAllocationModal = (item: OrderAllocationItem) => {
    setSelectedOrderAllocation(item);
    setSelectedLotId('');
    setAllocQuantity(item.fabricBomLine?.missingQty || 0);
    setAllocError(null);
  };

  const handleAllocationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAllocError(null);

    if (!selectedOrderAllocation || !selectedOrderAllocation.fabricBomLine) return;
    if (!selectedLotId) {
      setAllocError('Vui lòng chọn cuộn vải tồn kho');
      return;
    }
    if (allocQuantity <= 0) {
      setAllocError('Số lượng mét vải phân bổ phải lớn hơn 0');
      return;
    }

    const selectedLot = fabricLots.find((l) => l.id === selectedLotId);
    if (!selectedLot) {
      setAllocError('Cuộn vải được chọn không tồn tại');
      return;
    }

    if (allocQuantity > Number(selectedLot.availableMeters)) {
      setAllocError(
        `BR-06: Vượt tồn kho cuộn (${selectedLot.availableMeters}m). Hai giao dịch không được đồng thời vượt tồn kho.`,
      );
      return;
    }

    if (allocQuantity > selectedOrderAllocation.fabricBomLine.missingQty + 0.001) {
      setAllocError(
        `Vượt nhu cầu còn thiếu (${selectedOrderAllocation.fabricBomLine.missingQty}m) của định mức vải.`,
      );
      return;
    }

    allocateMutation.mutate({
      orderId: selectedOrderAllocation.order.id,
      bomLineId: selectedOrderAllocation.fabricBomLine.id,
      fabricLotId: selectedLotId,
      quantity: allocQuantity,
    });
  };

  // Filter compatible lots for modal
  const compatibleLots = fabricLots.filter((lot) => {
    if (!selectedOrderAllocation) return true;
    const fabricTypeId = selectedOrderAllocation.order.fabricType?.id;
    const colorId = selectedOrderAllocation.order.color?.id;
    const matchesFabric = !fabricTypeId || lot.fabricTypeId === fabricTypeId;
    const matchesColor = !colorId || lot.colorId === colorId;
    return matchesFabric && matchesColor && Number(lot.availableMeters) > 0;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text">Kho & Phân bổ vật tư</h1>
          <p className="text-sm text-text-muted mt-1">
            Quản lý tồn kho cuộn vải, phân bổ vải cho đơn hàng và kiểm soát Gate cắt (T3.4, BR-06)
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border">
        <button
          type="button"
          onClick={() => setActiveTab('allocations')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'allocations'
              ? 'border-primary text-primary'
              : 'border-transparent text-text-muted hover:text-text'
          }`}
        >
          Phân bổ đơn hàng & Gate Cắt (BR-06) ({orderAllocations.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('lots')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'lots'
              ? 'border-primary text-primary'
              : 'border-transparent text-text-muted hover:text-text'
          }`}
        >
          Cuộn vải tồn kho ({fabricLots.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('requests')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'requests'
              ? 'border-primary text-primary'
              : 'border-transparent text-text-muted hover:text-text'
          }`}
        >
          Yêu cầu cấp vật tư (Material Requests) ({materialRequests.length})
        </button>
      </div>

      {/* Tab 1: Allocations & BR-06 Cutting Gate */}
      {activeTab === 'allocations' && (
        <div className="space-y-4">
          <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/50 border-b border-border text-xs text-text-muted uppercase font-medium">
                  <tr>
                    <th className="py-3 px-4">Đơn hàng</th>
                    <th className="py-3 px-4">Kiểu dáng & Vải/Màu</th>
                    <th className="py-3 px-4">Nhu cầu BOM vải</th>
                    <th className="py-3 px-4">Tiến độ phân bổ</th>
                    <th className="py-3 px-4">Gate Cắt (BR-06)</th>
                    <th className="py-3 px-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {allocationsLoading ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-xs text-text-muted">
                        Đang tải dữ liệu phân bổ...
                      </td>
                    </tr>
                  ) : orderAllocations.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-xs text-text-muted">
                        Chưa có đơn hàng nào cần phân bổ vật tư.
                      </td>
                    </tr>
                  ) : (
                    orderAllocations.map((item) => {
                      const req = item.fabricBomLine?.requiredQty || 0;
                      const alloc = item.fabricBomLine?.allocatedQty || 0;
                      const pct = req > 0 ? Math.min(100, Math.round((alloc / req) * 100)) : 0;
                      const isFully = item.cuttingGate.passed;

                      return (
                        <tr key={item.order.id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-4 font-mono font-semibold text-primary">
                            {item.order.orderNumber}
                            <span className="block text-xs font-sans text-text-muted font-normal mt-0.5">
                              {i18n.orderStatus[item.order.status] || item.order.status}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-medium text-text">
                              {item.order.style?.name || 'Mã hàng'}
                            </div>
                            <div className="text-xs text-text-muted mt-0.5">
                              {item.order.fabricType?.code || 'Chưa chọn vải'} •{' '}
                              {item.order.color?.name || 'Chưa chọn màu'}
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono text-xs">
                            {item.fabricBomLine ? (
                              <div>
                                <span className="font-semibold text-text">
                                  {item.fabricBomLine.requiredQty} {item.fabricBomLine.unit}
                                </span>
                                {item.fabricBomLine.missingQty > 0 && (
                                  <span className="block text-amber-600 text-[11px]">
                                    Còn thiếu: {item.fabricBomLine.missingQty}m
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-text-muted italic">Chưa tính BOM</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="w-36">
                              <div className="flex justify-between text-xs mb-1">
                                <span className="font-mono text-text">
                                  {alloc}/{req}m
                                </span>
                                <span className="font-semibold text-primary">{pct}%</span>
                              </div>
                              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    isFully ? 'bg-emerald-500' : 'bg-primary'
                                  }`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {isFully ? (
                              <Badge
                                tone="outline"
                                className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200 flex items-center gap-1 w-fit"
                              >
                                <ShieldCheck className="h-3.5 w-3.5" />
                                <span>Đủ điều kiện cắt (Pass)</span>
                              </Badge>
                            ) : (
                              <Badge
                                tone="outline"
                                className="text-xs bg-amber-50 text-amber-700 border-amber-200 flex items-center gap-1 w-fit"
                                title={item.cuttingGate.reason}
                              >
                                <ShieldAlert className="h-3.5 w-3.5 text-amber-600" />
                                <span>Khóa cắt (Thiếu vải)</span>
                              </Badge>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {isKeeperOrAdmin && item.fabricBomLine && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenAllocationModal(item)}
                                className="text-xs h-8 flex items-center gap-1"
                                disabled={isFully}
                              >
                                <PlusCircle className="h-3.5 w-3.5 text-primary" />
                                <span>{isFully ? 'Đã đủ vải' : 'Phân bổ vải'}</span>
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Fabric Lots */}
      {activeTab === 'lots' && (
        <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 border-b border-border text-xs text-text-muted uppercase font-medium">
                <tr>
                  <th className="py-3 px-4">Mã cuộn (Lot No)</th>
                  <th className="py-3 px-4">Loại vải</th>
                  <th className="py-3 px-4">Màu sắc</th>
                  <th className="py-3 px-4 text-right">Độ co rút (%)</th>
                  <th className="py-3 px-4 text-right">Tồn khả dụng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {lotsLoading ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-xs text-text-muted">
                      Đang tải danh sách cuộn vải...
                    </td>
                  </tr>
                ) : fabricLots.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-xs text-text-muted">
                      Chưa có cuộn vải nào trong kho.
                    </td>
                  </tr>
                ) : (
                  fabricLots.map((lot) => (
                    <tr key={lot.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-primary">
                        {lot.lotNo}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-medium text-text">
                          {lot.fabricType?.code} - {lot.fabricType?.name}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-xs text-text">
                          {lot.colorOption?.code} - {lot.colorOption?.name}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs">
                        {lot.shrinkagePercent ? `${lot.shrinkagePercent}%` : '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-primary">
                        {Number(lot.availableMeters).toLocaleString()} m
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Material Requests */}
      {activeTab === 'requests' && (
        <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 border-b border-border text-xs text-text-muted uppercase font-medium">
                <tr>
                  <th className="py-3 px-4">Đơn hàng</th>
                  <th className="py-3 px-4">Vật tư thiếu</th>
                  <th className="py-3 px-4 text-right">Số lượng thiếu</th>
                  <th className="py-3 px-4">Trạng thái</th>
                  <th className="py-3 px-4">Người yêu cầu</th>
                  <th className="py-3 px-4">Thời gian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {requestsLoading ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-xs text-text-muted">
                      Đang tải yêu cầu vật tư...
                    </td>
                  </tr>
                ) : materialRequests.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-xs text-text-muted">
                      Không có yêu cầu cấp vật tư nào đang mở.
                    </td>
                  </tr>
                ) : (
                  materialRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-primary">
                        {req.order?.orderNumber}
                      </td>
                      <td className="py-3 px-4 text-xs font-medium text-text">
                        {req.bomLine?.materialType || 'Vải chính'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-amber-600 text-xs">
                        {Number(req.missingQty).toLocaleString()} m
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          tone={req.status === 'OPEN' ? 'warning' : 'neutral'}
                          className="text-xs"
                        >
                          {req.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-xs text-text-muted">
                        {req.requester?.fullName || req.requester?.email || 'Hệ thống'}
                      </td>
                      <td className="py-3 px-4 text-xs text-text-muted">
                        {req.createdAt ? req.createdAt.split('T')[0] : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Allocation Modal */}
      {selectedOrderAllocation && selectedOrderAllocation.fabricBomLine && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-surface rounded-xl border border-border shadow-xl max-w-lg w-full my-8 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30">
              <h2 className="text-lg font-bold text-text">
                Phân bổ cuộn vải — {selectedOrderAllocation.order.orderNumber}
              </h2>
              <button
                type="button"
                onClick={() => setSelectedOrderAllocation(null)}
                className="text-text-muted hover:text-text"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAllocationSubmit} className="p-6 space-y-4">
              {allocError && (
                <div className="flex items-center gap-2 p-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-md">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{allocError}</span>
                </div>
              )}

              <div className="p-3 rounded-lg bg-muted/40 border border-border space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-text-muted">Loại vải yêu cầu:</span>
                  <span className="font-semibold text-text">
                    {selectedOrderAllocation.order.fabricType?.code} -{' '}
                    {selectedOrderAllocation.order.fabricType?.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Màu sắc:</span>
                  <span className="font-semibold text-text">
                    {selectedOrderAllocation.order.color?.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Tổng nhu cầu định mức:</span>
                  <span className="font-mono font-semibold text-primary">
                    {selectedOrderAllocation.fabricBomLine.requiredQty} m
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Đã phân bổ:</span>
                  <span className="font-mono text-emerald-600 font-semibold">
                    {selectedOrderAllocation.fabricBomLine.allocatedQty} m
                  </span>
                </div>
                <div className="flex justify-between border-t border-border/50 pt-1">
                  <span className="text-text-muted font-medium">Còn thiếu (Missing Qty):</span>
                  <span className="font-mono text-amber-600 font-bold">
                    {selectedOrderAllocation.fabricBomLine.missingQty} m
                  </span>
                </div>
              </div>

              <div>
                <label
                  htmlFor="alloc-lot-select"
                  className="block text-xs font-semibold text-text mb-1.5"
                >
                  Chọn cuộn vải xuất xưởng (Compatible Lots) *
                </label>
                <select
                  id="alloc-lot-select"
                  value={selectedLotId}
                  onChange={(e) => {
                    setSelectedLotId(e.target.value);
                    const lot = fabricLots.find((l) => l.id === e.target.value);
                    if (lot && selectedOrderAllocation.fabricBomLine) {
                      const avail = Number(lot.availableMeters);
                      const missing = selectedOrderAllocation.fabricBomLine.missingQty;
                      setAllocQuantity(Math.min(avail, missing));
                    }
                  }}
                  required
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">-- Chọn cuộn vải --</option>
                  {compatibleLots.map((lot) => (
                    <option key={lot.id} value={lot.id}>
                      {lot.lotNo} (Còn {lot.availableMeters}m
                      {lot.shrinkagePercent ? ` • Co ${lot.shrinkagePercent}%` : ''})
                    </option>
                  ))}
                </select>
                {compatibleLots.length === 0 && (
                  <span className="block text-[11px] text-amber-600 mt-1">
                    Không có cuộn vải tương thích còn hàng trong kho. Hệ thống sẽ tự động tạo Yêu
                    cầu cấp vật tư (Material Request).
                  </span>
                )}
              </div>

              <div>
                <label
                  htmlFor="alloc-qty-input"
                  className="block text-xs font-semibold text-text mb-1.5"
                >
                  Số lượng mét vải phân bổ *
                </label>
                <input
                  id="alloc-qty-input"
                  type="number"
                  step="any"
                  min="0.1"
                  value={allocQuantity}
                  onChange={(e) => setAllocQuantity(parseFloat(e.target.value) || 0)}
                  required
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedOrderAllocation(null)}
                  className="text-xs"
                >
                  Huỷ bỏ
                </Button>
                <Button
                  type="submit"
                  disabled={allocateMutation.isPending || !selectedLotId || allocQuantity <= 0}
                  className="text-xs bg-primary text-white hover:bg-primary/90"
                >
                  {allocateMutation.isPending ? 'Đang phân bổ...' : 'Xác nhận phân bổ'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
