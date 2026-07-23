import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowUp, 
  ArrowDown, 
  ArrowUpDown, 
  Eye, 
  Pencil, 
  MoreVertical, 
  CheckSquare, 
  Printer, 
  Trash2,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  GraduationCap,
  AlertTriangle,
  School
} from 'lucide-react';
import { Santri, Lembaga, Kelas, isGenderMatch } from '../../../types';
import { renderSantriAvatar, getFormalKelasDisplay } from '../../SekretarisHelper';
import { MembershipBadge } from '../components/HelperComponents';
import { AgeFilterConfig, calculateAgeOnDate } from '../AgeFilterModal';
import { fetchTableData } from '../../../lib/api';

interface SantriTableViewProps {
  paginatedSantri: Santri[];
  startIndex: number;
  isSelectionMode: boolean;
  selectedSantriIds: string[];
  setSelectedSantriIds: (ids: string[]) => void;
  visibleColumns: Record<string, boolean>;
  sortKey: string;
  sortDirection: 'asc' | 'desc';
  setSortKey: (key: string) => void;
  setSortDirection: (dir: 'asc' | 'desc') => void;
  setSelectedSantri: (s: Santri) => void;
  handleStartEditSantri: (s: Santri) => void;
  handlePrintClick: (s: Santri) => void;
  handleDeleteClick: (id: string, name: string) => void;
  activeDesktopDropdownId: string | null;
  setActiveDesktopDropdownId: (id: string | null) => void;
  activeSantriDropdownId: string | null;
  setActiveSantriDropdownId: (id: string | null) => void;
  setIsSelectionMode: (val: boolean) => void;
  canWritePutra: boolean;
  canWritePutri: boolean;
  ageFilterConfig?: AgeFilterConfig;
  onUpdateSantri?: (s: Santri) => void;
}

const isSantriDataComplete = (s: Santri): boolean => {
  const requiredFields: (keyof Santri)[] = [
    'nis', 'nama', 'nisn', 'nism', 'nik', 'noKk', 'tempatLahir', 'tanggalLahir',
    'gender', 'pendidikanTerakhir', 'namaAyah', 'nikAyah', 'pekerjaanAyah', 'pendidikanAyah',
    'namaIbu', 'nikIbu', 'pekerjaanIbu', 'pendidikanIbu', 'alamat', 'rt', 'rw', 'desa',
    'kecamatan', 'kabupaten', 'provinsi', 'noHp', 'statusKeanggotaan', 'statusEmis'
  ];
  
  for (const field of requiredFields) {
    const val = s[field];
    if (val === undefined || val === null || String(val).trim() === '') {
      return false;
    }
  }

  if (s.statusKeanggotaan === 'Aktif') {
    if (!s.statusDomisili || String(s.statusDomisili).trim() === '') {
      return false;
    }
  }

  return true;
};

const isMonitoringWajibComplete = (s: Santri): boolean => {
  const wajibFields: (keyof Santri)[] = [
    'nis', 'gender', 'nik', 'nisn', 'tempatLahir', 'tanggalLahir',
    'desa', 'kecamatan', 'kabupaten', 'provinsi', 'pendidikanTerakhir',
    'namaAyah', 'namaIbu', 'statusKeanggotaan', 'noHp', 'tanggalMasuk', 'statusEmis'
  ];
  
  for (const field of wajibFields) {
    const val = s[field];
    if (val === undefined || val === null || String(val).trim() === '') {
      return false;
    }
  }
  return true;
};

