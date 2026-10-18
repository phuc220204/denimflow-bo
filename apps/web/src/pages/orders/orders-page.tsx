import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  Calendar,
  Clock,
  Layers,
  Palette,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import React, { useState } from 'react';
import type {
  CreateProductionOrderDto,
  OrderStatus,
  SelectFabricColorDto,
  UpdateProductionOrderDto,
} from '@denimflow/shared';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import {
  createOrderApi,
  fetchAllowedColors,
  fetchFabricTypes,
  fetchOrdersApi,
  fetchStyles,
  fetchWashTypes,
  type ProductionOrderItem,
  selectFabricColorApi,
  updateOrderApi,
} from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { i18n } from '../../lib/i18n/dictionary';

interface SizeLineFormState {
  size: string;
  plannedQty: number;
}

export const OrdersPage: React.FC = () => {
  const { user, token } = useAuth();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingOrder, setEditingOrder] = useState<ProductionOrderItem | null>(null);

  // Form states
  const [styleId, setStyleId] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');
  const [customerRef, setCustomerRef] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [washTypeId, setWashTypeId] = useState<string>('');
  const [fabricTypeId, setFabricTypeId] = useState<string>('');
  const [colorId, setColorId] = useState<string>('');
  const [isCustom, setIsCustom] = useState<boolean>(false);
  const [ppSampleRequired, setPpSampleRequired] = useState<boolean>(false);
  const [skipCleanWash, setSkipCleanWash] = useState<boolean>(false);
  const [embroideryRequired, setEmbroideryRequired] = useState<boolean>(false);
  const [fabricInspectRequired, setFabricInspectRequired] = useState<boolean>(false);
  const [dyeRequired, setDyeRequired] = useState<boolean>(false);
  const [dyeMode, setDyeMode] = useState<'TOTAL' | 'PARTIAL' | ''>('');
  const [dyeSource, setDyeSource] = useState<'INTERNAL' | 'OUTSOURCED' | ''>('');
  const [sizeLines, setSizeLines] = useState<SizeLineFormState[]>([
    { size: '29', plannedQty: 100 },
    { size: '30', plannedQty: 150 },
    { size: '31', plannedQty: 150 },
    { size: '32', plannedQty: 100 },
  ]);
  const [formError, setFormError] = useState<string | null>(null);

  // Dedicated Fabric & Color modal state (BR-04, BR-05)
  const [fabricColorModalOrder, setFabricColorModalOrder] = useState<ProductionOrderItem | null>(
    null,
  );
  const [fcModalFabricId, setFcModalFabricId] = useState<string>('');
  const [fcModalColorId, setFcModalColorId] = useState<string>('');
  const [fcModalWashId, setFcModalWashId] = useState<string>('');
  const [fcModalError, setFcModalError] = useState<string | null>(null);

  // Queries
  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['orders', statusFilter],
    queryFn: () =>
      fetchOrdersApi(token, {
        status: statusFilter !== 'ALL' ? (statusFilter as OrderStatus) : undefined,
      }),
  });

  const { data: styles = [] } = useQuery({
    queryKey: ['styles'],
    queryFn: () => fetchStyles(),
  });

  const { data: fabricTypes = [] } = useQuery({
    queryKey: ['fabricTypes'],
    queryFn: () => fetchFabricTypes(),
  });

  const { data: washTypes = [] } = useQuery({
    queryKey: ['washTypes'],
    queryFn: () => fetchWashTypes(),
  });

  // Allowed colors for create/edit modal (BR-04)
  const { data: allowedColors = [] } = useQuery({
    queryKey: ['allowedColors', fabricTypeId],
    queryFn: () => fetchAllowedColors(fabricTypeId),
    enabled: Boolean(fabricTypeId),
  });

  // Allowed colors for dedicated fabric-color modal (BR-04)
  const { data: fcModalAllowedColors = [] } = useQuery({
    queryKey: ['allowedColors', fcModalFabricId],
    queryFn: () => fetchAllowedColors(fcModalFabricId),
    enabled: Boolean(fcModalFabricId),
  });

  const isCuttingLocked = (order: ProductionOrderItem | null) => {
    if (!order) return false;
    if (order.status === 'IN_PRODUCTION' || order.status === 'COMPLETED') return true;
    const wf = order.workflowInstance as
      { stepInstances?: Array<{ stepDefinition?: { code: string }; status: string }> } | undefined;
    const cuttingStep = wf?.stepInstances?.find((s) => s.stepDefinition?.code === 'CUTTING');
    if (cuttingStep && cuttingStep.status !== 'PENDING' && cuttingStep.status !== 'READY') {
      return true;
    }
    return false;
  };

  const isPlannerOrAdmin =
    user?.role === 'PRODUCTION_PLANNER' || user?.role === 'ADMIN' || user?.role === 'MANAGER';

  // Handle opening modal for create
  const handleOpenCreate = () => {
    setEditingOrder(null);
    setStyleId(styles[0]?.id || '');
    setDueDate(new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0] ?? '');
    setCustomerRef('');
    setNotes('');
    setWashTypeId('');
    setFabricTypeId('');
    setColorId('');
    setIsCustom(false);
    setPpSampleRequired(false);
    setSkipCleanWash(false);
    setEmbroideryRequired(false);
    setFabricInspectRequired(false);
    setDyeRequired(false);
    setDyeMode('');
    setDyeSource('');
    setSizeLines([
      { size: '29', plannedQty: 100 },
      { size: '30', plannedQty: 150 },
      { size: '31', plannedQty: 150 },
      { size: '32', plannedQty: 100 },
    ]);
    setFormError(null);
    setIsModalOpen(true);
  };

  // Handle opening modal for edit
  const handleOpenEdit = (order: ProductionOrderItem) => {
    setEditingOrder(order);
    setStyleId(order.styleId);
    setDueDate(order.dueDate ? (order.dueDate.split('T')[0] ?? '') : '');
    setCustomerRef(order.customerRef || '');
    setNotes(order.notes || '');
    setWashTypeId(order.washTypeId || '');
    setFabricTypeId(order.fabricTypeId || '');
    setColorId(order.colorId || '');
    setIsCustom(order.isCustom);
    setPpSampleRequired(order.ppSampleRequired);
    setSkipCleanWash(order.skipCleanWash);
    setEmbroideryRequired(order.embroideryRequired);
    setFabricInspectRequired(order.fabricInspectRequired);
    setDyeRequired(order.dyeRequired);
    setDyeMode(order.dyeMode || '');
    setDyeSource(order.dyeSource || '');
    setSizeLines(
      order.sizeLines.length > 0
        ? order.sizeLines.map((l) => ({ size: l.size, plannedQty: l.plannedQty }))
        : [{ size: '30', plannedQty: 100 }],
    );
    setFormError(null);
    setIsModalOpen(true);
  };

  // Dedicated Fabric & Color modal handlers (BR-04, BR-05)
  const handleOpenFabricColorModal = (order: ProductionOrderItem) => {
    setFabricColorModalOrder(order);
    setFcModalFabricId(order.fabricTypeId || '');
    setFcModalColorId(order.colorId || '');
    setFcModalWashId(order.washTypeId || '');
    setFcModalError(null);
  };

  const selectFabricColorMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: SelectFabricColorDto }) =>
      selectFabricColorApi(id, dto, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      setFabricColorModalOrder(null);
    },
    onError: (err: Error) => {
      setFcModalError(err.message || 'Không thể chọn chất liệu và màu sắc');
    },
  });

  const handleFcModalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFcModalError(null);

    if (!fabricColorModalOrder) return;

    if (isCuttingLocked(fabricColorModalOrder)) {
      setFcModalError('BR-05: Đơn hàng đã bắt đầu cắt, không thể thay đổi loại vải hoặc màu sắc.');
      return;
    }

    if (!fcModalFabricId) {
      setFcModalError('Vui lòng chọn loại vải');
      return;
    }

    if (!fcModalColorId) {
      setFcModalError('Vui lòng chọn màu sắc');
      return;
    }

    selectFabricColorMutation.mutate({
      id: fabricColorModalOrder.id,
      dto: {
        fabricTypeId: fcModalFabricId,
        colorId: fcModalColorId,
        washTypeId: fcModalWashId || null,
      },
    });
  };

  // Mutations
  const createMutation = useMutation({
    mutationFn: (dto: CreateProductionOrderDto) => createOrderApi(dto, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      setIsModalOpen(false);
    },
    onError: (err: Error) => {
      setFormError(err.message || 'Không thể tạo đơn hàng');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateProductionOrderDto }) =>
      updateOrderApi(id, dto, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      setIsModalOpen(false);
    },
    onError: (err: Error) => {
      setFormError(err.message || 'Không thể cập nhật đơn hàng');
    },
  });

  const handleCustomChange = (checked: boolean) => {
    setIsCustom(checked);
    // BR-17: When custom is checked, pre-production sample is mandatory
    if (checked) {
      setPpSampleRequired(true);
    }
  };

  const handleAddSizeLine = () => {
    setSizeLines([...sizeLines, { size: '', plannedQty: 50 }]);
  };

  const handleRemoveSizeLine = (index: number) => {
    setSizeLines(sizeLines.filter((_, i) => i !== index));
  };

  const handleSizeChange = (index: number, field: 'size' | 'plannedQty', value: string) => {
    const updated = [...sizeLines];
    const item = updated[index];
    if (!item) return;

    if (field === 'size') {
      item.size = value;
    } else {
      item.plannedQty = Math.max(1, parseInt(value, 10) || 1);
    }
    setSizeLines(updated);
  };

  const totalPlannedQty = sizeLines.reduce((acc, curr) => acc + (curr.plannedQty || 0), 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!styleId) {
      setFormError('Vui lòng chọn Mã kiểu dáng (Style)');
      return;
    }
    if (!dueDate) {
      setFormError('Vui lòng chọn ngày giao hàng (Due Date)');
      return;
    }
    if (sizeLines.length === 0) {
      setFormError('Đơn hàng phải có ít nhất 1 cỡ (Size)');
      return;
    }
    for (const line of sizeLines) {
      if (!line.size.trim()) {
        setFormError('Tên cỡ không được để trống');
        return;
      }
      if (line.plannedQty <= 0) {
        setFormError('Số lượng kế hoạch từng cỡ phải lớn hơn 0');
        return;
      }
    }

    // Check duplicate sizes
    const seen = new Set<string>();
    for (const line of sizeLines) {
      const s = line.size.trim().toUpperCase();
      if (seen.has(s)) {
        setFormError(`Cỡ '${s}' bị trùng lặp trong đơn hàng`);
        return;
      }
      seen.add(s);
    }

    if (dyeRequired) {
      if (!dyeMode) {
        setFormError('Vui lòng chọn hình thức nhuộm (Dye Mode)');
        return;
      }
      if (!dyeSource) {
        setFormError('Vui lòng chọn nguồn gia công nhuộm (Dye Source)');
        return;
      }
    }

    if (editingOrder && isCuttingLocked(editingOrder)) {
      if (
        fabricTypeId !== (editingOrder.fabricTypeId || '') ||
        colorId !== (editingOrder.colorId || '') ||
        washTypeId !== (editingOrder.washTypeId || '')
      ) {
        setFormError(
          'BR-05: Đơn hàng đã bắt đầu cắt, không thể thay đổi loại vải, màu sắc hoặc kiểu giặt.',
        );
        return;
      }
    }

    const payload = {
      styleId,
      fabricTypeId: fabricTypeId || null,
      colorId: colorId || null,
      dueDate,
      customerRef: customerRef.trim() || null,
      notes: notes.trim() || null,
      washTypeId: washTypeId || null,
      isCustom,
      ppSampleRequired: isCustom ? true : ppSampleRequired,
      skipCleanWash,
      embroideryRequired,
      fabricInspectRequired,
      dyeRequired,
      dyeMode: dyeRequired && (dyeMode === 'TOTAL' || dyeMode === 'PARTIAL') ? dyeMode : null,
      dyeSource:
        dyeRequired && (dyeSource === 'INTERNAL' || dyeSource === 'OUTSOURCED') ? dyeSource : null,
      sizeLines: sizeLines.map((l) => ({
        size: l.size.trim().toUpperCase(),
        plannedQty: l.plannedQty,
      })),
    };

    if (editingOrder) {
      updateMutation.mutate({ id: editingOrder.id, dto: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const filteredOrders = orders.filter((order) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      order.orderNumber.toLowerCase().includes(q) ||
      (order.customerRef && order.customerRef.toLowerCase().includes(q)) ||
      (order.style?.styleCode && order.style.styleCode.toLowerCase().includes(q))
    );
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text">Quản lý Đơn hàng</h1>
          <p className="text-sm text-text-muted mt-1">
            Khởi tạo đơn hàng DRAFT, cấu hình dải cỡ, cờ quy trình và điều kiện kỹ thuật sản xuất
          </p>
        </div>
        {isPlannerOrAdmin && (
          <Button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 bg-primary text-white hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Tạo đơn hàng mới
          </Button>
        )}
      </div>

      {/* Filters and search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-surface p-4 rounded-lg border border-border">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-text-muted" />
            <input
              type="text"
              placeholder="Tìm theo mã đơn, khách hàng, style..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Status tabs */}
        <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
          {['ALL', 'DRAFT', 'CONFIRMED', 'IN_PRODUCTION', 'COMPLETED', 'CANCELLED'].map(
            (status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  statusFilter === status
                    ? 'bg-primary text-white'
                    : 'bg-background hover:bg-muted text-text-muted hover:text-text border border-border'
                }`}
              >
                {status === 'ALL'
                  ? 'Tất cả'
                  : (i18n.orderStatus as Record<string, string>)[status] || status}
              </button>
            ),
          )}
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-surface rounded-lg border border-border overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 border-b border-border text-xs text-text-muted uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Mã đơn hàng</th>
                <th className="py-3 px-4">Kiểu dáng (Style)</th>
                <th className="py-3 px-4">Dải cỡ & Tổng SL</th>
                <th className="py-3 px-4">Hạn giao hàng</th>
                <th className="py-3 px-4">Cờ đặc biệt</th>
                <th className="py-3 px-4">Trạng thái</th>
                <th className="py-3 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {ordersLoading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-text-muted">
                    <div className="flex items-center justify-center gap-2">
                      <Clock className="h-4 w-4 animate-spin text-primary" />
                      Đang tải danh sách đơn hàng...
                    </div>
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-text-muted">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Layers className="h-8 w-8 text-text-muted/60" />
                      <p>Không tìm thấy đơn hàng nào phù hợp</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const totalQty = order.sizeLines.reduce((s, l) => s + l.plannedQty, 0);
                  const isDraft = order.status === 'DRAFT';

                  return (
                    <tr key={order.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-semibold text-primary">
                        {order.orderNumber}
                        {order.customerRef && (
                          <span className="block text-xs font-sans text-text-muted font-normal mt-0.5">
                            Ref: {order.customerRef}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-text">
                          {order.style?.name || 'Mã hàng'}
                        </div>
                        <span className="text-xs text-text-muted font-mono">
                          {order.style?.styleCode}
                        </span>
                        <div className="mt-1 flex items-center gap-1.5 text-xs">
                          {order.fabricType ? (
                            <span className="font-medium text-primary">
                              {order.fabricType.code}
                            </span>
                          ) : (
                            <span className="text-text-muted italic">Chưa chọn vải</span>
                          )}
                          <span className="text-text-muted">•</span>
                          {order.color ? (
                            <span className="font-medium text-text">{order.color.name}</span>
                          ) : (
                            <span className="text-text-muted italic">Chưa chọn màu</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1 items-center">
                          {order.sizeLines.map((l) => (
                            <span
                              key={l.id || l.size}
                              className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] bg-muted border border-border"
                            >
                              {l.size}: {l.plannedQty}
                            </span>
                          ))}
                          <span className="ml-1 text-xs font-semibold text-text">
                            (∑ {totalQty.toLocaleString()})
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 text-xs text-text">
                          <Calendar className="h-3.5 w-3.5 text-text-muted" />
                          {order.dueDate ? order.dueDate.split('T')[0] : '—'}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1">
                          {order.isCustom && (
                            <Badge
                              tone="outline"
                              className="text-[10px] bg-amber-50 text-amber-700 border-amber-200"
                            >
                              Tuỳ chỉnh (BR-17)
                            </Badge>
                          )}
                          {order.ppSampleRequired && (
                            <Badge
                              tone="outline"
                              className="text-[10px] bg-blue-50 text-blue-700 border-blue-200"
                            >
                              Mẫu PP
                            </Badge>
                          )}
                          {order.skipCleanWash && (
                            <Badge
                              tone="outline"
                              className="text-[10px] bg-purple-50 text-purple-700 border-purple-200"
                            >
                              Bỏ giặt sạch (BR-18)
                            </Badge>
                          )}
                          {order.dyeRequired && (
                            <Badge
                              tone="outline"
                              className="text-[10px] bg-teal-50 text-teal-700 border-teal-200"
                            >
                              Nhuộm: {order.dyeMode}
                            </Badge>
                          )}
                          {order.embroideryRequired && (
                            <Badge
                              tone="outline"
                              className="text-[10px] bg-pink-50 text-pink-700 border-pink-200"
                            >
                              Thêu/In
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge
                          tone={
                            order.status === 'CONFIRMED' || order.status === 'IN_PRODUCTION'
                              ? 'primary'
                              : order.status === 'DRAFT'
                                ? 'neutral'
                                : 'outline'
                          }
                          className="text-xs"
                        >
                          {i18n.orderStatus[order.status] || order.status}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isPlannerOrAdmin && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenFabricColorModal(order)}
                              className="text-xs h-8 flex items-center gap-1"
                              title={
                                isCuttingLocked(order)
                                  ? 'Đã khóa vì cắt đã bắt đầu (BR-05)'
                                  : 'Chọn chất liệu và màu sắc (BR-04)'
                              }
                            >
                              <Palette className="h-3.5 w-3.5 text-primary" />
                              <span>Vải & Màu</span>
                            </Button>
                          )}
                          {isPlannerOrAdmin && isDraft && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenEdit(order)}
                              className="text-xs h-8"
                            >
                              Chỉnh sửa
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Create / Edit Order */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-surface rounded-xl border border-border shadow-xl max-w-2xl w-full my-8 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30">
              <h2 className="text-lg font-bold text-text">
                {editingOrder
                  ? `Chỉnh sửa Đơn hàng ${editingOrder.orderNumber}`
                  : 'Tạo đơn hàng sản xuất mới'}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-text-muted hover:text-text"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-xs flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Style & Due Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text mb-1.5">
                    Kiểu dáng sản phẩm (Style) *
                  </label>
                  <select
                    value={styleId}
                    onChange={(e) => setStyleId(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="" disabled>
                      -- Chọn Style --
                    </option>
                    {styles.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.styleCode} - {st.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text mb-1.5">
                    Hạn giao hàng (Due Date) *
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                  ></input>
                </div>
              </div>

              {/* Fabric Type & Color (BR-04, BR-05) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text mb-1.5">
                    Loại vải (Fabric Type)
                  </label>
                  <select
                    value={fabricTypeId}
                    onChange={(e) => {
                      setFabricTypeId(e.target.value);
                      setColorId('');
                    }}
                    disabled={Boolean(editingOrder && isCuttingLocked(editingOrder))}
                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                  >
                    <option value="">-- Chưa chọn loại vải --</option>
                    {fabricTypes.map((fb) => (
                      <option key={fb.id} value={fb.id}>
                        {fb.code} - {fb.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text mb-1.5">
                    Màu sắc (Color - Ma trận BR-04)
                  </label>
                  <select
                    value={colorId}
                    onChange={(e) => setColorId(e.target.value)}
                    disabled={
                      Boolean(editingOrder && isCuttingLocked(editingOrder)) || !fabricTypeId
                    }
                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                  >
                    <option value="">
                      {!fabricTypeId ? '-- Chọn loại vải trước --' : '-- Chọn màu sắc phù hợp --'}
                    </option>
                    {allowedColors.map((cl) => (
                      <option key={cl.id} value={cl.id}>
                        {cl.code} - {cl.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {editingOrder && isCuttingLocked(editingOrder) && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-md text-amber-800 text-xs flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
                  <span>
                    BR-05: Đơn hàng đã bắt đầu công đoạn Cắt hoặc đang sản xuất. Loại vải, màu sắc
                    và kiểu giặt đã bị khóa.
                  </span>
                </div>
              )}

              {/* Customer Ref & Wash Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text mb-1.5">
                    Mã tham chiếu khách hàng (Customer Ref)
                  </label>
                  <input
                    type="text"
                    placeholder="VD: PO-LEVIS-2026-X1"
                    value={customerRef}
                    onChange={(e) => setCustomerRef(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text mb-1.5">
                    Kiểu giặt hiệu ứng (Wash Type)
                  </label>
                  <select
                    value={washTypeId}
                    onChange={(e) => setWashTypeId(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">Không giặt hiệu ứng (Mặc định)</option>
                    {washTypes.map((wt) => (
                      <option key={wt.id} value={wt.id}>
                        {wt.code} - {wt.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Dynamic Size Lines */}
              <div className="space-y-2 border border-border rounded-lg p-4 bg-muted/20">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-text uppercase tracking-wide">
                      Phân bổ dải cỡ (Size Run) *
                    </span>
                    <span className="text-xs text-text-muted ml-2">
                      (Tổng:{' '}
                      <strong className="text-primary">{totalPlannedQty.toLocaleString()}</strong>{' '}
                      cái)
                    </span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleAddSizeLine}
                    className="text-xs h-7 gap-1"
                  >
                    <Plus className="h-3 w-3" /> Thêm cỡ
                  </Button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {sizeLines.map((line, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <div className="w-1/2">
                        <input
                          type="text"
                          placeholder="Cỡ (VD: 28, 29, 30...)"
                          value={line.size}
                          onChange={(e) => handleSizeChange(idx, 'size', e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs uppercase bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                          required
                        />
                      </div>
                      <div className="w-1/2 flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          placeholder="Số lượng"
                          value={line.plannedQty || ''}
                          onChange={(e) => handleSizeChange(idx, 'plannedQty', e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                          required
                        />
                        {sizeLines.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveSizeLine(idx)}
                            className="text-text-muted hover:text-red-500 p-1"
                            title="Xoá cỡ"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Special Flags and Rules */}
              <div className="space-y-3 border border-border rounded-lg p-4 bg-muted/10">
                <span className="text-xs font-bold text-text uppercase tracking-wide block mb-2">
                  Quy trình & Cờ kỹ thuật (Workflow Flags)
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isCustom}
                      onChange={(e) => handleCustomChange(e.target.checked)}
                      className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                    />
                    <div>
                      <span className="font-semibold text-text">
                        Đơn gia công tuỳ chỉnh (isCustom)
                      </span>
                      <p className="text-[11px] text-text-muted">
                        Bắt buộc duyệt mẫu PP trước khi cắt (BR-17)
                      </p>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ppSampleRequired}
                      disabled={isCustom}
                      onChange={(e) => setPpSampleRequired(e.target.checked)}
                      className="rounded border-border text-primary focus:ring-primary h-4 w-4 disabled:opacity-50"
                    />
                    <div>
                      <span className="font-semibold text-text">
                        Cần làm mẫu PP (ppSampleRequired)
                      </span>
                      <p className="text-[11px] text-text-muted">
                        {isCustom
                          ? 'Đã khoá bắt buộc do chọn tuỳ chỉnh'
                          : 'Sản xuất mẫu duyệt trước'}
                      </p>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={skipCleanWash}
                      onChange={(e) => setSkipCleanWash(e.target.checked)}
                      className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                    />
                    <div>
                      <span className="font-semibold text-text">
                        Bỏ qua giặt sạch (skipCleanWash)
                      </span>
                      <p className="text-[11px] text-text-muted">
                        Cần cam kết khách hàng trước khi xác nhận (BR-18, BR-19)
                      </p>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={embroideryRequired}
                      onChange={(e) => setEmbroideryRequired(e.target.checked)}
                      className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                    />
                    <div>
                      <span className="font-semibold text-text">
                        Cần thêu/in hình (embroideryRequired)
                      </span>
                      <p className="text-[11px] text-text-muted">
                        Mở công đoạn thêu trong quy trình
                      </p>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={fabricInspectRequired}
                      onChange={(e) => setFabricInspectRequired(e.target.checked)}
                      className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                    />
                    <div>
                      <span className="font-semibold text-text">
                        Kiểm vải trước khi cắt (fabricInspect)
                      </span>
                      <p className="text-[11px] text-text-muted">
                        Kiểm tra co giãn và khuyết tật cuộn
                      </p>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={dyeRequired}
                      onChange={(e) => setDyeRequired(e.target.checked)}
                      className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                    />
                    <div>
                      <span className="font-semibold text-text">Yêu cầu nhuộm (dyeRequired)</span>
                      <p className="text-[11px] text-text-muted">
                        Kích hoạt trạm nhuộm may thành phẩm
                      </p>
                    </div>
                  </label>
                </div>

                {dyeRequired && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border mt-2">
                    <div>
                      <label className="block text-xs font-semibold text-text mb-1">
                        Hình thức nhuộm (Dye Mode) *
                      </label>
                      <select
                        value={dyeMode}
                        onChange={(e) => setDyeMode(e.target.value as 'TOTAL' | 'PARTIAL')}
                        required={dyeRequired}
                        className="w-full px-2.5 py-1.5 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="">-- Chọn hình thức --</option>
                        <option value="TOTAL">Nhuộm toàn phần (TOTAL)</option>
                        <option value="PARTIAL">Nhuộm một phần (PARTIAL)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-text mb-1">
                        Nguồn nhuộm (Dye Source) *
                      </label>
                      <select
                        value={dyeSource}
                        onChange={(e) => setDyeSource(e.target.value as 'INTERNAL' | 'OUTSOURCED')}
                        required={dyeRequired}
                        className="w-full px-2.5 py-1.5 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="">-- Chọn nguồn --</option>
                        <option value="INTERNAL">Nội bộ xưởng (INTERNAL)</option>
                        <option value="OUTSOURCED">Gia công ngoài (OUTSOURCED)</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-text mb-1">
                  Ghi chú đơn hàng
                </label>
                <textarea
                  rows={2}
                  placeholder="Yêu cầu chi tiết từ khách hàng hoặc ghi chú sản xuất..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Footer buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  Huỷ
                </Button>
                <Button
                  type="submit"
                  className="bg-primary text-white hover:bg-primary/90"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? 'Đang lưu...'
                    : editingOrder
                      ? 'Lưu thay đổi'
                      : 'Tạo đơn hàng DRAFT'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Quick Select Fabric & Color (BR-04, BR-05) */}
      {fabricColorModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-surface rounded-xl border border-border shadow-xl max-w-md w-full overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30">
              <div className="flex items-center gap-2">
                <Palette className="h-5 w-5 text-primary" />
                <h2 className="text-base font-bold text-text">
                  Chất liệu & Màu sắc: {fabricColorModalOrder.orderNumber}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setFabricColorModalOrder(null)}
                className="text-text-muted hover:text-text"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleFcModalSubmit} className="p-6 space-y-4">
              {fcModalError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-xs flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{fcModalError}</span>
                </div>
              )}

              {isCuttingLocked(fabricColorModalOrder) ? (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-amber-800 text-xs flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                  <div>
                    <strong className="block font-semibold">Khóa chỉnh sửa (BR-05)</strong>
                    Công đoạn Cắt đã bắt đầu hoặc đơn hàng đang trong dây chuyền sản xuất. Không
                    được phép thay đổi chất liệu và màu sắc.
                  </div>
                </div>
              ) : (
                <p className="text-xs text-text-muted">
                  Chọn loại vải và màu sắc tương thích theo Ma trận phối màu (BR-04).
                </p>
              )}

              <div>
                <label
                  htmlFor="fc-modal-fabric"
                  className="block text-xs font-semibold text-text mb-1.5"
                >
                  Loại vải (Fabric Type) *
                </label>
                <select
                  id="fc-modal-fabric"
                  value={fcModalFabricId}
                  onChange={(e) => {
                    setFcModalFabricId(e.target.value);
                    setFcModalColorId('');
                  }}
                  disabled={isCuttingLocked(fabricColorModalOrder)}
                  required
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                >
                  <option value="">-- Chọn loại vải --</option>
                  {fabricTypes.map((fb) => (
                    <option key={fb.id} value={fb.id}>
                      {fb.code} - {fb.name} ({fb.composition || 'Denim'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="fc-modal-color"
                  className="block text-xs font-semibold text-text mb-1.5"
                >
                  Màu sắc (Color - Tương thích BR-04) *
                </label>
                <select
                  id="fc-modal-color"
                  value={fcModalColorId}
                  onChange={(e) => setFcModalColorId(e.target.value)}
                  disabled={isCuttingLocked(fabricColorModalOrder) || !fcModalFabricId}
                  required
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                >
                  <option value="">
                    {!fcModalFabricId ? '-- Chọn loại vải trước --' : '-- Chọn màu sắc cho phép --'}
                  </option>
                  {fcModalAllowedColors.map((cl) => (
                    <option key={cl.id} value={cl.id}>
                      {cl.code} - {cl.name}
                    </option>
                  ))}
                </select>
                {fcModalFabricId && fcModalAllowedColors.length === 0 && (
                  <span className="block text-[11px] text-amber-600 mt-1">
                    Chưa có màu nào được cấu hình cho loại vải này trong ma trận BR-04.
                  </span>
                )}
              </div>

              <div>
                <label
                  htmlFor="fc-modal-wash"
                  className="block text-xs font-semibold text-text mb-1.5"
                >
                  Kiểu giặt hiệu ứng (Wash Type)
                </label>
                <select
                  id="fc-modal-wash"
                  value={fcModalWashId}
                  onChange={(e) => setFcModalWashId(e.target.value)}
                  disabled={isCuttingLocked(fabricColorModalOrder)}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                >
                  <option value="">Không giặt hiệu ứng (Mặc định)</option>
                  {washTypes.map((wt) => (
                    <option key={wt.id} value={wt.id}>
                      {wt.code} - {wt.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setFabricColorModalOrder(null)}
                  className="text-xs"
                >
                  Đóng
                </Button>
                {!isCuttingLocked(fabricColorModalOrder) && (
                  <Button
                    type="submit"
                    disabled={
                      selectFabricColorMutation.isPending || !fcModalFabricId || !fcModalColorId
                    }
                    className="text-xs bg-primary text-white hover:bg-primary/90"
                  >
                    {selectFabricColorMutation.isPending ? 'Đang lưu...' : 'Lưu lựa chọn'}
                  </Button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
