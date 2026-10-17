import {
  AlertTriangle,
  CheckCircle2,
  Droplets,
  Factory,
  Layers,
  Palette,
  Plus,
  RefreshCw,
  Scissors,
  Search,
  X,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import {
  createColorOption,
  createFabricType,
  createStation,
  createStyle,
  createWashType,
  deleteColorOption,
  deleteFabricType,
  deleteStation,
  deleteStyle,
  deleteWashType,
  fetchColorOptions,
  fetchFabricTypes,
  fetchStations,
  fetchStyles,
  fetchWashTypes,
  updateColorOption,
  updateFabricType,
  updateStation,
  updateStyle,
  updateWashType,
  type ColorOptionItem,
  type FabricTypeItem,
  type StationItem,
  type StyleItem,
  type WashTypeItem,
} from '../lib/api';
import { useAuth } from '../lib/auth-context';

type TabKey = 'styles' | 'fabrics' | 'colors' | 'washes' | 'stations';
type CatalogItem = StyleItem | FabricTypeItem | ColorOptionItem | WashTypeItem | StationItem;

export const CatalogPage: React.FC = () => {
  const { user, token } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'ADMIN';

  const [activeTab, setActiveTab] = useState<TabKey>('styles');
  const [searchTerm, setSearchTerm] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Queries
  const {
    data: styles = [],
    isLoading: loadingStyles,
    refetch: refetchStyles,
  } = useQuery({
    queryKey: ['catalog', 'styles'],
    queryFn: fetchStyles,
  });

  const {
    data: fabrics = [],
    isLoading: loadingFabrics,
    refetch: refetchFabrics,
  } = useQuery({
    queryKey: ['catalog', 'fabrics'],
    queryFn: fetchFabricTypes,
  });

  const {
    data: colors = [],
    isLoading: loadingColors,
    refetch: refetchColors,
  } = useQuery({
    queryKey: ['catalog', 'colors'],
    queryFn: fetchColorOptions,
  });

  const {
    data: washes = [],
    isLoading: loadingWashes,
    refetch: refetchWashes,
  } = useQuery({
    queryKey: ['catalog', 'washes'],
    queryFn: fetchWashTypes,
  });

  const {
    data: stations = [],
    isLoading: loadingStations,
    refetch: refetchStations,
  } = useQuery({
    queryKey: ['catalog', 'stations'],
    queryFn: fetchStations,
  });

  const showNotification = (msg: string, isError = false) => {
    if (isError) {
      setErrorMessage(msg);
      setTimeout(() => setErrorMessage(null), 6000);
    } else {
      setSuccessMessage(msg);
      setTimeout(() => setSuccessMessage(null), 4000);
    }
  };

  // Mutations
  const styleMutation = useMutation({
    mutationFn: async (data: { id?: string; dto: Partial<StyleItem> }) => {
      if (data.id) return updateStyle(data.id, data.dto, token);
      return createStyle(data.dto, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalog', 'styles'] });
      setIsModalOpen(false);
      showNotification('Đã lưu mã hàng Jeans thành công!');
    },
    onError: (err: Error) => showNotification(err.message, true),
  });

  const fabricMutation = useMutation({
    mutationFn: async (data: { id?: string; dto: Partial<FabricTypeItem> }) => {
      if (data.id) return updateFabricType(data.id, data.dto, token);
      return createFabricType(data.dto, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalog', 'fabrics'] });
      setIsModalOpen(false);
      showNotification('Đã lưu loại vải Denim thành công!');
    },
    onError: (err: Error) => showNotification(err.message, true),
  });

  const colorMutation = useMutation({
    mutationFn: async (data: { id?: string; dto: Partial<ColorOptionItem> }) => {
      if (data.id) return updateColorOption(data.id, data.dto, token);
      return createColorOption(data.dto, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalog', 'colors'] });
      setIsModalOpen(false);
      showNotification('Đã lưu màu nhuộm thành công!');
    },
    onError: (err: Error) => showNotification(err.message, true),
  });

  const washMutation = useMutation({
    mutationFn: async (data: { id?: string; dto: Partial<WashTypeItem> }) => {
      if (data.id) return updateWashType(data.id, data.dto, token);
      return createWashType(data.dto, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalog', 'washes'] });
      setIsModalOpen(false);
      showNotification('Đã lưu kiểu giặt mài thành công!');
    },
    onError: (err: Error) => showNotification(err.message, true),
  });

  const stationMutation = useMutation({
    mutationFn: async (data: { id?: string; dto: Partial<StationItem> }) => {
      if (data.id) return updateStation(data.id, data.dto, token);
      return createStation(data.dto, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalog', 'stations'] });
      setIsModalOpen(false);
      showNotification('Đã lưu trạm sản xuất thành công!');
    },
    onError: (err: Error) => showNotification(err.message, true),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async ({ tab, id }: { tab: TabKey; id: string }) => {
      if (tab === 'styles') return deleteStyle(id, token);
      if (tab === 'fabrics') return deleteFabricType(id, token);
      if (tab === 'colors') return deleteColorOption(id, token);
      if (tab === 'washes') return deleteWashType(id, token);
      if (tab === 'stations') return deleteStation(id, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalog'] });
      setDeletingId(null);
      showNotification('Đã xóa dữ liệu thành công!');
    },
    onError: (err: Error) => {
      setDeletingId(null);
      showNotification(err.message, true);
    },
  });

  // Filtered items
  const filteredStyles = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return styles.filter(
      (s) => s.styleCode.toLowerCase().includes(q) || s.name.toLowerCase().includes(q),
    );
  }, [styles, searchTerm]);

  const filteredFabrics = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return fabrics.filter(
      (f) => f.code.toLowerCase().includes(q) || f.name.toLowerCase().includes(q),
    );
  }, [fabrics, searchTerm]);

  const filteredColors = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return colors.filter(
      (c) => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q),
    );
  }, [colors, searchTerm]);

  const filteredWashes = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return washes.filter(
      (w) => w.code.toLowerCase().includes(q) || w.name.toLowerCase().includes(q),
    );
  }, [washes, searchTerm]);

  const filteredStations = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return stations.filter(
      (st) => st.code.toLowerCase().includes(q) || st.name.toLowerCase().includes(q),
    );
  }, [stations, searchTerm]);

  // Form handler
  const handleOpenAdd = () => {
    setEditingItem(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: CatalogItem) => {
    setEditingItem(item);
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    if (activeTab === 'styles') {
      const dto: Partial<StyleItem> = {
        styleCode: String(formData.get('styleCode') || ''),
        name: String(formData.get('name') || ''),
        fitType: String(formData.get('fitType') || '') || null,
        hasEmbroidery: formData.get('hasEmbroidery') === 'on',
        isActive: formData.get('isActive') === 'on',
      };
      styleMutation.mutate({ id: editingItem?.id, dto });
    } else if (activeTab === 'fabrics') {
      const weightOzStr = formData.get('weightOz');
      const dto: Partial<FabricTypeItem> = {
        code: String(formData.get('code') || ''),
        name: String(formData.get('name') || ''),
        weightOz: weightOzStr ? parseFloat(String(weightOzStr)) : null,
        composition: String(formData.get('composition') || '') || null,
        stretchType: String(formData.get('stretchType') || 'RIGID'),
      };
      fabricMutation.mutate({ id: editingItem?.id, dto });
    } else if (activeTab === 'colors') {
      const dto: Partial<ColorOptionItem> = {
        code: String(formData.get('code') || ''),
        name: String(formData.get('name') || ''),
        colorFamily: String(formData.get('colorFamily') || '') || null,
      };
      colorMutation.mutate({ id: editingItem?.id, dto });
    } else if (activeTab === 'washes') {
      const dto: Partial<WashTypeItem> = {
        code: String(formData.get('code') || ''),
        name: String(formData.get('name') || ''),
        description: String(formData.get('description') || '') || null,
      };
      washMutation.mutate({ id: editingItem?.id, dto });
    } else if (activeTab === 'stations') {
      const dto: Partial<StationItem> = {
        code: String(formData.get('code') || ''),
        name: String(formData.get('name') || ''),
        stationType: String(formData.get('stationType') || 'SEWING'),
        isOutsourced: formData.get('isOutsourced') === 'on',
      };
      stationMutation.mutate({ id: editingItem?.id, dto });
    }
  };

  const tabs = [
    { key: 'styles' as TabKey, label: 'Mã hàng Jeans', icon: Scissors, count: styles.length },
    { key: 'fabrics' as TabKey, label: 'Loại vải Denim', icon: Layers, count: fabrics.length },
    { key: 'colors' as TabKey, label: 'Màu nhuộm', icon: Palette, count: colors.length },
    { key: 'washes' as TabKey, label: 'Kiểu giặt mài', icon: Droplets, count: washes.length },
    { key: 'stations' as TabKey, label: 'Trạm sản xuất', icon: Factory, count: stations.length },
  ];

  const currentLoading =
    activeTab === 'styles'
      ? loadingStyles
      : activeTab === 'fabrics'
        ? loadingFabrics
        : activeTab === 'colors'
          ? loadingColors
          : activeTab === 'washes'
            ? loadingWashes
            : loadingStations;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-bold text-text">Danh mục Dữ liệu Xưởng May</h1>
          <p className="text-sm text-text-muted mt-1">
            Quản lý dữ liệu tham chiếu nền tảng: Mã kiểu dáng, cuộn vải Denim, màu sắc, kiểu giặt
            mài và các trạm gia công.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchStyles();
              refetchFabrics();
              refetchColors();
              refetchWashes();
              refetchStations();
            }}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Làm mới</span>
          </Button>

          {isAdmin ? (
            <Button
              variant="primary"
              size="sm"
              onClick={handleOpenAdd}
              className="flex items-center gap-1.5"
            >
              <Plus className="h-4 w-4" />
              <span>Thêm mới</span>
            </Button>
          ) : (
            <Badge tone="info" className="py-1 px-3">
              Chế độ xem
            </Badge>
          )}
        </div>
      </div>

      {/* Notifications */}
      {errorMessage && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-red-500 hover:text-red-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-3 bg-green-50 border border-green-200 text-green-800 rounded flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-green-500 hover:text-green-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {!isAdmin && (
        <div className="p-3 bg-blue-50 border border-blue-200 text-blue-900 rounded text-xs">
          Bạn đang xem danh mục tham chiếu. Quyền thêm, chỉnh sửa hoặc xóa dữ liệu thuộc về Quản trị
          viên (Admin).
        </div>
      )}

      {/* Tabs navigation */}
      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
                setSearchTerm('');
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-surface text-text hover:bg-background border border-border'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
              <span
                className={`text-xs px-1.5 py-0.2 rounded-full ${
                  isActive ? 'bg-white/20 text-white' : 'bg-muted text-text-muted'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-text-muted" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo mã hoặc tên..."
            className="pl-9 h-9 text-sm"
          />
        </div>
      </div>

      {/* Content Area */}
      <Card>
        <CardContent className="p-0">
          {currentLoading ? (
            <div className="flex items-center justify-center p-12 text-sm text-text-muted">
              <RefreshCw className="h-5 w-5 animate-spin mr-2" />
              <span>Đang tải danh mục...</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              {/* TAB 1: STYLES */}
              {activeTab === 'styles' && (
                <table className="w-full text-left text-sm">
                  <thead className="bg-surface-tint border-b border-border text-xs uppercase text-text-muted font-semibold">
                    <tr>
                      <th className="py-3 px-4">Mã kiểu dáng</th>
                      <th className="py-3 px-4">Tên sản phẩm</th>
                      <th className="py-3 px-4">Dáng quần (Fit)</th>
                      <th className="py-3 px-4">Thêu / In ấn</th>
                      <th className="py-3 px-4">Trạng thái</th>
                      {isAdmin && <th className="py-3 px-4 text-right">Thao tác</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredStyles.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-text-muted text-sm">
                          Chưa có mã hàng Jeans nào phù hợp.
                        </td>
                      </tr>
                    ) : (
                      filteredStyles.map((item) => (
                        <tr key={item.id} className="hover:bg-background/50">
                          <td className="py-3 px-4 font-mono font-medium text-primary">
                            {item.styleCode}
                          </td>
                          <td className="py-3 px-4 font-medium text-text">{item.name}</td>
                          <td className="py-3 px-4 text-text-muted">
                            {item.fitType || 'Tiêu chuẩn'}
                          </td>
                          <td className="py-3 px-4">
                            {item.hasEmbroidery ? (
                              <Badge tone="info">Có thêu</Badge>
                            ) : (
                              <span className="text-text-muted text-xs">Không thêu</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {item.isActive ? (
                              <Badge tone="success">Đang áp dụng</Badge>
                            ) : (
                              <Badge tone="neutral">Tạm dừng</Badge>
                            )}
                          </td>
                          {isAdmin && (
                            <td className="py-3 px-4 text-right space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenEdit(item)}
                                className="h-8 px-2 text-xs"
                              >
                                Sửa
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setDeletingId(item.id)}
                                className="h-8 px-2 text-xs text-danger hover:text-danger hover:border-danger"
                              >
                                Xóa
                              </Button>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}

              {/* TAB 2: FABRICS */}
              {activeTab === 'fabrics' && (
                <table className="w-full text-left text-sm">
                  <thead className="bg-surface-tint border-b border-border text-xs uppercase text-text-muted font-semibold">
                    <tr>
                      <th className="py-3 px-4">Mã loại vải</th>
                      <th className="py-3 px-4">Tên loại vải</th>
                      <th className="py-3 px-4">Định lượng (oz)</th>
                      <th className="py-3 px-4">Thành phần sợi</th>
                      <th className="py-3 px-4">Độ co giãn</th>
                      {isAdmin && <th className="py-3 px-4 text-right">Thao tác</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredFabrics.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-text-muted text-sm">
                          Chưa có loại vải Denim nào.
                        </td>
                      </tr>
                    ) : (
                      filteredFabrics.map((item) => (
                        <tr key={item.id} className="hover:bg-background/50">
                          <td className="py-3 px-4 font-mono font-medium text-primary">
                            {item.code}
                          </td>
                          <td className="py-3 px-4 font-medium text-text">{item.name}</td>
                          <td className="py-3 px-4 text-text-muted">
                            {item.weightOz ? `${item.weightOz} oz` : '—'}
                          </td>
                          <td className="py-3 px-4 text-text-muted">{item.composition || '—'}</td>
                          <td className="py-3 px-4">
                            {item.stretchType === 'STRETCH' ? (
                              <Badge tone="info">Co giãn</Badge>
                            ) : (
                              <Badge tone="neutral">Không co giãn (Rigid)</Badge>
                            )}
                          </td>
                          {isAdmin && (
                            <td className="py-3 px-4 text-right space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenEdit(item)}
                                className="h-8 px-2 text-xs"
                              >
                                Sửa
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setDeletingId(item.id)}
                                className="h-8 px-2 text-xs text-danger hover:text-danger hover:border-danger"
                              >
                                Xóa
                              </Button>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}

              {/* TAB 3: COLORS */}
              {activeTab === 'colors' && (
                <table className="w-full text-left text-sm">
                  <thead className="bg-surface-tint border-b border-border text-xs uppercase text-text-muted font-semibold">
                    <tr>
                      <th className="py-3 px-4">Mã màu</th>
                      <th className="py-3 px-4">Tên màu nhuộm</th>
                      <th className="py-3 px-4">Họ màu / Nhóm</th>
                      {isAdmin && <th className="py-3 px-4 text-right">Thao tác</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredColors.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center py-8 text-text-muted text-sm">
                          Chưa có mã màu nhuộm nào.
                        </td>
                      </tr>
                    ) : (
                      filteredColors.map((item) => (
                        <tr key={item.id} className="hover:bg-background/50">
                          <td className="py-3 px-4 font-mono font-medium text-primary">
                            {item.code}
                          </td>
                          <td className="py-3 px-4 font-medium text-text">{item.name}</td>
                          <td className="py-3 px-4">
                            <Badge tone="neutral">{item.colorFamily || 'Khác'}</Badge>
                          </td>
                          {isAdmin && (
                            <td className="py-3 px-4 text-right space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenEdit(item)}
                                className="h-8 px-2 text-xs"
                              >
                                Sửa
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setDeletingId(item.id)}
                                className="h-8 px-2 text-xs text-danger hover:text-danger hover:border-danger"
                              >
                                Xóa
                              </Button>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}

              {/* TAB 4: WASHES */}
              {activeTab === 'washes' && (
                <table className="w-full text-left text-sm">
                  <thead className="bg-surface-tint border-b border-border text-xs uppercase text-text-muted font-semibold">
                    <tr>
                      <th className="py-3 px-4">Mã kiểu giặt</th>
                      <th className="py-3 px-4">Tên công nghệ giặt</th>
                      <th className="py-3 px-4">Mô tả đặc tính hiệu ứng</th>
                      {isAdmin && <th className="py-3 px-4 text-right">Thao tác</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredWashes.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center py-8 text-text-muted text-sm">
                          Chưa có kiểu giặt mài nào.
                        </td>
                      </tr>
                    ) : (
                      filteredWashes.map((item) => (
                        <tr key={item.id} className="hover:bg-background/50">
                          <td className="py-3 px-4 font-mono font-medium text-primary">
                            {item.code}
                          </td>
                          <td className="py-3 px-4 font-medium text-text">{item.name}</td>
                          <td className="py-3 px-4 text-text-muted text-xs leading-relaxed max-w-md">
                            {item.description || '—'}
                          </td>
                          {isAdmin && (
                            <td className="py-3 px-4 text-right space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenEdit(item)}
                                className="h-8 px-2 text-xs"
                              >
                                Sửa
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setDeletingId(item.id)}
                                className="h-8 px-2 text-xs text-danger hover:text-danger hover:border-danger"
                              >
                                Xóa
                              </Button>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}

              {/* TAB 5: STATIONS */}
              {activeTab === 'stations' && (
                <table className="w-full text-left text-sm">
                  <thead className="bg-surface-tint border-b border-border text-xs uppercase text-text-muted font-semibold">
                    <tr>
                      <th className="py-3 px-4">Mã trạm</th>
                      <th className="py-3 px-4">Tên phân xưởng / chuyền</th>
                      <th className="py-3 px-4">Loại công đoạn</th>
                      <th className="py-3 px-4">Mô hình sản xuất</th>
                      {isAdmin && <th className="py-3 px-4 text-right">Thao tác</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredStations.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-8 text-text-muted text-sm">
                          Chưa có trạm sản xuất nào.
                        </td>
                      </tr>
                    ) : (
                      filteredStations.map((item) => (
                        <tr key={item.id} className="hover:bg-background/50">
                          <td className="py-3 px-4 font-mono font-medium text-primary">
                            {item.code}
                          </td>
                          <td className="py-3 px-4 font-medium text-text">{item.name}</td>
                          <td className="py-3 px-4">
                            <Badge tone="neutral">{item.stationType}</Badge>
                          </td>
                          <td className="py-3 px-4">
                            {item.isOutsourced ? (
                              <Badge tone="warning">Gia công ngoài</Badge>
                            ) : (
                              <Badge tone="info">Nội bộ xưởng</Badge>
                            )}
                          </td>
                          {isAdmin && (
                            <td className="py-3 px-4 text-right space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenEdit(item)}
                                className="h-8 px-2 text-xs"
                              >
                                Sửa
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setDeletingId(item.id)}
                                className="h-8 px-2 text-xs text-danger hover:text-danger hover:border-danger"
                              >
                                Xóa
                              </Button>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-surface rounded-lg shadow-xl border border-border w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h2 className="text-base font-semibold text-text">
                {editingItem ? 'Chỉnh sửa' : 'Thêm mới'}{' '}
                {activeTab === 'styles'
                  ? 'Mã hàng Jeans'
                  : activeTab === 'fabrics'
                    ? 'Loại vải Denim'
                    : activeTab === 'colors'
                      ? 'Màu nhuộm'
                      : activeTab === 'washes'
                        ? 'Kiểu giặt mài'
                        : 'Trạm sản xuất'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-text-muted hover:text-text"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              {/* Form fields based on tab */}
              {activeTab === 'styles' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1">
                      Mã kiểu dáng *
                    </label>
                    <Input
                      name="styleCode"
                      defaultValue={(editingItem as StyleItem | null)?.styleCode || ''}
                      placeholder="VD: JN-SLIM-01"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1">
                      Tên gọi sản phẩm *
                    </label>
                    <Input
                      name="name"
                      defaultValue={(editingItem as StyleItem | null)?.name || ''}
                      placeholder="VD: Quần Jeans Nam Ống Đứng"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1">
                      Dáng quần (Fit)
                    </label>
                    <Input
                      name="fitType"
                      defaultValue={(editingItem as StyleItem | null)?.fitType || ''}
                      placeholder="VD: Slim, Regular, Baggy"
                    />
                  </div>
                  <div className="flex items-center gap-6 pt-2">
                    <label className="flex items-center gap-2 text-sm text-text cursor-pointer">
                      <input
                        type="checkbox"
                        name="hasEmbroidery"
                        defaultChecked={(editingItem as StyleItem | null)?.hasEmbroidery ?? false}
                        className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                      />
                      <span>Có thêu hoặc in ấn</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm text-text cursor-pointer">
                      <input
                        type="checkbox"
                        name="isActive"
                        defaultChecked={(editingItem as StyleItem | null)?.isActive ?? true}
                        className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                      />
                      <span>Đang áp dụng sản xuất</span>
                    </label>
                  </div>
                </>
              )}

              {activeTab === 'fabrics' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1">
                      Mã loại vải *
                    </label>
                    <Input
                      name="code"
                      defaultValue={(editingItem as FabricTypeItem | null)?.code || ''}
                      placeholder="VD: DN-12-RIGID"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1">
                      Tên gọi loại vải *
                    </label>
                    <Input
                      name="name"
                      defaultValue={(editingItem as FabricTypeItem | null)?.name || ''}
                      placeholder="VD: Denim 12oz Không Co Giãn"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-text-muted mb-1">
                        Định lượng vải (oz)
                      </label>
                      <Input
                        name="weightOz"
                        type="number"
                        step="0.1"
                        defaultValue={(editingItem as FabricTypeItem | null)?.weightOz ?? ''}
                        placeholder="VD: 12.0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-text-muted mb-1">
                        Độ co giãn
                      </label>
                      <select
                        name="stretchType"
                        defaultValue={
                          (editingItem as FabricTypeItem | null)?.stretchType || 'RIGID'
                        }
                        className="w-full h-9 rounded border border-border bg-surface px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="RIGID">Không co giãn (Rigid)</option>
                        <option value="STRETCH">Co giãn (Stretch)</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1">
                      Thành phần sợi vải
                    </label>
                    <Input
                      name="composition"
                      defaultValue={(editingItem as FabricTypeItem | null)?.composition || ''}
                      placeholder="VD: 98% Cotton, 2% Spandex"
                    />
                  </div>
                </>
              )}

              {activeTab === 'colors' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1">
                      Mã màu *
                    </label>
                    <Input
                      name="code"
                      defaultValue={(editingItem as ColorOptionItem | null)?.code || ''}
                      placeholder="VD: CLR-INDIGO"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1">
                      Tên màu nhuộm *
                    </label>
                    <Input
                      name="name"
                      defaultValue={(editingItem as ColorOptionItem | null)?.name || ''}
                      placeholder="VD: Xanh Chàm Indigo Truyền Thống"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1">
                      Họ màu / Nhóm sắc tố
                    </label>
                    <Input
                      name="colorFamily"
                      defaultValue={(editingItem as ColorOptionItem | null)?.colorFamily || ''}
                      placeholder="VD: Xanh, Đen, Xám, Trắng"
                    />
                  </div>
                </>
              )}

              {activeTab === 'washes' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1">
                      Mã kiểu giặt *
                    </label>
                    <Input
                      name="code"
                      defaultValue={(editingItem as WashTypeItem | null)?.code || ''}
                      placeholder="VD: WSH-STONE"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1">
                      Tên công nghệ giặt mài *
                    </label>
                    <Input
                      name="name"
                      defaultValue={(editingItem as WashTypeItem | null)?.name || ''}
                      placeholder="VD: Giặt Mài Đá (Stone Wash)"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1">
                      Mô tả đặc tính hiệu ứng
                    </label>
                    <textarea
                      name="description"
                      rows={3}
                      defaultValue={(editingItem as WashTypeItem | null)?.description || ''}
                      placeholder="VD: Mài sờn nhẹ tự nhiên bằng đá bọt..."
                      className="w-full rounded border border-border bg-surface p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </>
              )}

              {activeTab === 'stations' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1">
                      Mã trạm *
                    </label>
                    <Input
                      name="code"
                      defaultValue={(editingItem as StationItem | null)?.code || ''}
                      placeholder="VD: CUT-01, SEW-01"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1">
                      Tên phân xưởng / chuyền *
                    </label>
                    <Input
                      name="name"
                      defaultValue={(editingItem as StationItem | null)?.name || ''}
                      placeholder="VD: Xưởng Cắt Bán Thành Phẩm 01"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-text-muted mb-1">
                        Loại công đoạn
                      </label>
                      <select
                        name="stationType"
                        defaultValue={(editingItem as StationItem | null)?.stationType || 'SEWING'}
                        className="w-full h-9 rounded border border-border bg-surface px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="CUTTING">Cắt (CUTTING)</option>
                        <option value="SEWING">May ráp (SEWING)</option>
                        <option value="EMBROIDERY">Thêu & In (EMBROIDERY)</option>
                        <option value="DYEING">Nhuộm (DYEING)</option>
                        <option value="WASH">Giặt mài (WASH)</option>
                        <option value="FINISHING">Hoàn thiện nút (FINISHING)</option>
                        <option value="QC">Kiểm định QC (QC)</option>
                        <option value="PACKING">Đóng gói (PACKING)</option>
                      </select>
                    </div>
                    <div className="flex items-center pt-5">
                      <label className="flex items-center gap-2 text-sm text-text cursor-pointer">
                        <input
                          type="checkbox"
                          name="isOutsourced"
                          defaultChecked={
                            (editingItem as StationItem | null)?.isOutsourced ?? false
                          }
                          className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                        />
                        <span>Gia công ngoài (Outsourced)</span>
                      </label>
                    </div>
                  </div>
                </>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-4 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsModalOpen(false)}
                >
                  Huỷ bỏ
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={
                    styleMutation.isPending ||
                    fabricMutation.isPending ||
                    colorMutation.isPending ||
                    washMutation.isPending ||
                    stationMutation.isPending
                  }
                >
                  {editingItem ? 'Lưu cập nhật' : 'Tạo mới'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-surface rounded-lg shadow-xl border border-border w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3 text-danger">
              <AlertTriangle className="h-6 w-6 shrink-0" />
              <h3 className="text-base font-bold text-text">Xác nhận xóa bản ghi?</h3>
            </div>
            <p className="text-sm text-text-muted">
              Hành động này sẽ xóa vĩnh viễn bản ghi khỏi danh mục nền tảng. Nếu dữ liệu đang được
              liên kết trong quy trình hoặc đơn hàng, thao tác sẽ bị hệ thống từ chối.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeletingId(null)}
                disabled={deleteMutation.isPending}
              >
                Huỷ bỏ
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => deleteMutation.mutate({ tab: activeTab, id: deletingId })}
                disabled={deleteMutation.isPending}
                className="bg-danger hover:bg-danger/90 text-white"
              >
                {deleteMutation.isPending ? 'Đang xóa...' : 'Đồng ý xóa'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