export default function SantriTableView({
  paginatedSantri,
  startIndex,
  isSelectionMode,
  selectedSantriIds,
  setSelectedSantriIds,
  visibleColumns,
  sortKey,
  sortDirection,
  setSortKey,
  setSortDirection,
  setSelectedSantri,
  handleStartEditSantri,
  handlePrintClick,
  handleDeleteClick,
  activeDesktopDropdownId,
  setActiveDesktopDropdownId,
  activeSantriDropdownId,
  setActiveSantriDropdownId,
  setIsSelectionMode,
  canWritePutra,
  canWritePutri,
  ageFilterConfig,
  onUpdateSantri
}: SantriTableViewProps) {
  const [activeEmisDropdownId, setActiveEmisDropdownId] = React.useState<string | null>(null);
  const [activeStatusKeanggotaanDropdownId, setActiveStatusKeanggotaanDropdownId] = React.useState<string | null>(null);
  const [activeDomisiliDropdownId, setActiveDomisiliDropdownId] = React.useState<string | null>(null);
  const [activeFormalKelasDropdownId, setActiveFormalKelasDropdownId] = React.useState<string | null>(null);

  // Pending selection states for column dropdowns
  const [pendingDomisili, setPendingDomisili] = React.useState<{ [santriId: string]: string }>({});
  const [pendingStatusKeanggotaan, setPendingStatusKeanggotaan] = React.useState<{ [santriId: string]: 'Aktif' | 'Alumni' | 'Meninggal' }>({});
  const [pendingEmis, setPendingEmis] = React.useState<{ [santriId: string]: 'Terdaftar' | 'Belum' }>({});
  const [pendingFormalKelas, setPendingFormalKelas] = React.useState<{ [santriId: string]: { lem: Lembaga | null; cls: Kelas | null } }>({});

  const [editingCell, setEditingCell] = React.useState<{ santriId: string; field: keyof Santri; value: string } | null>(null);
  const [editingError, setEditingError] = React.useState<string | null>(null);

  const [lembagasList, setLembagasList] = React.useState<Lembaga[]>(() => {
    try {
      const local = localStorage.getItem('smartsantri_lembagas');
      return local ? JSON.parse(local) : [];
    } catch {
      return [];
    }
  });

  const [kelasList, setKelasList] = React.useState<Kelas[]>(() => {
    try {
      const local = localStorage.getItem('smartsantri_kelas');
      return local ? JSON.parse(local) : [];
    } catch {
      return [];
    }
  });

  React.useEffect(() => {
    const loadEducationData = async () => {
      try {
        const lems = await fetchTableData<Lembaga>('lembaga', 'smartsantri_lembagas', []);
        const kls = await fetchTableData<Kelas>('kelas', 'smartsantri_kelas', []);
        if (lems && lems.length > 0) setLembagasList(lems);
        if (kls && kls.length > 0) setKelasList(kls);
      } catch {}
    };
    loadEducationData();

    const handleCloseDropdowns = (e?: Event) => {
      if (e && e.target) {
        const target = e.target as HTMLElement;
        if (target.closest && (
          target.closest('.dropdown-container-box') || 
          target.closest('.dropdown-trigger-btn')
        )) {
          return;
        }
      }
      setActiveEmisDropdownId(null);
      setActiveStatusKeanggotaanDropdownId(null);
      setActiveDomisiliDropdownId(null);
      setActiveFormalKelasDropdownId(null);
      setActiveDesktopDropdownId(null);
      setActiveSantriDropdownId(null);
    };

    window.addEventListener('click', handleCloseDropdowns, true);
    window.addEventListener('scroll', handleCloseDropdowns, true);
    return () => {
      window.removeEventListener('click', handleCloseDropdowns, true);
      window.removeEventListener('scroll', handleCloseDropdowns, true);
    };
  }, [setActiveDesktopDropdownId, setActiveSantriDropdownId]);

  React.useEffect(() => {
    if (!editingCell) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target && target.closest && target.closest('.edit-container-box')) {
        return;
      }

      const s = paginatedSantri.find(item => item.id === editingCell.santriId);
      if (s) {
        const origVal = ((s[editingCell.field] ?? '') as string).trim();
        const currentVal = editingCell.value.trim();
        if (currentVal === origVal) {
          setEditingCell(null);
          setEditingError(null);
        }
      } else {
        setEditingCell(null);
        setEditingError(null);
      }
    };

    window.addEventListener('click', handleClickOutside, true);
    return () => {
      window.removeEventListener('click', handleClickOutside, true);
    };
  }, [editingCell, paginatedSantri]);

  const handleUpdateFormalClass = (s: Santri, targetLembaga: Lembaga | null, targetClass: Kelas | null) => {
    if (!onUpdateSantri) return;

    const currentKelasStr = s.kelas ? String(s.kelas).trim() : '';
    let currentClasses = currentKelasStr ? currentKelasStr.split(',').map(c => c.trim()).filter(Boolean) : [];

    const getLembagaJenis = (l: Lembaga): 'Formal' | 'Internal' => {
      if (l.jenis) return l.jenis;
      const lower = (l.nama || '').toLowerCase();
      if (
        lower.includes('madin') || lower.includes('diniyah') || lower.includes('tpq') ||
        lower.includes('tahfidz') || lower.includes('pondok') || lower.includes('kitab') ||
        lower.includes('internal') || (l.kode && l.kode.toLowerCase().includes('madin'))
      ) {
        return 'Internal';
      }
      return 'Formal';
    };

    const formalLembagaIds = lembagasList.filter(l => getLembagaJenis(l) === 'Formal').map(l => String(l.id));

    currentClasses = currentClasses.filter(clsName => {
      const lowerCls = clsName.trim().toLowerCase();
      if (
        lowerCls === 'calon pelajar' ||
        lowerCls === 'calon peserta didik' ||
        lowerCls === 'tanpa kelas' ||
        lowerCls === 'tidak mengikuti' ||
        lowerCls === 'belum' ||
        lowerCls === '-' ||
        lowerCls === ''
      ) {
        return false;
      }
      const foundCls = kelasList.find(k => k.nama.trim().toLowerCase() === lowerCls);
      const foundLemId = foundCls ? String(foundCls.lembagaId || (foundCls as any).lembaga_id || '') : null;
      if (foundCls && foundLemId && formalLembagaIds.includes(foundLemId)) {
        return false;
      }
      return true;
    });

    let finalFormalLembagaId: string | undefined = undefined;
    if (targetLembaga) {
      finalFormalLembagaId = targetLembaga.id;
    } else if (targetClass) {
      const foundInList = kelasList.find(k => k.id === targetClass.id || k.nama.trim().toLowerCase() === (targetClass.nama || '').trim().toLowerCase());
      const clsLemId = targetClass.lembagaId || (targetClass as any).lembaga_id || (foundInList ? (foundInList.lembagaId || (foundInList as any).lembaga_id) : null);
      finalFormalLembagaId = clsLemId ? String(clsLemId) : (s.pendidikanFormal || undefined);
    }

    if (targetClass && targetClass.nama) {
      currentClasses.push(targetClass.nama.trim());
    }

    const finalKelasString = Array.from(new Set(currentClasses)).join(', ') || 'Tanpa Kelas';

    const updated: Santri = {
      ...s,
      kelas: finalKelasString,
      pendidikanFormal: finalFormalLembagaId,
    };

    onUpdateSantri(updated);
  };

  const validateCellField = (field: keyof Santri, value: string): string | null => {
    const trimmed = value.trim();

    if (field === 'nama') {
      if (!trimmed) return "Nama Lengkap tidak boleh kosong.";
    }

    if (field === 'nis') {
      if (!trimmed) return "NIS tidak boleh kosong.";
    }

    if (field === 'nik' || field === 'nikAyah' || field === 'nikIbu' || field === 'noKk') {
      if (trimmed !== '') {
        const fieldName = field === 'nik' ? 'NIK Santri' : field === 'nikAyah' ? 'NIK Ayah' : field === 'nikIbu' ? 'NIK Ibu' : 'No KK';
        if (!/^\d{16}$/.test(trimmed)) {
          return `${fieldName} harus 16 digit angka.`;
        }
      }
    }

    if (field === 'nisn') {
      if (trimmed !== '' && !/^\d{10}$/.test(trimmed)) {
        return "NISN harus 10 digit angka.";
      }
    }

    if (field === 'noHp') {
      if (trimmed !== '' && !/^\d{10,15}$/.test(trimmed)) {
        return "No HP/WA harus 10-15 digit angka.";
      }
    }

    if (field === 'rt' || field === 'rw') {
      if (trimmed !== '' && !/^\d{1,4}$/.test(trimmed)) {
        return "RT/RW harus berupa angka (max 4 digit).";
      }
    }

    return null;
  };

  const handleCellDoubleClick = (e: React.MouseEvent, s: Santri, field: keyof Santri) => {
    e.stopPropagation();
    const canWrite = s.gender === 'Putri' ? canWritePutri : canWritePutra;
    if (!canWrite) return;

    setEditingError(null);
    const currentVal = s[field] !== undefined && s[field] !== null ? String(s[field]) : '';
    setEditingCell({
      santriId: s.id,
      field,
      value: currentVal
    });
  };

  const handleSaveInlineEdit = (s: Santri) => {
    if (!editingCell || editingCell.santriId !== s.id) return;
    const field = editingCell.field;
    const rawVal = editingCell.value;

    const errorMsg = validateCellField(field, rawVal);
    if (errorMsg) {
      setEditingError(errorMsg);
      return;
    }

    setEditingError(null);

    let parsedVal: any = rawVal.trim();

    if (['anakKe', 'dariBersaudara', 'jarakRumah'].includes(field as string)) {
      parsedVal = rawVal.trim() === '' ? undefined : Number(rawVal);
    }

    const updated: Santri = {
      ...s,
      [field]: parsedVal
    };

    onUpdateSantri?.(updated);
    setEditingCell(null);
  };

  const renderEditableCell = (
    s: Santri,
    field: keyof Santri,
    displayValue: React.ReactNode,
    options?: {
      type?: 'text' | 'date' | 'number' | 'select';
      selectOptions?: string[];
      className?: string;
    }
  ) => {
    const canWrite = s.gender === 'Putri' ? canWritePutri : canWritePutra;
    const isEditing = editingCell?.santriId === s.id && editingCell?.field === field;

    if (isEditing) {
      const inputType = options?.type || 'text';

      return (
        <div className="relative w-full z-30 edit-container-box" onClick={(e) => e.stopPropagation()}>
          {inputType === 'select' ? (
            <select
              autoFocus
              value={editingCell.value}
              onChange={(e) => {
                setEditingCell({ ...editingCell, value: e.target.value });
                setEditingError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveInlineEdit(s);
                if (e.key === 'Escape') {
                  setEditingCell(null);
                  setEditingError(null);
                }
              }}
              className="w-full rounded-md border border-emerald-500 bg-white px-2 py-1 text-xs font-medium text-slate-800 shadow-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
            >
              {(options?.selectOptions || []).map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          ) : (
            <input
              autoFocus
              type={inputType}
              value={editingCell.value}
              onChange={(e) => {
                setEditingCell({ ...editingCell, value: e.target.value });
                setEditingError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveInlineEdit(s);
                if (e.key === 'Escape') {
                  setEditingCell(null);
                  setEditingError(null);
                }
              }}
              className={`w-full rounded-md border bg-white px-2 py-1 text-xs font-medium text-slate-800 shadow-sm focus:outline-none focus:ring-1 ${
                editingError ? 'border-rose-500 focus:ring-rose-500' : 'border-emerald-500 focus:ring-emerald-500'
              }`}
            />
          )}

          {/* Action buttons on top right horizontal above input box */}
          {editingCell.value.trim() !== ((s[editingCell.field] ?? '') as string).trim() && (
            <div className="absolute -top-8 right-0 z-[110] flex flex-row items-center gap-1 bg-white border border-slate-200 rounded-lg p-1 shadow-lg animate-in fade-in zoom-in-95">
              <button
                type="button"
                onClick={() => handleSaveInlineEdit(s)}
                className="rounded p-1 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 cursor-pointer transition-colors shadow-2xs"
                title="Terapkan Perubahan (Centang)"
              >
                <Check className="h-3.5 w-3.5 stroke-[3]" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingCell(null);
                  setEditingError(null);
                }}
                className="rounded p-1 bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 cursor-pointer transition-colors shadow-2xs"
                title="Batal Perubahan (X)"
              >
                <X className="h-3.5 w-3.5 stroke-[3]" />
              </button>
            </div>
          )}

          {editingError && (
            <div className="absolute left-0 top-full mt-1 z-50 rounded-lg bg-rose-600 px-2 py-1 text-[10px] font-bold text-white shadow-lg whitespace-nowrap animate-in fade-in slide-in-from-top-1">
              {editingError}
            </div>
          )}
        </div>
      );
    }

    return (
      <div
        onDoubleClick={(e) => {
          if (isSelectionMode) return;
          handleCellDoubleClick(e, s, field);
        }}
        title={canWrite && !isSelectionMode ? "Double-click untuk edit cepat" : undefined}
        className={`group/cell relative flex items-center justify-between rounded px-1.5 py-0.5 transition-colors ${
          isSelectionMode
            ? 'pointer-events-none opacity-80'
            : canWrite
              ? 'hover:bg-emerald-50/60 cursor-pointer'
              : ''
        } ${options?.className || ''}`}
      >
        <span className="truncate">{displayValue}</span>
        {canWrite && !isSelectionMode && (
          <Pencil className="h-2.5 w-2.5 text-slate-400 opacity-0 group-hover/cell:opacity-100 transition-opacity shrink-0 ml-1" />
        )}
      </div>
    );
  };
  const [lastSelectedIndex, setLastSelectedIndex] = React.useState<number | null>(null);
  const [lastAction, setLastAction] = React.useState<'select' | 'deselect' | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const [canScrollLeft, setCanScrollLeft] = React.useState(false);
  const [canScrollRight, setCanScrollRight] = React.useState(false);
  const [isScrolled, setIsScrolled] = React.useState(false);
  const [stickyTop, setStickyTop] = React.useState(148);
  const [floatingHeaderStyle, setFloatingHeaderStyle] = React.useState({ left: 0, width: 0 });

  const floatingHeaderRef = React.useRef<HTMLDivElement>(null);
  const floatingHeaderOuterRef = React.useRef<HTMLDivElement>(null);
  const isSyncingScroll = React.useRef(false);
  const scrollSourceRef = React.useRef<'main' | 'floating' | null>(null);
  const scrollTimeoutRef = React.useRef<number | null>(null);

  const updateScrollButtons = () => {
    const container = containerRef.current;
    if (container) {
      const { scrollLeft, scrollWidth, clientWidth } = container;
      // Only enable scroll buttons if the table is actually scrollable horizontally
      const hasHorizontalScroll = scrollWidth > clientWidth + 4;
      setCanScrollLeft(hasHorizontalScroll && scrollLeft > 2);
      setCanScrollRight(hasHorizontalScroll && scrollLeft + clientWidth < scrollWidth - 2);
    }
  };

  const scrollTable = (direction: 'left' | 'right') => {
    const container = containerRef.current;
    if (container) {
      scrollSourceRef.current = 'main';
      const scrollAmount = 300;
      const targetScroll = direction === 'left' 
        ? container.scrollLeft - scrollAmount 
        : container.scrollLeft + scrollAmount;
      
      container.scrollTo({
        left: targetScroll,
        behavior: 'smooth'
      });
    }
  };

  const handleTableScroll = () => {
    updateScrollButtons();
    const container = containerRef.current;
    if (!container) return;

    // Sync scroll to floating header using scrollSourceRef
    if (scrollSourceRef.current !== 'floating') {
      scrollSourceRef.current = 'main';
      if (scrollTimeoutRef.current) {
        window.clearTimeout(scrollTimeoutRef.current);
      }
      scrollTimeoutRef.current = window.setTimeout(() => {
        scrollSourceRef.current = null;
      }, 150);

      if (floatingHeaderRef.current && floatingHeaderRef.current.scrollLeft !== container.scrollLeft) {
        floatingHeaderRef.current.scrollLeft = container.scrollLeft;
      }
    }

    // Calculate sticky threshold below the main header
    const mainHeader = document.querySelector('header');
    const mainHeaderHeight = mainHeader ? (mainHeader as HTMLElement).offsetHeight : 64;
    const computedStickyTop = mainHeaderHeight;

    setStickyTop(computedStickyTop);

    const containerRect = container.getBoundingClientRect();
    // Header floats when the container's top has reached the stickyTop threshold and remains inside the table bounds
    const isHeaderFloating = 
      containerRect.top <= computedStickyTop && 
      containerRect.bottom > (computedStickyTop + 48);
    setIsScrolled(isHeaderFloating);

    setFloatingHeaderStyle({
      left: containerRect.left,
      width: containerRect.width,
    });
  };

  // Recalculate horizontal scroll buttons and scroll stickiness on layout changes
  React.useEffect(() => {
    updateScrollButtons();
    const timer = setTimeout(() => {
      updateScrollButtons();
      handleTableScroll();
    }, 100);

    const handleResize = () => {
      updateScrollButtons();
      handleTableScroll();
    };

    const handleGlobalScroll = () => {
      handleTableScroll();
    };

    window.addEventListener('resize', handleResize, { passive: true });
    document.addEventListener('scroll', handleGlobalScroll, { capture: true, passive: true });

    // Use ResizeObserver for high-precision, instant scroll status updates
    let observer: ResizeObserver | null = null;
    const container = containerRef.current;
    if (container) {
      observer = new ResizeObserver(() => {
        updateScrollButtons();
      });
      observer.observe(container);
      const table = container.querySelector('table');
      if (table) {
        observer.observe(table);
      }
    }
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('scroll', handleGlobalScroll, { capture: true });
      if (observer) {
        observer.disconnect();
      }
    };
  }, [paginatedSantri, visibleColumns, isSelectionMode]);

  const [dragStart, setDragStart] = React.useState<{ pageX: number; pageY: number } | null>(null);
  const [dragBox, setDragBox] = React.useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const mousePosRef = React.useRef<{ clientX: number; clientY: number } | null>(null);
  const initialSelectedIdsRef = React.useRef<string[]>([]);

  const lastSelectedIndexRef = React.useRef(lastSelectedIndex);
  const lastActionRef = React.useRef(lastAction);
  const paginatedSantriRef = React.useRef(paginatedSantri);
  const selectedSantriIdsRef = React.useRef(selectedSantriIds);
  const draggedRef = React.useRef<boolean>(false);
  const clickedIdRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    lastSelectedIndexRef.current = lastSelectedIndex;
  }, [lastSelectedIndex]);

  React.useEffect(() => {
    lastActionRef.current = lastAction;
  }, [lastAction]);

  React.useEffect(() => {
    paginatedSantriRef.current = paginatedSantri;
  }, [paginatedSantri]);

  React.useEffect(() => {
    selectedSantriIdsRef.current = selectedSantriIds;
  }, [selectedSantriIds]);

  const toggleSingleSelection = (id: string, shiftKey: boolean) => {
    const paginated = paginatedSantriRef.current;
    const lastIdx = lastSelectedIndexRef.current;
    const lastAct = lastActionRef.current;
    const prevSelected = selectedSantriIdsRef.current;

    const index = paginated.findIndex(x => x.id === id);
    if (index === -1) return;

    const s = paginated[index];
    const isSelected = prevSelected.includes(s.id);

    if (shiftKey && lastIdx !== null && lastAct !== null) {
      const start = Math.min(lastIdx, index);
      const end = Math.max(lastIdx, index);
      const rangeIds = paginated.slice(start, end + 1).map(x => x.id);

      if (lastAct === 'select') {
        const unionSet = new Set([...prevSelected, ...rangeIds]);
        setSelectedSantriIds(Array.from(unionSet));
      } else { // 'deselect'
        setSelectedSantriIds(prevSelected.filter(x => !rangeIds.includes(x)));
      }
    } else {
      if (isSelected) {
        setLastSelectedIndex(index);
        setLastAction('deselect');
        setSelectedSantriIds(prevSelected.filter(x => x !== s.id));
      } else {
        setLastSelectedIndex(index);
        setLastAction('select');
        setSelectedSantriIds([...prevSelected, s.id]);
      }
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isSelectionMode) return;
    if (e.button !== 0) return; // Left click only

    const target = e.target as HTMLElement;
    if (
      target.closest('thead') // Ignore clicks starting on the table header
    ) {
      return;
    }

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    initialSelectedIdsRef.current = selectedSantriIds;
    draggedRef.current = false;

    // Find closest row to determine clicked target
    const rowEl = target.closest('[data-drag-id]');
    clickedIdRef.current = rowEl?.getAttribute('data-drag-id') || null;

    setDragStart({ pageX: e.clientX + window.scrollX, pageY: e.clientY + window.scrollY });
    setDragBox(null);
    e.preventDefault();
  };

  React.useEffect(() => {
    if (!dragStart) {
      mousePosRef.current = null;
      return;
    }

    mousePosRef.current = { clientX: dragStart.pageX - window.scrollX, clientY: dragStart.pageY - window.scrollY };
    let animationFrameId: number;

    const updateSelection = () => {
      const container = containerRef.current;
      const mousePos = mousePosRef.current;
      if (!container || !mousePos) return;

      const containerRect = container.getBoundingClientRect();

      // Page-absolute box coordinates
      const currentPageX = mousePos.clientX + window.scrollX;
      const currentPageY = mousePos.clientY + window.scrollY;

      const dist = Math.sqrt(
        Math.pow(currentPageX - dragStart.pageX, 2) + 
        Math.pow(currentPageY - dragStart.pageY, 2)
      );

      if (dist <= 4 && !draggedRef.current) {
        setDragBox(null);
        return;
      }

      draggedRef.current = true;

      const pageLeft = Math.min(dragStart.pageX, currentPageX);
      const pageTop = Math.min(dragStart.pageY, currentPageY);
      const pageWidth = Math.abs(dragStart.pageX - currentPageX);
      const pageHeight = Math.abs(dragStart.pageY - currentPageY);
      const pageRight = pageLeft + pageWidth;
      const pageBottom = pageTop + pageHeight;

      // Convert page-absolute coordinates to container-relative coordinates for rendering the absolute dragBox
      const containerPageLeft = containerRect.left + window.scrollX;
      const containerPageTop = containerRect.top + window.scrollY;

      const left = pageLeft - containerPageLeft + container.scrollLeft;
      const top = pageTop - containerPageTop + container.scrollTop;

      setDragBox({ left, top, width: pageWidth, height: pageHeight });

      const itemElements = container.querySelectorAll('[data-drag-id]');
      const intersectedIds: string[] = [];

      itemElements.forEach((el) => {
        const elRect = el.getBoundingClientRect();
        const id = el.getAttribute('data-drag-id');
        if (!id) return;

        const elPageLeft = elRect.left + window.scrollX;
        const elPageRight = elRect.right + window.scrollX;
        const elPageTop = elRect.top + window.scrollY;
        const elPageBottom = elRect.bottom + window.scrollY;

        const isOverlapping = !(
          elPageRight < pageLeft ||
          elPageLeft > pageRight ||
          elPageBottom < pageTop ||
          elPageTop > pageBottom
        );

        if (isOverlapping) {
          intersectedIds.push(id);
        }
      });

      const unionSet = new Set([...initialSelectedIdsRef.current, ...intersectedIds]);
      setSelectedSantriIds(Array.from(unionSet));
    };

    const scrollAndLoop = () => {
      const mousePos = mousePosRef.current;
      if (!mousePos) return;

      const viewportHeight = window.innerHeight;
      const { clientY } = mousePos;
      const scrollThreshold = 60; // distance from top/bottom edge to start scrolling
      const maxScrollSpeed = 15; // max scroll increment in pixels

      let scrolled = false;

      if (clientY > viewportHeight - scrollThreshold) {
        const ratio = (clientY - (viewportHeight - scrollThreshold)) / scrollThreshold;
        const speed = Math.max(1, Math.min(maxScrollSpeed, ratio * maxScrollSpeed));
        window.scrollBy(0, speed);
        scrolled = true;
      } else if (clientY < scrollThreshold) {
        const ratio = (scrollThreshold - clientY) / scrollThreshold;
        const speed = Math.max(1, Math.min(maxScrollSpeed, ratio * maxScrollSpeed));
        window.scrollBy(0, -speed);
        scrolled = true;
      }

      updateSelection();
      animationFrameId = requestAnimationFrame(scrollAndLoop);
    };

    animationFrameId = requestAnimationFrame(scrollAndLoop);

    const handleMouseMove = (e: MouseEvent) => {
      mousePosRef.current = { clientX: e.clientX, clientY: e.clientY };
      updateSelection();
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (!draggedRef.current && clickedIdRef.current) {
        toggleSingleSelection(clickedIdRef.current, e.shiftKey);
      }
      setDragStart(null);
      setDragBox(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragStart, setSelectedSantriIds]);

  const handleRowClick = (e: React.MouseEvent, index: number, s: Santri) => {
    if (!isSelectionMode) return;
    toggleSingleSelection(s.id, e.shiftKey);
  };

  const getAgeHeaderSubtext = (config?: AgeFilterConfig) => {
    if (!config) return '(Hari ini)';
    if (config.refType === 'custom' && config.customDate) {
      const d = new Date(config.customDate);
      if (!isNaN(d.getTime())) {
        const formatted = d.toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        });
        return `(Per ${formatted})`;
      }
    }
    return '(Hari ini)';
  };

  const scrolledHeaderClass = 'bg-slate-50 text-slate-400 border-b border-slate-100';

  const renderSortHeader = (key: string, label: string, isSticky: boolean = false, widthClass: string = '', subtext?: string) => {
    const isSorted = sortKey === key;
    const stickyLeftClass = key === 'nama'
      ? (isSelectionMode ? 'sm:left-[112px] left-[112px]' : 'sm:left-[64px] left-[64px]')
      : '';
    return (
      <th 
        onClick={() => {
          if (sortKey === key) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
          } else {
            setSortKey(key);
            setSortDirection('asc');
          }
        }}
        className={`px-4 py-3 cursor-pointer transition-all select-none font-display text-xs font-bold uppercase tracking-wider sticky top-0 ${scrolledHeaderClass} ${
          isSticky 
            ? `${stickyLeftClass} z-30 sm:shadow-[2px_0_5px_rgba(0,0,0,0.05)] md:w-[272px] w-[200px] md:min-w-[272px] min-w-[200px] md:max-w-[272px] max-w-[200px] border-r` 
            : `hover:bg-slate-100/80 z-20 ${widthClass || 'w-44 min-w-[176px]'}`
          }`}
      >
        <div className="flex flex-col items-start justify-center">
          <div className="flex items-center gap-1.5 justify-start relative">
            <span className="text-slate-400">{label}</span>
            {isSorted ? (
              sortDirection === 'asc' ? (
                <ArrowUp className="h-3 w-3 text-emerald-700 font-bold shrink-0" />
              ) : (
                <ArrowDown className="h-3 w-3 text-emerald-700 font-bold shrink-0" />
              )
            ) : (
              <ArrowUpDown className="h-3 w-3 text-slate-300 hover:text-slate-500 shrink-0" />
            )}
          </div>
          {subtext && (
            <span className="text-[10px] font-bold text-emerald-600 normal-case tracking-tight leading-tight mt-0.5">
              {subtext}
            </span>
          )}
        </div>

        {/* Scroll Left Button placed exactly in the middle of the right side of 'nama' header column */}
        {key === 'nama' && canScrollLeft && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              scrollTable('left');
            }}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-[40] flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-md transition-all duration-200 hover:bg-slate-50 hover:scale-105 active:scale-95 cursor-pointer opacity-100"
            title="Gulir Kiri"
          >
            <ChevronLeft className="h-4 w-4 stroke-[2.5] -translate-x-[0.5px]" />
          </button>
        )}
      </th>
    );
  };

  const renderTableHeadContents = (headerClass: string) => (
    <tr>
      {isSelectionMode && (
        <th className={`px-3 py-4 text-center sticky top-0 left-0 z-35 border-r border-slate-100 w-12 min-w-[48px] transition-all duration-300 ${headerClass}`}>
          <div className="flex items-center justify-center">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
              checked={paginatedSantri.length > 0 && paginatedSantri.every(s => selectedSantriIds.includes(s.id))}
              onChange={(e) => {
                if (e.target.checked) {
                  const newIds = [...selectedSantriIds];
                  paginatedSantri.forEach(s => {
                     if (!newIds.includes(s.id)) {
                       newIds.push(s.id);
                     }
                  });
                  setSelectedSantriIds(newIds);
                } else {
                  const paginatedIds = paginatedSantri.map(s => s.id);
                  setSelectedSantriIds(selectedSantriIds.filter(id => !paginatedIds.includes(id)));
                }
              }}
            />
          </div>
        </th>
      )}
      {/* Nomor Column (Sticky Left) */}
      <th className={`px-2 py-4 sticky top-0 ${isSelectionMode ? 'sm:left-[48px] left-[48px]' : 'sm:left-0 left-0'} z-35 w-16 min-w-[64px] font-display text-xs font-bold uppercase tracking-wider border-r border-slate-100 text-center transition-all duration-300 ${headerClass}`}>
        No.
      </th>
      {/* Selalu Terlihat: Nama (berisi foto juga), NIS, NISN, NIK, Kelas Formal */}
      {renderSortHeader('nama', 'Nama Lengkap', true)}
      {renderSortHeader('nis', 'NIS', false, 'w-[95px] min-w-[95px]')}
      {renderSortHeader('nisn', 'NISN', false, 'w-[110px] min-w-[110px]')}
      {renderSortHeader('nik', 'NIK', false, 'w-[155px] min-w-[155px]')}
      {renderSortHeader('kelasFormal', 'Kelas Formal', false, 'w-[140px] min-w-[140px]')}
      
      {/* Kolom Umur jika Filter Umur Aktif */}
      {ageFilterConfig?.enabled && renderSortHeader('umur', 'Umur', false, 'w-[125px] min-w-[125px]', getAgeHeaderSubtext(ageFilterConfig))}

      {/* Toggable */}
      {visibleColumns.nism && renderSortHeader('nism', 'NISM', false, 'w-[110px] min-w-[110px]')}
      {visibleColumns.noKk && renderSortHeader('noKk', 'No. KK', false, 'w-[155px] min-w-[155px]')}
      {visibleColumns.tempatLahir && renderSortHeader('tempatLahir', 'Tempat Lahir', false, 'w-[125px] min-w-[125px]')}
      {visibleColumns.tanggalLahir && renderSortHeader('tanggalLahir', 'Tanggal Lahir', false, 'w-[115px] min-w-[115px]')}
      {visibleColumns.gender && renderSortHeader('gender', 'Gender', false, 'w-[90px] min-w-[90px]')}
      {visibleColumns.pendidikanTerakhir && renderSortHeader('pendidikanTerakhir', 'Pendidikan Terakhir', false, 'w-[160px] min-w-[160px]')}
      {visibleColumns.anakKe && renderSortHeader('anakKe', 'Anak Ke', false, 'w-[85px] min-w-[85px]')}
      {visibleColumns.dariBersaudara && renderSortHeader('dariBersaudara', 'Jumlah Saudara', false, 'w-[120px] min-w-[120px]')}
      {visibleColumns.namaAyah && renderSortHeader('namaAyah', 'Nama Ayah', false, 'w-[150px] min-w-[150px]')}
      {visibleColumns.nikAyah && renderSortHeader('nikAyah', 'NIK Ayah', false, 'w-[155px] min-w-[155px]')}
      {visibleColumns.pekerjaanAyah && renderSortHeader('pekerjaanAyah', 'Pekerjaan Ayah', false, 'w-[140px] min-w-[140px]')}
      {visibleColumns.pendidikanAyah && renderSortHeader('pendidikanAyah', 'Pendidikan Ayah', false, 'w-[130px] min-w-[130px]')}
      {visibleColumns.namaIbu && renderSortHeader('namaIbu', 'Nama Ibu', false, 'w-[150px] min-w-[150px]')}
      {visibleColumns.nikIbu && renderSortHeader('nikIbu', 'NIK Ibu', false, 'w-[155px] min-w-[155px]')}
      {visibleColumns.pekerjaanIbu && renderSortHeader('pekerjaanIbu', 'Pekerjaan Ibu', false, 'w-[140px] min-w-[140px]')}
      {visibleColumns.pendidikanIbu && renderSortHeader('pendidikanIbu', 'Pendidikan Ibu', false, 'w-[130px] min-w-[130px]')}
      {visibleColumns.alamat && renderSortHeader('alamat', 'Alamat', false, 'w-[180px] min-w-[180px]')}
      {visibleColumns.rt && renderSortHeader('rt', 'RT', false, 'w-[65px] min-w-[65px]')}
      {visibleColumns.rw && renderSortHeader('rw', 'RW', false, 'w-[65px] min-w-[65px]')}
      {visibleColumns.desa && renderSortHeader('desa', 'Desa / Kelurahan', false, 'w-[140px] min-w-[140px]')}
      {visibleColumns.kecamatan && renderSortHeader('kecamatan', 'Kecamatan', false, 'w-[140px] min-w-[140px]')}
      {visibleColumns.kabupaten && renderSortHeader('kabupaten', 'Kabupaten / Kota', false, 'w-[150px] min-w-[150px]')}
      {visibleColumns.provinsi && renderSortHeader('provinsi', 'Provinsi', false, 'w-[150px] min-w-[150px]')}
      {visibleColumns.jarakRumah && renderSortHeader('jarakRumah', 'Jarak (km)', false, 'w-[100px] min-w-[100px]')}
      {visibleColumns.noHp && renderSortHeader('noHp', 'No. HP Wali', false, 'w-[130px] min-w-[130px]')}
      {visibleColumns.statusDomisili && renderSortHeader('statusDomisili', 'Status Domisili', false, 'w-[130px] min-w-[130px]')}
      {visibleColumns.tanggalMasuk && renderSortHeader('tanggalMasuk', 'Tgl Masuk', false, 'w-[105px] min-w-[105px]')}
      {visibleColumns.tanggalKeluar && renderSortHeader('tanggalKeluar', 'Tgl Keluar', false, 'w-[105px] min-w-[105px]')}
      {visibleColumns.catatan && renderSortHeader('catatan', 'Catatan', false, 'w-[180px] min-w-[180px]')}
      
      {/* Selalu Terlihat: Status & Emis */}
      {renderSortHeader('statusKeanggotaan', 'Status', false, 'w-[105px] min-w-[105px]')}
      {renderSortHeader('statusEmis', 'Emis', false, 'w-[95px] min-w-[95px]')}
      
      <th className={`px-2 py-4 text-center font-display text-xs font-bold uppercase tracking-wider sticky top-0 right-0 z-35 shadow-[-2px_0_5px_rgba(0,0,0,0.05)] border-l w-12 min-w-[48px] transition-all duration-300 ${isSelectionMode ? 'hidden md:table-cell' : 'table-cell'} ${headerClass}`}>Aksi</th>
    </tr>
  );

  const renderScrollButtons = (isFloating: boolean) => {
    if (!canScrollRight) return null;
    return (
      <>
        {/* Scroll Right Button placed exactly in the middle of the right side/edge line of the header */}
        <button
          id={isFloating ? "table-scroll-right-btn-floating" : "table-scroll-right-btn"}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            scrollTable('right');
          }}
          className={`absolute right-0 ${
            isFloating ? 'top-1/2 -translate-y-1/2' : 'top-[26px] -translate-y-1/2'
          } translate-x-1/2 z-[48] flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-md transition-all duration-200 hover:bg-slate-50 hover:scale-105 active:scale-95 cursor-pointer opacity-100`}
          title="Gulir Kanan"
        >
          <ChevronRight className="h-4 w-4 stroke-[2.5] translate-x-[0.5px]" />
        </button>
      </>
    );
  };

  return (
    <div className="relative group/table">
      {/* Scroll Navigation Buttons for Main Table Header */}
      {renderScrollButtons(false)}

      <div 
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onScroll={handleTableScroll}
        className="relative overflow-x-auto overflow-y-visible rounded-2xl border border-slate-100 bg-white shadow-sm scrollbar-thin select-none"
      >
      {dragBox && (
        <div
          className="absolute border border-[#00b0f0] bg-[#00b0f0]/15 pointer-events-none z-[15] rounded"
          style={{
            left: dragBox.left,
            top: dragBox.top,
            width: dragBox.width,
            height: dragBox.height,
          }}
        />
      )}
      <table className="w-max min-w-full border-separate border-spacing-0 text-left text-sm text-slate-600 table-sticky-leakproof">
        <thead className="text-xs font-semibold uppercase tracking-wider sticky top-0 z-35">
          {renderTableHeadContents(scrolledHeaderClass)}
        </thead>
        <tbody className="divide-y divide-slate-100">
          {paginatedSantri.map((s, idx) => {
            const isLastFew = paginatedSantri.length > 3 && idx >= paginatedSantri.length - 2;
            const isSelected = selectedSantriIds.includes(s.id);
            const canWriteForSantri = s.gender === 'Putra' ? canWritePutra : canWritePutri;
            return (
              <tr 
                key={`${s.id}-${idx}`} 
                data-drag-id={s.id}
                onClick={(e) => handleRowClick(e, idx, s)}
                className={`transition-colors group ${
                  isSelectionMode ? 'cursor-pointer font-semibold' : ''
                } ${
                  isSelectionMode && isSelected
                    ? 'bg-emerald-50/60 hover:bg-emerald-100/60'
                    : 'hover:bg-slate-50/50'
                }`}
              >
                 {isSelectionMode && (
                  <td 
                    className={`px-3 py-4 text-center sticky left-0 transition-colors z-10 border-r border-slate-100 w-12 min-w-[48px] max-w-[48px] ${
                      isSelected ? 'bg-emerald-50' : 'bg-white group-hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-center">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer pointer-events-none"
                        checked={isSelected}
                        readOnly
                      />
                    </div>
                  </td>
                )}
                {/* Nomor Column (Sticky Left) */}
                <td className={`px-2 py-4 static sm:sticky ${isSelectionMode ? 'sm:left-[48px] left-[48px]' : 'sm:left-0 left-0'} transition-colors z-10 border-r border-slate-100 w-16 min-w-[64px] max-w-[64px] text-center font-mono text-xs font-semibold ${
                  isSelectionMode && isSelected
                    ? 'bg-emerald-50 text-emerald-800 font-bold'
                    : 'bg-white text-slate-500 group-hover:bg-slate-50'
                }`}>
                  <div className="flex items-center justify-center gap-2">
                    {isMonitoringWajibComplete(s) ? (
                      <div 
                        className="inline-flex h-4.5 w-4.5 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 shrink-0 shadow-xs"
                        title="Semua Data Wajib Monitoring Lengkap"
                      >
                        <Check className="h-2.5 w-2.5 stroke-[3.5]" />
                      </div>
                    ) : (
                      <div 
                        className="inline-flex h-4.5 w-4.5 items-center justify-center rounded-full bg-rose-50 text-rose-600 border border-rose-200 shrink-0 shadow-xs"
                        title="Ada Data Wajib Monitoring Belum Lengkap"
                      >
                        <X className="h-2.5 w-2.5 stroke-[3.5]" />
                      </div>
                    )}
                    <span>{startIndex + idx + 1}</span>
                  </div>
                </td>
                {/* Name sticky column (Nama Lengkap) - Sticky on Desktop only */}
                <td className={`px-4 py-4 font-medium static sm:sticky ${isSelectionMode ? 'sm:left-[112px] left-[112px]' : 'sm:left-[64px] left-[64px]'} transition-colors z-10 sm:shadow-[2px_0_5px_rgba(0,0,0,0.02)] border-r border-slate-100 md:w-[272px] w-[200px] md:min-w-[272px] min-w-[200px] md:max-w-[272px] max-w-[200px] ${
                  isSelectionMode && isSelected
                    ? 'bg-emerald-50 text-slate-900'
                    : 'bg-white text-slate-900 group-hover:bg-slate-50'
                }`}>
                  <div className="flex items-center gap-2">
                    {renderSantriAvatar(s, "h-8 w-8 shrink-0 rounded-full border border-slate-100 shadow-xs")}
                    <div className="flex-1 min-w-0">
                      {renderEditableCell(s, 'nama', s.nama, { className: 'font-display text-xs font-bold text-slate-900' })}
                    </div>
                  </div>
                </td>
                
                {/* NIS */}
                <td className="px-3 py-4 whitespace-nowrap text-xs font-semibold text-slate-700 w-[110px] min-w-[110px]">
                  {renderEditableCell(s, 'nis', s.nis, { className: 'font-mono' })}
                </td>

                {/* Selalu Terlihat: NISN & NIK */}
                <td className="px-3 py-4 whitespace-nowrap text-xs text-slate-500 w-[120px] min-w-[120px]">
                  {renderEditableCell(s, 'nisn', s.nisn || '-', { className: 'font-mono' })}
                </td>
                <td className="px-3 py-4 whitespace-nowrap text-xs text-slate-500 w-[160px] min-w-[160px]">
                  {renderEditableCell(s, 'nik', s.nik || '-', { className: 'font-mono' })}
                </td>

                {/* Selalu Terlihat: Kelas Formal */}
                <td className={`px-3 py-4 whitespace-nowrap text-xs w-[160px] min-w-[160px] ${activeFormalKelasDropdownId === s.id ? 'relative z-30' : ''}`}>
                  {(() => {
                    const formalClass = getFormalKelasDisplay(s);
                    const isTidakMengikuti = formalClass === 'Tidak Mengikuti';
                    const canWrite = s.gender === 'Putri' ? canWritePutri : canWritePutra;
                    const isEmisTerdaftar = s.statusEmis === 'Terdaftar';

                    const getLembagaJenis = (l: Lembaga): 'Formal' | 'Internal' => {
                      if (l.jenis) return l.jenis;
                      const lower = (l.nama || '').toLowerCase();
                      if (
                        lower.includes('madin') || lower.includes('diniyah') || lower.includes('tpq') ||
                        lower.includes('tahfidz') || lower.includes('pondok') || lower.includes('kitab') ||
                        lower.includes('internal') || (l.kode && l.kode.toLowerCase().includes('madin'))
                      ) {
                        return 'Internal';
                      }
                      return 'Formal';
                    };

                    const checkLembagaGenderMatch = (l: Lembaga, santriGender?: string | null): boolean => {
                      if (!santriGender) return true;
                      const sG = santriGender.trim();
                      if (l.gender) {
                        return isGenderMatch(l.gender, sG);
                      }
                      const nameLower = (l.nama || '').toLowerCase();
                      if (sG === 'Putra' && nameLower.includes('putri') && !nameLower.includes('putra')) {
                        return false;
                      }
                      if (sG === 'Putri' && nameLower.includes('putra') && !nameLower.includes('putri')) {
                        return false;
                      }
                      return true;
                    };

                    const santriGender = s.gender === 'Putri' ? 'Putri' : 'Putra';
                    let formalLembagas = lembagasList.filter(l => 
                      getLembagaJenis(l) === 'Formal' && checkLembagaGenderMatch(l, santriGender)
                    );
                    if (formalLembagas.length === 0) {
                      formalLembagas = lembagasList.filter(l => getLembagaJenis(l) === 'Formal');
                    }

                    return (
                      <div className="relative inline-block text-left">
                        <button
                          type="button"
                          onClick={(e) => {
                            if (isSelectionMode) return;
                            e.stopPropagation();
                            if (!canWrite) return;

                            try {
                              const lStr = localStorage.getItem('smartsantri_lembagas');
                              const kStr = localStorage.getItem('smartsantri_kelas');
                              if (lStr) setLembagasList(JSON.parse(lStr));
                              if (kStr) setKelasList(JSON.parse(kStr));

                              fetchTableData<Lembaga>('lembaga', 'smartsantri_lembagas', [])
                                .then(data => { if (data && data.length > 0) setLembagasList(data); })
                                .catch(() => {});
                              fetchTableData<Kelas>('kelas', 'smartsantri_kelas', [])
                                .then(data => { if (data && data.length > 0) setKelasList(data); })
                                .catch(() => {});
                            } catch {}

                            setActiveFormalKelasDropdownId(prev => prev === s.id ? null : s.id);
                            setActiveEmisDropdownId(null);
                            setActiveStatusKeanggotaanDropdownId(null);
                            setActiveDomisiliDropdownId(null);
                          }}
                          disabled={!canWrite || isSelectionMode}
                          className={`dropdown-trigger-btn inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold border transition-all ${
                            isSelectionMode
                              ? 'bg-slate-100/70 text-slate-400 border-slate-200/50 shadow-none pointer-events-none filter grayscale opacity-60'
                              : isTidakMengikuti
                                ? 'bg-amber-50/90 text-amber-800 border-amber-200/80 italic hover:bg-amber-100'
                                : 'bg-slate-100/90 text-slate-800 border-slate-200/90 hover:bg-slate-200/80'
                          } ${canWrite && !isSelectionMode ? 'cursor-pointer shadow-2xs' : 'cursor-default'}`}
                          title={canWrite && !isSelectionMode ? "Klik untuk memilih / mengubah Kelas Formal" : undefined}
                        >
                          <span>{formalClass}</span>
                          {canWrite && !isSelectionMode && <ChevronsUpDown className="h-3 w-3 opacity-60 shrink-0 text-slate-500" />}
                        </button>

                        {activeFormalKelasDropdownId === s.id && (() => {
                          const pendingFormal = pendingFormalKelas[s.id];
                          
                          // Determine current selected Lembaga and Kelas
                          let currentSelectedLem: Lembaga | null = null;
                          let currentSelectedCls: Kelas | null = null;

                          if (pendingFormal !== undefined) {
                            currentSelectedLem = pendingFormal.lem;
                            currentSelectedCls = pendingFormal.cls;
                          } else if (isTidakMengikuti) {
                            currentSelectedLem = null;
                            currentSelectedCls = null;
                          } else if (s.pendidikanFormal) {
                            currentSelectedLem = formalLembagas.find(l => String(l.id) === String(s.pendidikanFormal)) || formalLembagas[0] || null;
                            if (currentSelectedLem) {
                              currentSelectedCls = kelasList.find(
                                k => String(k.lembagaId || (k as any).lembaga_id) === String(currentSelectedLem?.id) &&
                                formalClass.trim().toLowerCase() === k.nama.trim().toLowerCase()
                              ) || null;
                              if (!currentSelectedCls) {
                                currentSelectedCls = {
                                  id: `calon-${currentSelectedLem.id}`,
                                  nama: 'Calon Peserta Didik',
                                  lembagaId: currentSelectedLem.id
                                } as any;
                              }
                            }
                          } else {
                            currentSelectedLem = formalLembagas[0] || null;
                            if (currentSelectedLem) {
                              currentSelectedCls = {
                                id: `calon-${currentSelectedLem.id}`,
                                nama: 'Calon Peserta Didik',
                                lembagaId: currentSelectedLem.id
                              } as any;
                            }
                          }

                          const hasChangedFormal = pendingFormal !== undefined && (
                            (pendingFormal.cls === null && !isTidakMengikuti) ||
                            (pendingFormal.cls !== null && (
                              isTidakMengikuti ||
                              String(pendingFormal.lem?.id || '') !== String(s.pendidikanFormal || '') ||
                              formalClass.trim().toLowerCase() !== (pendingFormal.cls.nama || '').trim().toLowerCase()
                            ))
                          );

                          return (
                            <div 
                              onClick={(e) => e.stopPropagation()}
                              className="dropdown-container-box absolute left-0 mt-1.5 z-[100] w-[310px] bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden text-xs font-medium text-slate-700 animate-in fade-in slide-in-from-top-1"
                            >
                              {/* Header & Save/Cancel Actions */}
                              <div className="bg-slate-50 px-3 py-2.5 border-b border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-1.5 font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                                  <School className="h-3.5 w-3.5 text-emerald-600" />
                                  <span>Lembaga & Kelas Formal</span>
                                </div>
                                {hasChangedFormal && (
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const pending = pendingFormalKelas[s.id];
                                        if (pending) {
                                          handleUpdateFormalClass(s, pending.lem, pending.cls);
                                        }
                                        setActiveFormalKelasDropdownId(null);
                                        setPendingFormalKelas(prev => {
                                          const copy = { ...prev };
                                          delete copy[s.id];
                                          return copy;
                                        });
                                      }}
                                      className="rounded p-1 bg-emerald-500 text-white hover:bg-emerald-600 cursor-pointer transition-colors shadow-xs"
                                      title="Terapkan Perubahan (Centang)"
                                    >
                                      <Check className="h-3.5 w-3.5 stroke-[3]" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveFormalKelasDropdownId(null);
                                        setPendingFormalKelas(prev => {
                                          const copy = { ...prev };
                                          delete copy[s.id];
                                          return copy;
                                        });
                                      }}
                                      className="rounded p-1 bg-slate-200 text-slate-600 hover:bg-slate-300 cursor-pointer transition-colors shadow-xs"
                                      title="Batal Perubahan (X)"
                                    >
                                      <X className="h-3.5 w-3.5 stroke-[3]" />
                                    </button>
                                  </div>
                                )}
                              </div>

                              {/* 2 Stacked Rectangles Body (Atas & Bawah) */}
                              <div className="p-3 space-y-3 bg-white">
                                
                                {/* Persegi Panjang Atas: Dropdown Lembaga */}
                                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-2.5 space-y-1.5 shadow-2xs">
                                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                                    <span>Lembaga Formal</span>
                                  </div>
                                  
                                  <select
                                    value={currentSelectedLem === null ? 'tidak_mengikuti' : String(currentSelectedLem.id)}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      if (val === 'tidak_mengikuti') {
                                        setPendingFormalKelas(prev => ({
                                          ...prev,
                                          [s.id]: { lem: null, cls: null }
                                        }));
                                      } else {
                                        const newLem = formalLembagas.find(l => String(l.id) === val) || lembagasList.find(l => String(l.id) === val) || null;
                                        if (newLem) {
                                          const classesInLem = kelasList.filter(
                                            k => String(k.lembagaId || (k as any).lembaga_id) === String(newLem.id)
                                          );
                                          const calonCls = classesInLem.find(k => k.nama.toLowerCase().includes('calon')) || {
                                            id: `calon-${newLem.id}`,
                                            nama: 'Calon Peserta Didik',
                                            lembagaId: newLem.id
                                          };
                                          setPendingFormalKelas(prev => ({
                                            ...prev,
                                            [s.id]: { lem: newLem, cls: calonCls as any }
                                          }));
                                        }
                                      }
                                    }}
                                    className="w-full rounded-lg bg-white border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                                  >
                                    <option value="tidak_mengikuti">🚫 Tidak Mengikuti</option>
                                    {formalLembagas.map((lem) => (
                                      <option key={lem.id} value={String(lem.id)}>
                                        🏫 {lem.nama} {lem.kode ? `(${lem.kode})` : ''}
                                      </option>
                                    ))}
                                    {currentSelectedLem && !formalLembagas.some(fl => String(fl.id) === String(currentSelectedLem?.id)) && (
                                      <option value={String(currentSelectedLem.id)}>
                                        🏫 {currentSelectedLem.nama} {currentSelectedLem.kode ? `(${currentSelectedLem.kode})` : ''}
                                      </option>
                                    )}
                                  </select>
                                </div>

                                {/* Persegi Panjang Bawah: Dropdown Kelas */}
                                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-2.5 space-y-1.5 shadow-2xs">
                                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                                    <div className="flex items-center gap-1">
                                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                                      <span>Kelas Formal</span>
                                    </div>
                                    {currentSelectedLem && (
                                      <span className="text-[10px] text-emerald-700 font-bold">{currentSelectedLem.kode || currentSelectedLem.nama}</span>
                                    )}
                                  </div>

                                  {currentSelectedLem === null ? (
                                    <select disabled className="w-full rounded-lg bg-slate-100 border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-400 cursor-not-allowed">
                                      <option>Tidak Mengikuti Kelas</option>
                                    </select>
                                  ) : (() => {
                                    const classesInLem = kelasList.filter(
                                      k => String(k.lembagaId || (k as any).lembaga_id) === String(currentSelectedLem.id)
                                    );
                                    const calonObj = classesInLem.find(k => k.nama.toLowerCase().includes('calon')) || {
                                      id: `calon-${currentSelectedLem.id}`,
                                      nama: 'Calon Peserta Didik',
                                      lembagaId: currentSelectedLem.id
                                    };
                                    const regularClasses = classesInLem.filter(k => !k.nama.toLowerCase().includes('calon'));

                                    // Selected value key
                                    let selectedValKey = `calon-${currentSelectedLem.id}`;
                                    if (currentSelectedCls && !currentSelectedCls.nama.toLowerCase().includes('calon')) {
                                      selectedValKey = String(currentSelectedCls.id);
                                    }

                                    return (
                                      <select
                                        value={selectedValKey}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          if (val.startsWith('calon')) {
                                            setPendingFormalKelas(prev => ({
                                              ...prev,
                                              [s.id]: { lem: currentSelectedLem, cls: calonObj as any }
                                            }));
                                          } else {
                                            if (!isEmisTerdaftar) return;
                                            const selectedRegCls = regularClasses.find(k => String(k.id) === val);
                                            if (selectedRegCls) {
                                              setPendingFormalKelas(prev => ({
                                                ...prev,
                                                [s.id]: { lem: currentSelectedLem, cls: selectedRegCls }
                                              }));
                                            }
                                          }
                                        }}
                                        className="w-full rounded-lg bg-white border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                                      >
                                        <option value={`calon-${currentSelectedLem.id}`}>
                                          ✨ Calon Peserta Didik (Default)
                                        </option>
                                        {regularClasses.map((cls) => {
                                          const isDisabled = !isEmisTerdaftar;
                                          return (
                                            <option 
                                              key={cls.id} 
                                              value={String(cls.id)} 
                                              disabled={isDisabled}
                                            >
                                              {isDisabled ? `🔒 ${cls.nama} (Butuh EMIS Terdaftar)` : `📚 ${cls.nama}`}
                                            </option>
                                          );
                                        })}
                                      </select>
                                    );
                                  })()}
                                </div>

                                {/* Informative EMIS Warning Box */}
                                {currentSelectedLem !== null && !isEmisTerdaftar && (
                                  <div className="p-2 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-900 text-[10.5px] leading-tight font-medium flex items-start gap-1.5 shadow-2xs">
                                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                                    <div>
                                      <span className="font-bold block text-amber-950">Status EMIS: {s.statusEmis || 'Belum Terdaftar'}</span>
                                      <span className="text-amber-800 text-[10px]">
                                        Hanya bisa memilih kelas <strong>Calon Peserta Didik</strong>. Daftarkan EMIS untuk memilih kelas reguler.
                                      </span>
                                    </div>
                                  </div>
                                )}

                              </div>
                            </div>
                          );
                        })()}
                    </div>
                  );
                })()}
                </td>

                {/* Kolom Umur jika Filter Umur Aktif */}
                {ageFilterConfig?.enabled && (
                  <td className="px-3 py-4 whitespace-nowrap text-xs font-bold font-mono text-emerald-800 bg-emerald-50/40 w-[125px] min-w-[125px]">
                    {(() => {
                      const refDate = ageFilterConfig.refType === 'custom' && ageFilterConfig.customDate
                        ? new Date(ageFilterConfig.customDate)
                        : new Date();
                      const age = calculateAgeOnDate(s.tanggalLahir, refDate);
                      return age !== null ? `${age} Tahun` : '-';
                    })()}
                  </td>
                )}

                {/* Toggable */}
                {visibleColumns.nism && (
                  <td className="px-3 py-4 whitespace-nowrap text-xs text-slate-500 w-[120px] min-w-[120px]">
                    {renderEditableCell(s, 'nism', s.nism || '-', { className: 'font-mono' })}
                  </td>
                )}
                {visibleColumns.noKk && (
                  <td className="px-3 py-4 whitespace-nowrap text-xs text-slate-500 w-[160px] min-w-[160px]">
                    {renderEditableCell(s, 'noKk', s.noKk || '-', { className: 'font-mono' })}
                  </td>
                )}
                {visibleColumns.tempatLahir && (
                  <td className="px-3 py-4 whitespace-nowrap text-xs font-medium text-slate-700 font-display w-[130px] min-w-[130px]">
                    {renderEditableCell(s, 'tempatLahir', s.tempatLahir || '-')}
                  </td>
                )}
                {visibleColumns.tanggalLahir && (
                  <td className="px-3 py-4 whitespace-nowrap text-xs text-slate-500 w-[125px] min-w-[125px]">
                    {renderEditableCell(s, 'tanggalLahir', s.tanggalLahir || '-', { type: 'date', className: 'font-mono' })}
                  </td>
                )}

                {/* Toggable */}
                {visibleColumns.gender && (
                  <td className="px-3 py-4 whitespace-nowrap text-xs w-[110px] min-w-[110px]">
                    {renderEditableCell(
                      s,
                      'gender',
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        s.gender === 'Putra' 
                          ? 'bg-blue-50 text-blue-700' 
                          : 'bg-pink-50 text-pink-700'
                      }`}>
                        {s.gender}
                      </span>,
                      { type: 'select', selectOptions: ['Putra', 'Putri'] }
                    )}
                  </td>
                )}
                {visibleColumns.pendidikanTerakhir && (
                  <td className="px-3 py-4 whitespace-nowrap text-xs text-slate-700 w-[160px] min-w-[160px]">
                    {renderEditableCell(s, 'pendidikanTerakhir', s.pendidikanTerakhir || 'SD/MI', {
                      type: 'select',
                      selectOptions: ['SD/MI', 'SMP/MTs', 'SMA/MA/SMK', 'D3/S1/S2', 'Lainnya']
                    })}
                  </td>
                )}
                {visibleColumns.anakKe && (
                  <td className="px-3 py-4 whitespace-nowrap text-xs text-slate-700 w-[90px] min-w-[90px]">
                    {renderEditableCell(s, 'anakKe', s.anakKe !== undefined ? s.anakKe : '-', { type: 'number', className: 'font-mono' })}
                  </td>
                )}
                {visibleColumns.dariBersaudara && (
                  <td className="px-3 py-4 whitespace-nowrap text-xs text-slate-700 w-[125px] min-w-[125px]">
                    {renderEditableCell(s, 'dariBersaudara', s.dariBersaudara !== undefined ? s.dariBersaudara : '-', { type: 'number', className: 'font-mono' })}
                  </td>
                )}
                {visibleColumns.namaAyah && (
                  <td className="px-3 py-4 whitespace-nowrap text-xs text-slate-700 max-w-[150px] truncate w-[150px] min-w-[150px]">
                    {renderEditableCell(s, 'namaAyah', s.namaAyah || '-')}
                  </td>
                )}
                {visibleColumns.nikAyah && (
                  <td className="px-3 py-4 whitespace-nowrap text-xs text-slate-500 w-[160px] min-w-[160px]">
                    {renderEditableCell(s, 'nikAyah', s.nikAyah || '-', { className: 'font-mono' })}
                  </td>
                )}
                {visibleColumns.pekerjaanAyah && (
                  <td className="px-3 py-4 whitespace-nowrap text-xs text-slate-700 max-w-[140px] truncate w-[140px] min-w-[140px]">
                    {renderEditableCell(s, 'pekerjaanAyah', s.pekerjaanAyah || '-')}
                  </td>
                )}
                {visibleColumns.pendidikanAyah && (
                  <td className="px-3 py-4 whitespace-nowrap text-xs text-slate-700 w-[140px] min-w-[140px]">
                    {renderEditableCell(s, 'pendidikanAyah', s.pendidikanAyah || '-', {
                      type: 'select',
                      selectOptions: ['Tidak Sekolah', 'SD/MI', 'SMP/MTs', 'SMA/MA/SMK', 'D3/S1/S2/S3', 'Lainnya']
                    })}
                  </td>
                )}
                {visibleColumns.namaIbu && (
                  <td className="px-3 py-4 whitespace-nowrap text-xs text-slate-700 max-w-[150px] truncate w-[150px] min-w-[150px]">
                    {renderEditableCell(s, 'namaIbu', s.namaIbu || '-')}
                  </td>
                )}
                {visibleColumns.nikIbu && (
                  <td className="px-3 py-4 whitespace-nowrap text-xs text-slate-500 w-[160px] min-w-[160px]">
                    {renderEditableCell(s, 'nikIbu', s.nikIbu || '-', { className: 'font-mono' })}
                  </td>
                )}
                {visibleColumns.pekerjaanIbu && (
                  <td className="px-3 py-4 whitespace-nowrap text-xs text-slate-700 max-w-[140px] truncate w-[140px] min-w-[140px]">
                    {renderEditableCell(s, 'pekerjaanIbu', s.pekerjaanIbu || '-')}
                  </td>
                )}
                {visibleColumns.pendidikanIbu && (
                  <td className="px-3 py-4 whitespace-nowrap text-xs text-slate-700 w-[140px] min-w-[140px]">
                    {renderEditableCell(s, 'pendidikanIbu', s.pendidikanIbu || '-', {
                      type: 'select',
                      selectOptions: ['Tidak Sekolah', 'SD/MI', 'SMP/MTs', 'SMA/MA/SMK', 'D3/S1/S2/S3', 'Lainnya']
                    })}
                  </td>
                )}
                {visibleColumns.alamat && (
                  <td className="px-3 py-4 text-xs text-slate-600 max-w-[180px] truncate w-[180px] min-w-[180px]">
                    {renderEditableCell(s, 'alamat', s.alamat || '-')}
                  </td>
                )}
                {visibleColumns.rt && (
                  <td className="px-3 py-4 whitespace-nowrap text-xs text-slate-500 w-[75px] min-w-[75px]">
                    {renderEditableCell(s, 'rt', s.rt && String(s.rt).trim() !== '0' ? s.rt : '-', { className: 'font-mono' })}
                  </td>
                )}
                {visibleColumns.rw && (
                  <td className="px-3 py-4 whitespace-nowrap text-xs text-slate-500 w-[75px] min-w-[75px]">
                    {renderEditableCell(s, 'rw', s.rw && String(s.rw).trim() !== '0' ? s.rw : '-', { className: 'font-mono' })}
                  </td>
                )}

                {/* Toggable */}
                {visibleColumns.desa && (
                  <td className="px-3 py-4 whitespace-nowrap text-xs text-slate-600 w-[140px] min-w-[140px]">
                    {renderEditableCell(s, 'desa', s.desa || '-')}
                  </td>
                )}
                {visibleColumns.kecamatan && (
                  <td className="px-3 py-4 whitespace-nowrap text-xs text-slate-600 w-[140px] min-w-[140px]">
                    {renderEditableCell(s, 'kecamatan', s.kecamatan || '-')}
                  </td>
                )}
                {visibleColumns.kabupaten && (
                  <td className="px-3 py-4 whitespace-nowrap text-xs text-slate-600 w-[150px] min-w-[150px]">
                    {renderEditableCell(s, 'kabupaten', s.kabupaten || s.asal || '-')}
                  </td>
                )}
                {visibleColumns.provinsi && (
                  <td className="px-3 py-4 whitespace-nowrap text-xs text-slate-600 w-[150px] min-w-[150px]">
                    {renderEditableCell(s, 'provinsi', s.provinsi || '-')}
                  </td>
                )}
                {visibleColumns.jarakRumah && (
                  <td className="px-3 py-4 whitespace-nowrap text-xs text-slate-600 w-[110px] min-w-[110px]">
                    {renderEditableCell(s, 'jarakRumah', s.jarakRumah && s.jarakRumah !== 0 ? `${s.jarakRumah} km` : '-', { type: 'number', className: 'font-mono' })}
                  </td>
                )}
                {visibleColumns.noHp && (
                  <td className="px-3 py-4 whitespace-nowrap text-xs text-slate-600 w-[135px] min-w-[135px]">
                    {renderEditableCell(s, 'noHp', s.noHp || '-', { className: 'font-mono' })}
                  </td>
                )}
                {visibleColumns.statusDomisili && (
                  <td className="px-3 py-4 whitespace-nowrap text-xs w-[130px] min-w-[130px]">
                    {s.statusKeanggotaan === 'Aktif' ? (
                      (() => {
                        const canWrite = s.gender === 'Putri' ? canWritePutri : canWritePutra;
                        const domisiliVal = s.statusDomisili || 'Muqim';

                        return (
                          <div className="relative inline-block text-left">
                            <button
                              type="button"
                              onClick={(e) => {
                                if (isSelectionMode) return;
                                e.stopPropagation();
                                if (!canWrite) return;
                                setActiveDomisiliDropdownId(prev => prev === s.id ? null : s.id);
                                setActiveFormalKelasDropdownId(null);
                                setActiveEmisDropdownId(null);
                                setActiveStatusKeanggotaanDropdownId(null);
                              }}
                              disabled={!canWrite || isSelectionMode}
                              className={`dropdown-trigger-btn inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border transition-all ${
                                isSelectionMode
                                  ? 'bg-slate-100/70 text-slate-400 border-slate-200/50 shadow-none pointer-events-none filter grayscale opacity-60'
                                  : domisiliVal === 'Kampung' 
                                    ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' 
                                    : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                              } ${canWrite && !isSelectionMode ? 'cursor-pointer shadow-2xs' : 'cursor-default'}`}
                              title={canWrite && !isSelectionMode ? "Klik untuk mengubah Status Domisili" : undefined}
                            >
                              <span>{domisiliVal}</span>
                              {canWrite && !isSelectionMode && <ChevronsUpDown className="h-3 w-3 opacity-70 shrink-0 text-slate-500" />}
                            </button>

                            {activeDomisiliDropdownId === s.id && (() => {
                              const pendingVal = pendingDomisili[s.id];
                              const hasChangedDomisili = pendingVal !== undefined && pendingVal !== domisiliVal;

                              return (
                                <div 
                                  onClick={(e) => e.stopPropagation()}
                                  className="dropdown-container-box absolute left-0 mt-1 w-max min-w-[105px] max-w-[130px] bg-white border border-slate-200 rounded-xl shadow-xl z-[100] py-1 text-xs font-semibold text-slate-700"
                                >
                                  {/* Tombol centang & X tersusun vertikal di kanan atas dropdown (hanya jika ada perubahan) */}
                                  {hasChangedDomisili && (
                                    <div className="absolute -top-2 -right-8 z-[110] flex flex-col items-center gap-1 bg-white border border-slate-200 rounded-lg p-1 shadow-lg animate-in fade-in zoom-in-95">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const valToApply = pendingDomisili[s.id] || domisiliVal;
                                          if (valToApply !== domisiliVal) {
                                            onUpdateSantri?.({
                                              ...s,
                                              statusDomisili: valToApply as any
                                            });
                                          }
                                          setActiveDomisiliDropdownId(null);
                                          setPendingDomisili(prev => {
                                            const copy = { ...prev };
                                            delete copy[s.id];
                                            return copy;
                                          });
                                        }}
                                        className="rounded p-1 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 cursor-pointer transition-colors shadow-2xs"
                                        title="Terapkan Perubahan (Centang)"
                                      >
                                        <Check className="h-3.5 w-3.5 stroke-[3]" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setActiveDomisiliDropdownId(null);
                                          setPendingDomisili(prev => {
                                            const copy = { ...prev };
                                            delete copy[s.id];
                                            return copy;
                                          });
                                        }}
                                        className="rounded p-1 bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 cursor-pointer transition-colors shadow-2xs"
                                        title="Batal Perubahan (X)"
                                      >
                                        <X className="h-3.5 w-3.5 stroke-[3]" />
                                      </button>
                                    </div>
                                  )}

                                {(['Muqim', 'Kampung'] as const).map((domOption) => {
                                  const activeVal = pendingDomisili[s.id] || domisiliVal;
                                  const isCurrent = activeVal === domOption;
                                  return (
                                    <button
                                      key={domOption}
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setPendingDomisili(prev => ({ ...prev, [s.id]: domOption }));
                                      }}
                                      className={`w-full text-left px-3 py-1.5 transition-colors flex items-center justify-between cursor-pointer ${
                                        isCurrent ? 'bg-emerald-50 text-emerald-700 font-bold' : 'hover:bg-slate-50 text-slate-600'
                                      }`}
                                    >
                                      <span>{domOption}</span>
                                      {isCurrent && <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />}
                                    </button>
                                  );
                                })}
                              </div>
                            );
                          })()}
                          </div>
                        );
                      })()
                    ) : (
                      <span className="text-slate-400 font-mono">-</span>
                    )}
                  </td>
                )}
                {visibleColumns.tanggalMasuk && (
                  <td className="px-3 py-4 whitespace-nowrap text-xs text-slate-500 w-[115px] min-w-[115px]">
                    {renderEditableCell(s, 'tanggalMasuk', s.tanggalMasuk || '-', { type: 'date', className: 'font-mono' })}
                  </td>
                )}
                {visibleColumns.tanggalKeluar && (
                  <td className="px-3 py-4 whitespace-nowrap text-xs text-slate-500 w-[115px] min-w-[115px]">
                    {renderEditableCell(s, 'tanggalKeluar', s.tanggalKeluar || '-', { type: 'date', className: 'font-mono' })}
                  </td>
                )}
                {visibleColumns.catatan && (
                  <td className="px-3 py-4 text-xs text-slate-500 max-w-[180px] truncate w-[180px] min-w-[180px]">
                    {renderEditableCell(s, 'catatan', s.catatan || '-')}
                  </td>
                )}

                {/* Selalu Terlihat: Status Keanggotaan & Status Emis */}
                <td className="px-3 py-4 text-center whitespace-nowrap text-xs w-[115px] min-w-[115px]">
                  {(() => {
                    const canWrite = s.gender === 'Putri' ? canWritePutri : canWritePutra;
                    const currentStatus = s.statusKeanggotaan || 'Aktif';

                    return (
                      <div className="relative inline-block text-left">
                        <button
                          type="button"
                          onClick={(e) => {
                            if (isSelectionMode) return;
                            e.stopPropagation();
                            if (!canWrite) return;
                            setActiveStatusKeanggotaanDropdownId(prev => prev === s.id ? null : s.id);
                            setActiveFormalKelasDropdownId(null);
                            setActiveDomisiliDropdownId(null);
                            setActiveEmisDropdownId(null);
                          }}
                          disabled={!canWrite || isSelectionMode}
                          className={`dropdown-trigger-btn ${
                            isSelectionMode
                              ? 'pointer-events-none filter grayscale opacity-60'
                              : canWrite
                                ? 'cursor-pointer hover:scale-105 transition-transform'
                                : 'cursor-default'
                          }`}
                          title={canWrite && !isSelectionMode ? "Klik untuk mengubah Status Keanggotaan" : undefined}
                        >
                          <MembershipBadge status={currentStatus} showChevron={canWrite && !isSelectionMode} />
                        </button>

                        {activeStatusKeanggotaanDropdownId === s.id && (() => {
                          const pendingVal = pendingStatusKeanggotaan[s.id];
                          const hasChangedStatus = pendingVal !== undefined && pendingVal !== currentStatus;

                          return (
                            <div 
                              onClick={(e) => e.stopPropagation()}
                              className="dropdown-container-box absolute left-1/2 -translate-x-1/2 mt-1 w-max min-w-[115px] max-w-[140px] bg-white border border-slate-200 rounded-xl shadow-xl z-[100] py-1 text-xs font-semibold text-slate-700"
                            >
                              {/* Tombol centang & X tersusun vertikal di kanan atas dropdown (hanya jika ada perubahan) */}
                              {hasChangedStatus && (
                                <div className="absolute -top-2 -right-8 z-[110] flex flex-col items-center gap-1 bg-white border border-slate-200 rounded-lg p-1 shadow-lg animate-in fade-in zoom-in-95">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const valToApply = pendingStatusKeanggotaan[s.id] || currentStatus;
                                      if (valToApply !== currentStatus) {
                                        const updated: Santri = {
                                          ...s,
                                          statusKeanggotaan: valToApply as any,
                                        };
                                        if (valToApply === 'Aktif') {
                                          updated.tanggalKeluar = undefined;
                                          if (!updated.statusDomisili) updated.statusDomisili = 'Muqim';
                                        } else {
                                          updated.statusDomisili = undefined;
                                          if (!updated.tanggalKeluar) {
                                            updated.tanggalKeluar = new Date().toISOString().split('T')[0];
                                          }
                                        }
                                        onUpdateSantri?.(updated);
                                      }
                                      setActiveStatusKeanggotaanDropdownId(null);
                                      setPendingStatusKeanggotaan(prev => {
                                        const copy = { ...prev };
                                        delete copy[s.id];
                                        return copy;
                                      });
                                    }}
                                    className="rounded p-1 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 cursor-pointer transition-colors shadow-2xs"
                                    title="Terapkan Perubahan (Centang)"
                                  >
                                    <Check className="h-3.5 w-3.5 stroke-[3]" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveStatusKeanggotaanDropdownId(null);
                                      setPendingStatusKeanggotaan(prev => {
                                        const copy = { ...prev };
                                        delete copy[s.id];
                                        return copy;
                                      });
                                    }}
                                    className="rounded p-1 bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 cursor-pointer transition-colors shadow-2xs"
                                    title="Batal Perubahan (X)"
                                  >
                                    <X className="h-3.5 w-3.5 stroke-[3]" />
                                  </button>
                                </div>
                              )}

                            {(['Aktif', 'Alumni', 'Meninggal'] as const).map((opt) => {
                              const activeVal = pendingStatusKeanggotaan[s.id] || currentStatus;
                              const isCurrent = activeVal === opt;
                              return (
                                <button
                                  key={opt}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPendingStatusKeanggotaan(prev => ({ ...prev, [s.id]: opt }));
                                  }}
                                  className={`w-full text-left px-3 py-1.5 transition-colors flex items-center justify-between cursor-pointer ${
                                    isCurrent ? 'bg-emerald-50 text-emerald-700 font-bold' : 'hover:bg-slate-50 text-slate-600'
                                  }`}
                                >
                                  <span>{opt}</span>
                                  {isCurrent && <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />}
                                </button>
                              );
                            })}
                          </div>
                        );
                      })()}
                      </div>
                    );
                  })()}
                </td>
                <td className="px-3 py-4 whitespace-nowrap text-xs w-[115px] min-w-[115px]">
                  {(() => {
                    const canWrite = s.gender === 'Putri' ? canWritePutri : canWritePutra;
                    const isTerdaftar = (s.statusEmis || 'Belum').toLowerCase() === 'terdaftar';
                    
                    return (
                      <div className="relative inline-block text-left">
                        <button
                          type="button"
                          onClick={(e) => {
                            if (isSelectionMode) return;
                            e.stopPropagation();
                            if (!canWrite) return;
                            setActiveEmisDropdownId(prev => prev === s.id ? null : s.id);
                            setActiveFormalKelasDropdownId(null);
                            setActiveDomisiliDropdownId(null);
                            setActiveStatusKeanggotaanDropdownId(null);
                          }}
                          disabled={!canWrite || isSelectionMode}
                          className={`dropdown-trigger-btn inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold border transition-all ${
                            isSelectionMode
                              ? 'bg-slate-100/70 text-slate-400 border-slate-200/50 shadow-none pointer-events-none filter grayscale opacity-60'
                              : isTerdaftar
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300'
                                : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100 hover:border-rose-300'
                          } ${canWrite && !isSelectionMode ? 'cursor-pointer shadow-2xs hover:shadow-xs' : 'cursor-default'}`}
                          title={canWrite && !isSelectionMode ? "Klik untuk mengubah Status EMIS" : undefined}
                        >
                          <span>{s.statusEmis || 'Belum'}</span>
                          {canWrite && !isSelectionMode && (
                            <ChevronsUpDown className="h-3 w-3 opacity-70 shrink-0 text-slate-500" />
                          )}
                        </button>

                        {activeEmisDropdownId === s.id && (() => {
                          const currentEmis = s.statusEmis || 'Belum';
                          const pendingVal = pendingEmis[s.id];
                          const hasChangedEmis = pendingVal !== undefined && pendingVal !== currentEmis;

                          return (
                            <div 
                              onClick={(e) => e.stopPropagation()}
                              className="dropdown-container-box absolute left-0 mt-1 w-max min-w-[110px] max-w-[135px] bg-white border border-slate-200 rounded-xl shadow-xl z-[100] py-1 text-xs font-semibold text-slate-700"
                            >
                              {/* Tombol centang & X tersusun vertikal di kanan atas dropdown (hanya jika ada perubahan) */}
                              {hasChangedEmis && (
                                <div className="absolute -top-2 -right-8 z-[110] flex flex-col items-center gap-1 bg-white border border-slate-200 rounded-lg p-1 shadow-lg animate-in fade-in zoom-in-95">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const valToApply = pendingEmis[s.id] || currentEmis;
                                      if (valToApply !== currentEmis) {
                                        const updated: Santri = {
                                          ...s,
                                          statusEmis: valToApply as any
                                        };
                                        if (valToApply === 'Belum') {
                                          const currentKelas = s.kelas ? s.kelas.trim() : '';
                                          const isAlreadyCalon = !currentKelas || 
                                            currentKelas.toLowerCase() === 'tanpa kelas' || 
                                            currentKelas.toLowerCase().includes('calon peserta didik') || 
                                            currentKelas.toLowerCase().includes('calon pelajar');

                                          if (!isAlreadyCalon) {
                                            updated.kelas = 'Calon Peserta Didik';
                                          }
                                        }
                                        onUpdateSantri?.(updated);
                                      }
                                      setActiveEmisDropdownId(null);
                                      setPendingEmis(prev => {
                                        const copy = { ...prev };
                                        delete copy[s.id];
                                        return copy;
                                      });
                                    }}
                                    className="rounded p-1 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 cursor-pointer transition-colors shadow-2xs"
                                    title="Terapkan Perubahan (Centang)"
                                  >
                                    <Check className="h-3.5 w-3.5 stroke-[3]" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveEmisDropdownId(null);
                                      setPendingEmis(prev => {
                                        const copy = { ...prev };
                                        delete copy[s.id];
                                        return copy;
                                      });
                                    }}
                                    className="rounded p-1 bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 cursor-pointer transition-colors shadow-2xs"
                                    title="Batal Perubahan (X)"
                                  >
                                    <X className="h-3.5 w-3.5 stroke-[3]" />
                                  </button>
                                </div>
                              )}

                            {(['Terdaftar', 'Belum'] as const).map((emisOption) => {
                              const activeVal = pendingEmis[s.id] || (s.statusEmis || 'Belum');
                              const isCurrent = activeVal === emisOption;
                              return (
                                <button
                                  key={emisOption}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPendingEmis(prev => ({ ...prev, [s.id]: emisOption }));
                                  }}
                                  className={`w-full text-left px-3 py-1.5 transition-colors flex items-center justify-between cursor-pointer ${
                                    isCurrent ? 'bg-emerald-50 text-emerald-700 font-bold' : 'hover:bg-slate-50 text-slate-600'
                                  }`}
                                >
                                  <span>{emisOption === 'Belum' ? 'Belum' : 'Terdaftar'}</span>
                                  {isCurrent && <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />}
                                </button>
                              );
                            })}
                          </div>
                        );
                      })()}
                      </div>
                    );
                  })()}
                </td>

                {/* Aksi (Sticky Right) */}
                <td 
                  onClick={(e) => {
                    if (isSelectionMode) {
                      e.stopPropagation();
                    }
                  }}
                  className={`px-2 py-4 text-center whitespace-nowrap sticky right-0 transition-colors shadow-[-2px_0_5px_rgba(0,0,0,0.05)] border-l border-slate-100 w-12 min-w-[48px] ${
                    isSelectionMode
                      ? 'bg-slate-50 text-slate-400 hidden md:table-cell'
                      : 'bg-white group-hover:bg-slate-50 table-cell'
                  } ${activeSantriDropdownId === `tbl-${s.id}` || activeDesktopDropdownId === s.id ? 'z-[100]' : 'z-20'}`}
                >
                  <div className="flex items-center justify-center">
                    {/* Tombol Titik Tiga (Dropdown Aksi Lainnya) */}
                    <div className="relative inline-block text-left">
                      <button
                        type="button"
                        disabled={isSelectionMode}
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveDesktopDropdownId(activeDesktopDropdownId === s.id ? null : s.id);
                        }}
                        className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-all ${
                          isSelectionMode
                            ? 'bg-slate-100 text-slate-300 cursor-not-allowed border border-slate-200'
                            : activeDesktopDropdownId === s.id
                              ? 'bg-slate-100 text-slate-700 border border-slate-200'
                              : 'bg-slate-50 text-slate-600 hover:bg-slate-100 cursor-pointer active:scale-95'
                        }`}
                        title="Aksi Lainnya"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>

                      <AnimatePresence>
                        {activeDesktopDropdownId === s.id && (
                          <>
                            {/* Backdrop overlay to close when clicking outside */}
                            <div 
                              className="fixed inset-0 z-40 bg-transparent"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveDesktopDropdownId(null);
                              }}
                            />
                            <motion.div
                              initial={{ opacity: 0, scale: 0.95, y: -4 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95, y: -4 }}
                              transition={{ duration: 0.1 }}
                              className={`absolute right-0 mt-1 w-36 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl z-50 text-slate-700 text-left font-sans ${
                                isLastFew ? 'bottom-full mb-1' : 'top-full'
                              }`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="space-y-0.5">
                                {/* Detail Button */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveDesktopDropdownId(null);
                                    setSelectedSantri(s);
                                  }}
                                  className="flex w-full items-center px-2.5 py-2 rounded-lg text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer"
                                >
                                  <span>Detail Biodata</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveDesktopDropdownId(null);
                                    setIsSelectionMode(true);
                                    setLastSelectedIndex(idx);
                                    setLastAction('select');
                                    if (!selectedSantriIds.includes(s.id)) {
                                      setSelectedSantriIds([...selectedSantriIds, s.id]);
                                    }
                                  }}
                                  className="flex w-full items-center px-2.5 py-2 rounded-lg text-left text-xs font-semibold text-slate-700 hover:bg-emerald-55 hover:text-emerald-800 transition-colors cursor-pointer"
                                >
                                  <span>Pilih</span>
                                </button>

                                {/* Edit Button */}
                                {canWriteForSantri && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveDesktopDropdownId(null);
                                      handleStartEditSantri(s);
                                    }}
                                    className="flex w-full items-center px-2.5 py-2 rounded-lg text-left text-xs font-semibold text-slate-700 hover:bg-amber-50 hover:text-amber-700 transition-colors cursor-pointer"
                                  >
                                    <span>Ubah Data</span>
                                  </button>
                                )}

                                {/* Print Button */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveDesktopDropdownId(null);
                                    handlePrintClick(s);
                                  }}
                                  className="flex w-full items-center px-2.5 py-2 rounded-lg text-left text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors cursor-pointer"
                                >
                                  <span>Cetak Data</span>
                                </button>

                                {/* Delete Button */}
                                {canWriteForSantri && (
                                  <>
                                    <div className="my-1 border-t border-slate-100" />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveDesktopDropdownId(null);
                                        handleDeleteClick(s.id, s.nama);
                                      }}
                                      className="flex w-full items-center px-2.5 py-2 rounded-lg text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition-colors cursor-pointer"
                                    >
                                      <span>Hapus Data</span>
                                    </button>
                                  </>
                                )}
                              </div>
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>

      {/* Viewport-sticky floating header (rendered via Portal to avoid being trapped by parent transform layout) */}
      {typeof document !== 'undefined' && createPortal(
        <div
          ref={floatingHeaderOuterRef}
          className="fixed z-[45] bg-slate-50 border border-slate-100 shadow-md rounded-t-2xl overflow-visible"
          style={{
            top: `${stickyTop}px`,
            left: `${floatingHeaderStyle.left}px`,
            width: `${floatingHeaderStyle.width}px`,
            display: isScrolled ? 'block' : 'none',
          }}
        >
          <div
            ref={floatingHeaderRef}
            onScroll={(e) => {
              const floating = e.currentTarget;
              if (scrollSourceRef.current !== 'main') {
                scrollSourceRef.current = 'floating';
                if (scrollTimeoutRef.current) {
                  window.clearTimeout(scrollTimeoutRef.current);
                }
                scrollTimeoutRef.current = window.setTimeout(() => {
                  scrollSourceRef.current = null;
                }, 150);

                if (containerRef.current && containerRef.current.scrollLeft !== floating.scrollLeft) {
                  containerRef.current.scrollLeft = floating.scrollLeft;
                }
              }
            }}
            className="overflow-x-auto [&::-webkit-scrollbar]:hidden"
          >
            <table className="w-max min-w-full border-separate border-spacing-0 text-left text-sm text-slate-600">
              <thead className="text-xs font-semibold uppercase tracking-wider text-slate-400 bg-slate-50">
                {renderTableHeadContents('bg-slate-50 text-slate-400 border-b border-slate-100')}
              </thead>
            </table>
          </div>
          {/* Scroll Navigation Buttons inside Floating Header */}
          {renderScrollButtons(true)}
        </div>,
        document.body
      )}
    </div>
  );
}
