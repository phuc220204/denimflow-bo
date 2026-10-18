import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  FileText,
  Layers,
  Palette,
  Calculator,
  Plus,
  Search,
  Trash2,
  X,
  PackageCheck,
} from 'lucide-react';
import React, { useState } from 'react';
import type {
  AttachAcknowledgementDto,
  ConfirmOrderResponseDto,
  CreateProductionOrderDto,
  OrderStatus,
  SelectFabricColorDto,
  UpdateProductionOrderDto,
} from '@denimflow/shared';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import {
  attachAcknowledgementApi,
  calculateBomApi,
  confirmOrderApi,
  createHandoverApi,
  createOrderApi,
  fetchAllowedColors,
  fetchBomLinesApi,
  fetchFabricTypes,
  fetchHandoverApi,
  fetchOrderDefectsApi,
  fetchOrdersApi,
  fetchStyles,
  fetchWashTypes,
  type BomLineItem,
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

  // Dedicated BOM modal state (FR-09)
  const [bomModalOrder, setBomModalOrder] = useState<ProductionOrderItem | null>(null);
  const [bomModalError, setBomModalError] = useState<string | null>(null);

  // Dedicated Confirm Order modal state (T3.5, FR-07, FR-11, BR-03, BR-18, BR-19)
  const [confirmModalOrder, setConfirmModalOrder] = useState<ProductionOrderItem | null>(null);
  const [confirmModalError, setConfirmModalError] = useState<string | null>(null);
  const [confirmResult, setConfirmResult] = useState<ConfirmOrderResponseDto | null>(null);
  const [ackCustomerName, setAckCustomerName] = useState<string>('');
  const [ackFilePath, setAckFilePath] = useState<string>('');

  // Dedicated Defects modal state (T5.3, FR-18)
  const [defectsModalOrder, setDefectsModalOrder] = useState<ProductionOrderItem | null>(null);

  const { data: orderDefects = [], isLoading: isLoadingDefects } = useQuery({
    queryKey: ['order-defects', defectsModalOrder?.id],
    queryFn: () => fetchOrderDefectsApi(defectsModalOrder!.id, token),
    enabled: Boolean(defectsModalOrder?.id),
  });

  // Dedicated Handover modal state (T5.4, FR-26)
  const [handoverModalOrder, setHandoverModalOrder] = useState<ProductionOrderItem | null>(null);
  const [handoverNotes, setHandoverNotes] = useState<string>('');
  const [handoverError, setHandoverError] = useState<string | null>(null);

  const { data: existingHandover, refetch: refetchHandover } = useQuery({
    queryKey: ['order-handover', handoverModalOrder?.id],
    queryFn: () => fetchHandoverApi(handoverModalOrder!.id, token),
    enabled: Boolean(handoverModalOrder?.id),
  });

  const createHandoverMutation = useMutation({
    mutationFn: ({ orderId, notes }: { orderId: string; notes?: string }) =>
      createHandoverApi(orderId, { notes }, token),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      void refetchHandover();
      setHandoverError(null);
    },
    onError: (err: Error) => {
      setHandoverError(err.message || 'Không thể tạo biên bản bàn giao');
    },
  });

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

  // Dedicated BOM handlers (FR-09)
  const { data: bomLines = [], isLoading: bomLinesLoading } = useQuery<BomLineItem[]>({
    queryKey: ['bomLines', bomModalOrder?.id],
    queryFn: () =>
      bomModalOrder ? fetchBomLinesApi(bomModalOrder.id, token) : Promise.resolve([]),
    enabled: Boolean(bomModalOrder),
  });

  const calculateBomMutation = useMutation({
    mutationFn: (orderId: string) => calculateBomApi(orderId, token),
    onSuccess: (data) => {
      queryClient.setQueryData(['bomLines', bomModalOrder?.id], data);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (err: Error) => {
      setBomModalError(err.message || 'Không thể tính toán BOM');
    },
  });

  const handleOpenBomModal = (order: ProductionOrderItem) => {
    setBomModalOrder(order);
    setBomModalError(null);
  };

  // Dedicated Confirm Order handlers (T3.5, FR-07, FR-11, BR-03, BR-18, BR-19)
  const handleOpenConfirmModal = (order: ProductionOrderItem) => {
    setConfirmModalOrder(order);
    setConfirmModalError(null);
    setConfirmResult(null);
    setAckCustomerName(order.customerRef ? `Đại diện ${order.customerRef}` : 'Đại diện khách hàng');
    setAckFilePath(`tailieu/xac-nhan-bo-giat-${order.orderNumber}.pdf`);
  };

  const confirmOrderMutation = useMutation({
    mutationFn: (orderId: string) => confirmOrderApi(orderId, token),
    onSuccess: (data) => {
      setConfirmResult(data);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (err: Error) => {
      setConfirmModalError(err.message || 'Không thể xác nhận đơn hàng');
    },
  });

  const attachAckAndConfirmMutation = useMutation({
    mutationFn: async ({ orderId, dto }: { orderId: string; dto: AttachAcknowledgementDto }) => {
      await attachAcknowledgementApi(orderId, dto, token);
      return confirmOrderApi(orderId, token);
    },
    onSuccess: (data) => {
      setConfirmResult(data);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (err: Error) => {
      setConfirmModalError(err.message || 'Lỗi khi đính kèm xác nhận và khởi chạy đơn hàng');
    },
  });

  const handleConfirmSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setConfirmModalError(null);
    if (!confirmModalOrder) return;

    if (confirmModalOrder.isCustom) {
      setConfirmModalError(
        'BR-17: Đơn hàng tuỳ chỉnh thuộc quy trình CUSTOM_REVIEW sau MVP (R-04). Không thể xác nhận.',
      );
      return;
    }

    if (!confirmModalOrder.fabricTypeId || !confirmModalOrder.colorId) {
      setConfirmModalError(
        'BR-04: Đơn hàng chưa chọn loại vải và màu sắc hợp lệ. Vui lòng chọn vải & màu trước.',
      );
      return;
    }

    if (confirmModalOrder.skipCleanWash) {
      if (!ackCustomerName.trim()) {
        setConfirmModalError('Vui lòng nhập tên người đại diện khách hàng xác nhận');
        return;
      }
      if (!ackFilePath.trim()) {
        setConfirmModalError('Vui lòng cung cấp đường dẫn hoặc tên tệp văn bản xác nhận');
        return;
      }
      attachAckAndConfirmMutation.mutate({
        orderId: confirmModalOrder.id,
        dto: {
          acknowledgedByName: ackCustomerName.trim(),
          filePath: ackFilePath.trim(),
        },
      });
      return;
    }

    confirmOrderMutation.mutate(confirmModalOrder.id);
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
                          {isPlannerOrAdmin && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenBomModal(order)}
                              className="text-xs h-8 flex items-center gap-1"
                              title="Định mức nguyên phụ liệu (BOM) (FR-09)"
                            >
                              <Calculator className="h-3.5 w-3.5 text-primary" />
                              <span>BOM</span>
                            </Button>
                          )}
                          {isPlannerOrAdmin && isDraft && (
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => handleOpenConfirmModal(order)}
                              className="text-xs h-8 bg-green-600 hover:bg-green-700 text-white flex items-center gap-1 font-medium"
                              title="Xác nhận đơn hàng và tạo snapshot quy trình (T3.5, BR-03)"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>Xác nhận</span>
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setDefectsModalOrder(order)}
                            className="text-xs h-8 flex items-center gap-1 text-amber-700 hover:text-amber-800 border-amber-200 hover:bg-amber-50"
                            title="Xem danh sách lỗi theo kiện và công đoạn (FR-18)"
                          >
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                            <span>Lỗi</span>
                          </Button>
                          {(order.status === 'IN_PRODUCTION' || order.status === 'COMPLETED') && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setHandoverModalOrder(order);
                                setHandoverNotes('');
                                setHandoverError(null);
                              }}
                              className={`text-xs h-8 flex items-center gap-1 ${
                                order.status === 'COMPLETED'
                                  ? 'text-emerald-700 hover:text-emerald-800 border-emerald-200 hover:bg-emerald-50'
                                  : 'text-blue-700 hover:text-blue-800 border-blue-200 hover:bg-blue-50'
                              }`}
                              title={
                                order.status === 'COMPLETED'
                                  ? 'Xem biên bản bàn giao & đóng gói (FR-26)'
                                  : 'Lập biên bản bàn giao & đóng gói (FR-26)'
                              }
                            >
                              <PackageCheck className="h-3.5 w-3.5" />
                              <span>
                                {order.status === 'COMPLETED' ? 'Đã bàn giao' : 'Bàn giao'}
                              </span>
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

      {/* Modal BOM Calculation & View (FR-09) */}
      {bomModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-surface rounded-xl border border-border shadow-xl max-w-2xl w-full my-8 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30">
              <div className="flex items-center gap-2">
                <Calculator className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-bold text-text">
                  Định mức nguyên phụ liệu (BOM) — {bomModalOrder.orderNumber}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setBomModalOrder(null)}
                className="text-text-muted hover:text-text"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg bg-muted/40 border border-border text-xs">
                <div>
                  <span className="text-text-muted">Kiểu dáng: </span>
                  <span className="font-semibold text-text">
                    {bomModalOrder.style?.styleCode} - {bomModalOrder.style?.name}
                  </span>
                </div>
                <div>
                  <span className="text-text-muted">Tổng số lượng: </span>
                  <span className="font-semibold text-primary">
                    {bomModalOrder.sizeLines.reduce((s, l) => s + l.plannedQty, 0).toLocaleString()}{' '}
                    chiếc
                  </span>
                </div>
                {isPlannerOrAdmin && (
                  <Button
                    type="button"
                    size="sm"
                    disabled={calculateBomMutation.isPending}
                    onClick={() => calculateBomMutation.mutate(bomModalOrder.id)}
                    className="text-xs bg-primary text-white hover:bg-primary/90 flex items-center gap-1.5"
                  >
                    <Calculator className="h-3.5 w-3.5" />
                    <span>
                      {calculateBomMutation.isPending ? 'Đang tính toán...' : 'Tính lại BOM'}
                    </span>
                  </Button>
                )}
              </div>

              {bomModalError && (
                <div className="flex items-center gap-2 p-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-md">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{bomModalError}</span>
                </div>
              )}

              {bomLinesLoading ? (
                <div className="py-8 text-center text-xs text-text-muted">
                  Đang tải định mức vật tư...
                </div>
              ) : bomLines.length === 0 ? (
                <div className="py-8 text-center space-y-3">
                  <Layers className="h-10 w-10 text-text-muted mx-auto opacity-50" />
                  <p className="text-xs text-text-muted max-w-md mx-auto">
                    Chưa có định mức vật tư nào được tính toán cho đơn hàng này.
                  </p>
                  {isPlannerOrAdmin && (
                    <Button
                      type="button"
                      size="sm"
                      disabled={calculateBomMutation.isPending}
                      onClick={() => calculateBomMutation.mutate(bomModalOrder.id)}
                      className="text-xs bg-primary text-white hover:bg-primary/90"
                    >
                      {calculateBomMutation.isPending ? 'Đang tính toán...' : 'Tính toán BOM ngay'}
                    </Button>
                  )}
                </div>
              ) : (
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/50 border-b border-border text-text-muted font-medium">
                      <tr>
                        <th className="py-2.5 px-3">Loại vật tư</th>
                        <th className="py-2.5 px-3 text-right">Tổng nhu cầu</th>
                        <th className="py-2.5 px-3">Đơn vị</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {bomLines.map((line) => {
                        const materialNameMap: Record<string, string> = {
                          FABRIC: 'Vải chính',
                          THREAD: 'Chỉ may',
                          BUTTON: 'Nút kim loại',
                          RIVET: 'Đinh tán',
                          ZIPPER: 'Khóa kéo',
                          LABEL: 'Nhãn mác',
                          PACKAGING: 'Bao bì đóng gói',
                        };
                        return (
                          <tr key={line.id} className="hover:bg-muted/20">
                            <td className="py-2.5 px-3 font-medium text-text">
                              <span className="font-semibold">
                                {materialNameMap[line.materialType] || line.materialType}
                              </span>
                              <span className="ml-1 text-[11px] text-text-muted font-mono">
                                ({line.materialType})
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-semibold text-primary">
                              {Number(line.requiredQty).toLocaleString(undefined, {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 2,
                              })}
                            </td>
                            <td className="py-2.5 px-3 text-text-muted font-medium">{line.unit}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setBomModalOrder(null)}
                  className="text-xs"
                >
                  Đóng
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirm Order & Process Snapshot (T3.5, FR-07, FR-11, BR-03, BR-18, BR-19) */}
      {confirmModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-surface rounded-xl border border-border shadow-xl max-w-xl w-full my-8 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <h2 className="text-lg font-bold text-text">
                  Xác nhận Đơn hàng & Khởi chạy Quy trình
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setConfirmModalOrder(null)}
                className="text-text-muted hover:text-text"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {confirmResult ? (
              <div className="p-6 space-y-5">
                <div className="p-4 rounded-xl bg-green-50 border border-green-200 text-green-900 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-base text-green-800">
                    <Check className="h-5 w-5 text-green-600" />
                    <span>Đơn hàng đã được xác nhận thành công!</span>
                  </div>
                  <p className="text-xs text-green-700">
                    Snapshot quy trình sản xuất (Workflow Instance) đã được tạo tự động từ phiên bản
                    PUBLISHED (BR-03) và đơn hàng chính thức chuyển sang trạng thái CONFIRMED.
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-muted/40 border border-border space-y-2.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-text-muted">Mã đơn hàng:</span>
                    <span className="font-mono font-bold text-text">
                      {confirmResult.orderNumber}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Phiên bản quy trình:</span>
                    <span className="font-medium text-primary">v{confirmResult.versionNo}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Tổng số bước quy trình:</span>
                    <span className="font-medium text-text">
                      {confirmResult.stepInstancesCount} bước
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Bước bắt đầu khả dụng:</span>
                    <span className="font-semibold text-green-700">
                      {confirmResult.firstReadyStepCode || 'Không có'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Hồ sơ kiểm định QC:</span>
                    <span className="font-medium text-text">
                      {confirmResult.qcProfileType === 'SKIP_CLEAN_WASH'
                        ? 'Bỏ qua giặt sạch (Độ co tối đa 5%, độ phai cấp 2)'
                        : 'Quy trình chuẩn (Độ co tối đa 3%, độ phai cấp 1)'}
                    </span>
                  </div>
                  {confirmResult.skippedStepCodes.length > 0 && (
                    <div className="flex justify-between">
                      <span className="text-text-muted">Các bước tự động bỏ qua:</span>
                      <span className="font-mono text-purple-700">
                        {confirmResult.skippedStepCodes.join(', ')}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex justify-end pt-3 border-t border-border">
                  <Button
                    type="button"
                    onClick={() => {
                      setConfirmModalOrder(null);
                      setConfirmResult(null);
                    }}
                    className="text-xs bg-primary text-white hover:bg-primary/90"
                  >
                    Hoàn tất & Đóng
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleConfirmSubmit} className="p-6 space-y-4">
                <div className="p-3.5 rounded-lg bg-muted/40 border border-border text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-text-muted">Mã đơn hàng:</span>
                    <span className="font-mono font-bold text-primary">
                      {confirmModalOrder.orderNumber}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Kiểu dáng:</span>
                    <span className="font-medium text-text">
                      {confirmModalOrder.style?.styleCode} - {confirmModalOrder.style?.name}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Vải & Màu:</span>
                    <span className="font-medium text-text">
                      {confirmModalOrder.fabricType?.name || (
                        <span className="text-red-500 italic">Chưa chọn vải</span>
                      )}{' '}
                      —{' '}
                      {confirmModalOrder.color?.name || (
                        <span className="text-red-500 italic">Chưa chọn màu</span>
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Tổng số lượng:</span>
                    <span className="font-semibold text-text">
                      {confirmModalOrder.sizeLines
                        .reduce((s, l) => s + l.plannedQty, 0)
                        .toLocaleString()}{' '}
                      chiếc
                    </span>
                  </div>
                </div>

                {/* Validation Warnings */}
                {confirmModalOrder.isCustom && (
                  <div className="flex items-start gap-2 p-3 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
                    <div>
                      <p className="font-semibold">Đơn hàng tuỳ chỉnh (BR-17, R-04)</p>
                      <p className="mt-0.5">
                        Đơn hàng có cờ tuỳ chỉnh (isCustom = true) thuộc luồng CUSTOM_REVIEW sau
                        MVP. Không thể xác nhận trong phạm vi MVP.
                      </p>
                    </div>
                  </div>
                )}

                {(!confirmModalOrder.fabricTypeId || !confirmModalOrder.colorId) && (
                  <div className="flex items-start gap-2 p-3 text-xs text-red-800 bg-red-50 border border-red-200 rounded-md">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
                    <div>
                      <p className="font-semibold">Chưa hoàn tất chọn chất liệu (BR-04)</p>
                      <p className="mt-0.5">
                        Đơn hàng chưa chọn loại vải và màu sắc hợp lệ theo ma trận. Vui lòng bấm
                        &quot;Vải & Màu&quot; để chọn trước khi xác nhận.
                      </p>
                    </div>
                  </div>
                )}

                {/* Customer Acknowledgement (BR-18, BR-19) */}
                {confirmModalOrder.skipCleanWash && (
                  <div className="space-y-3 p-3.5 rounded-lg bg-purple-50/60 border border-purple-200">
                    <div className="flex items-start gap-2 text-xs text-purple-900">
                      <FileText className="h-4 w-4 shrink-0 mt-0.5 text-purple-700" />
                      <div>
                        <p className="font-bold">Yêu cầu văn bản xác nhận của khách hàng (BR-19)</p>
                        <p className="text-[11px] text-purple-700 mt-0.5">
                          Đơn hàng bỏ qua công đoạn giặt sạch (Clean Wash). Theo BR-18 & BR-19, đơn
                          hàng sẽ áp dụng hồ sơ kiểm định QC nới lỏng và bắt buộc phải lưu hồ sơ xác
                          nhận chấp nhận rủi ro từ khách hàng.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2 pt-1 text-xs">
                      <div>
                        <label
                          htmlFor="ack-name-input"
                          className="block text-[11px] font-semibold text-text mb-1"
                        >
                          Người đại diện khách hàng ký nhận <span className="text-red-500">*</span>
                        </label>
                        <input
                          id="ack-name-input"
                          type="text"
                          value={ackCustomerName}
                          onChange={(e) => setAckCustomerName(e.target.value)}
                          placeholder="Ví dụ: Đại diện phòng mua hàng đối tác"
                          required
                          className="w-full px-3 py-1.5 text-xs bg-surface border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="ack-file-input"
                          className="block text-[11px] font-semibold text-text mb-1"
                        >
                          Đường dẫn / Tên tệp văn bản đính kèm{' '}
                          <span className="text-red-500">*</span>
                        </label>
                        <input
                          id="ack-file-input"
                          type="text"
                          value={ackFilePath}
                          onChange={(e) => setAckFilePath(e.target.value)}
                          placeholder="Ví dụ: uploads/xac-nhan-bo-giat-PO-001.pdf"
                          required
                          className="w-full px-3 py-1.5 text-xs bg-surface border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {confirmModalError && (
                  <div className="flex items-center gap-2 p-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-md">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{confirmModalError}</span>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setConfirmModalOrder(null)}
                    className="text-xs"
                  >
                    Hủy bỏ
                  </Button>
                  <Button
                    type="submit"
                    disabled={
                      confirmOrderMutation.isPending ||
                      attachAckAndConfirmMutation.isPending ||
                      confirmModalOrder.isCustom ||
                      !confirmModalOrder.fabricTypeId ||
                      !confirmModalOrder.colorId
                    }
                    className="text-xs bg-green-600 hover:bg-green-700 text-white font-medium flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>
                      {confirmOrderMutation.isPending || attachAckAndConfirmMutation.isPending
                        ? 'Đang xác nhận...'
                        : 'Xác nhận & Khởi chạy'}
                    </span>
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal View Defects per Bundle/Inspection (T5.3, FR-18) */}
      {defectsModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-surface rounded-xl border border-border shadow-xl max-w-3xl w-full my-8 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                <h2 className="text-base font-bold text-text">
                  Danh sách lỗi đơn hàng {defectsModalOrder.orderNumber} (FR-18)
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setDefectsModalOrder(null)}
                className="text-text-muted hover:text-text"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-muted/40 rounded-lg text-xs">
                <div>
                  <span className="text-text-muted">Style: </span>
                  <span className="font-semibold text-text">
                    {defectsModalOrder.style?.styleCode} - {defectsModalOrder.style?.name}
                  </span>
                </div>
                <div>
                  <span className="text-text-muted">Tổng số bản ghi lỗi: </span>
                  <span className="font-bold text-amber-700">{orderDefects.length}</span>
                </div>
                <div>
                  <span className="text-text-muted">Tổng số lượng sản phẩm lỗi: </span>
                  <span className="font-bold text-red-600">
                    {orderDefects.reduce((acc, d) => acc + d.qty, 0)}
                  </span>
                </div>
              </div>

              {isLoadingDefects ? (
                <div className="py-8 text-center text-xs text-text-muted">
                  Đang tải danh sách lỗi...
                </div>
              ) : orderDefects.length === 0 ? (
                <div className="py-8 text-center text-xs text-text-muted border border-dashed border-border rounded-lg">
                  Chưa ghi nhận lỗi nào cho đơn hàng này.
                </div>
              ) : (
                <div className="border border-border rounded-lg overflow-hidden max-h-96 overflow-y-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-border bg-muted/50 text-text-muted uppercase text-[10px] tracking-wider">
                        <th className="py-2.5 px-3">Công đoạn</th>
                        <th className="py-2.5 px-3">Mã kiện (Bundle)</th>
                        <th className="py-2.5 px-3">Size</th>
                        <th className="py-2.5 px-3">Loại lỗi</th>
                        <th className="py-2.5 px-3 text-right">Số lượng lỗi</th>
                        <th className="py-2.5 px-3">Người kiểm tra</th>
                        <th className="py-2.5 px-3">Thời gian</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {orderDefects.map((defect) => (
                        <tr key={defect.id} className="hover:bg-muted/20">
                          <td className="py-2 px-3 font-medium text-text">
                            {defect.stepName} ({defect.stepCode})
                          </td>
                          <td className="py-2 px-3 text-text font-mono">
                            {defect.bundleCode || 'Toàn bộ'}
                          </td>
                          <td className="py-2 px-3 text-text">
                            {defect.size ? (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-muted border border-border">
                                {defect.size}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="py-2 px-3 text-red-700 font-medium">
                            {defect.defectType}
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-red-600">
                            {defect.qty}
                          </td>
                          <td className="py-2 px-3 text-text-muted">
                            {defect.inspectorName || 'QC Inspector'}
                          </td>
                          <td className="py-2 px-3 text-text-muted text-[11px]">
                            {new Date(defect.createdAt).toLocaleString('vi-VN')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex justify-end pt-3 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDefectsModalOrder(null)}
                  className="text-xs"
                >
                  Đóng
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Handover and Packing (T5.4, FR-26) */}
      {handoverModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-surface rounded-xl border border-border shadow-xl max-w-2xl w-full my-8 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30">
              <div className="flex items-center gap-2">
                <PackageCheck className="h-5 w-5 text-blue-600" />
                <h2 className="text-base font-bold text-text">
                  Đóng gói & Bàn giao đơn hàng {handoverModalOrder.orderNumber} (FR-26)
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setHandoverModalOrder(null)}
                className="text-text-muted hover:text-text"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Order and QC Profile Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-muted/30 rounded-lg border border-border text-xs">
                <div>
                  <span className="text-text-muted">Kiểu dáng: </span>
                  <span className="font-semibold text-text">
                    {handoverModalOrder.style?.styleCode} - {handoverModalOrder.style?.name}
                  </span>
                </div>
                <div>
                  <span className="text-text-muted">Hồ sơ QC áp dụng: </span>
                  <Badge
                    tone={handoverModalOrder.skipCleanWash ? 'warning' : 'primary'}
                    className="ml-1 text-[11px] font-mono"
                  >
                    {handoverModalOrder.skipCleanWash ? 'SKIP_CLEAN_WASH' : 'FULL_PROCESS'}
                  </Badge>
                </div>
                <div>
                  <span className="text-text-muted">Trạng thái đơn: </span>
                  <Badge tone="neutral" className="ml-1 text-[11px]">
                    {i18n.orderStatus[handoverModalOrder.status] || handoverModalOrder.status}
                  </Badge>
                </div>
                <div>
                  <span className="text-text-muted">Quy trình giặt: </span>
                  <span className="font-medium text-text">
                    {handoverModalOrder.skipCleanWash
                      ? 'Bỏ giặt sạch (BR-18)'
                      : 'Quy trình tiêu chuẩn'}
                  </span>
                </div>
              </div>

              {/* Already Handed Over Notice */}
              {existingHandover ? (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span>Đơn hàng đã được bàn giao hoàn tất!</span>
                  </div>
                  <p className="text-[11px] text-emerald-700">
                    Người thực hiện:{' '}
                    <span className="font-medium">{existingHandover.handedOverByName}</span> lúc{' '}
                    {new Date(existingHandover.handedOverAt).toLocaleString('vi-VN')}
                  </p>
                  {existingHandover.notes && (
                    <p className="text-[11px] text-emerald-700 italic">
                      Ghi chú: {existingHandover.notes}
                    </p>
                  )}
                </div>
              ) : (
                (() => {
                  const wf = handoverModalOrder.workflowInstance as
                    | {
                        stepInstances?: Array<{
                          stepDefinition?: { code: string; name: string };
                          status: string;
                        }>;
                      }
                    | undefined;
                  const finalQcStep = wf?.stepInstances?.find(
                    (s) => s.stepDefinition?.code === 'FINAL_QC',
                  );
                  const isFinalQcDone = finalQcStep?.status === 'DONE';

                  if (!isFinalQcDone) {
                    return (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                        <span>
                          Chưa thể bàn giao: Công đoạn kiểm tra chất lượng cuối cùng (FINAL_QC) chưa
                          hoàn thành (DONE).
                          {finalQcStep ? ` Trạng thái hiện tại: [${finalQcStep.status}].` : ''}
                        </span>
                      </div>
                    );
                  }
                  return null;
                })()
              )}

              {/* Packing List Table */}
              <div>
                <h3 className="text-xs font-semibold text-text mb-2">
                  Bảng kê đóng gói theo cỡ (Packing List by Size)
                </h3>
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-border bg-muted/50 text-text-muted uppercase text-[10px] tracking-wider">
                        <th className="py-2 px-3">Size</th>
                        <th className="py-2 px-3 text-right">SL Kế hoạch</th>
                        <th className="py-2 px-3 text-right">SL Đóng gói thực tế</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {(existingHandover?.packingList ?? handoverModalOrder.sizeLines).map(
                        (line) => {
                          const actualQty = 'actualQty' in line ? line.actualQty : line.plannedQty;
                          return (
                            <tr key={line.size} className="hover:bg-muted/10">
                              <td className="py-2 px-3 font-semibold text-text">{line.size}</td>
                              <td className="py-2 px-3 text-right text-text-muted">
                                {line.plannedQty}
                              </td>
                              <td className="py-2 px-3 text-right font-bold text-text">
                                {actualQty}
                              </td>
                            </tr>
                          );
                        },
                      )}
                      <tr className="bg-muted/30 font-semibold border-t border-border">
                        <td className="py-2 px-3 text-text">Tổng cộng (Total Qty)</td>
                        <td className="py-2 px-3 text-right text-text-muted">
                          {(existingHandover?.packingList ?? handoverModalOrder.sizeLines).reduce(
                            (acc, l) => acc + l.plannedQty,
                            0,
                          )}
                        </td>
                        <td className="py-2 px-3 text-right text-blue-700">
                          {existingHandover?.totalQty ??
                            handoverModalOrder.sizeLines.reduce((acc, l) => acc + l.plannedQty, 0)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Handover notes input for pending handovers */}
              {!existingHandover && (
                <div>
                  <label
                    htmlFor="handover-notes"
                    className="block text-xs font-semibold text-text mb-1"
                  >
                    Ghi chú bàn giao
                  </label>
                  <input
                    id="handover-notes"
                    type="text"
                    value={handoverNotes}
                    onChange={(e) => setHandoverNotes(e.target.value)}
                    placeholder="Ví dụ: Đóng thùng 10 kiện carton, niêm phong đầy đủ"
                    className="w-full px-3 py-2 text-xs bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              )}

              {handoverError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{handoverError}</span>
                </div>
              )}

              {/* Footer actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setHandoverModalOrder(null)}
                  className="text-xs"
                >
                  Đóng
                </Button>
                {!existingHandover &&
                  (() => {
                    const wf = handoverModalOrder.workflowInstance as
                      | {
                          stepInstances?: Array<{
                            stepDefinition?: { code: string };
                            status: string;
                          }>;
                        }
                      | undefined;
                    const finalQcStep = wf?.stepInstances?.find(
                      (s) => s.stepDefinition?.code === 'FINAL_QC',
                    );
                    const isFinalQcDone = finalQcStep?.status === 'DONE';

                    return (
                      <Button
                        type="button"
                        disabled={!isFinalQcDone || createHandoverMutation.isPending}
                        onClick={() =>
                          createHandoverMutation.mutate({
                            orderId: handoverModalOrder.id,
                            notes: handoverNotes || undefined,
                          })
                        }
                        className="text-xs bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5"
                      >
                        <PackageCheck className="h-4 w-4" />
                        <span>
                          {createHandoverMutation.isPending
                            ? 'Đang tạo biên bản...'
                            : 'Tạo biên bản bàn giao & Hoàn tất đơn'}
                        </span>
                      </Button>
                    );
                  })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
