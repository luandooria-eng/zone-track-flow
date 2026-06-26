import { useEffect, useCallback, useRef, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  ArrowLeft, 
  Save, 
  Undo2, 
  Redo2, 
  Lock,
  Unlock,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Plus,
  Settings2,
  HelpCircle,
  History,
  AlertTriangle,
  BarChart3,
  Shield,
  Activity,
  ClipboardList,
  RefreshCw
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useDailyGridStore } from '@/stores/dailyGridStore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { DailyGridVirtualized } from '@/components/daily-grid/DailyGridVirtualized';
import { GridToolbar } from '@/components/daily-grid/GridToolbar';
import { SaveProgressBar } from '@/components/daily-grid/SaveProgressBar';
import { ValidationErrorsModal } from '@/components/daily-grid/ValidationErrorsModal';
import { KeyboardShortcutsModal } from '@/components/daily-grid/KeyboardShortcutsModal';
import { UndoHistoryPanel } from '@/components/daily-grid/UndoHistoryPanel';
import { OperationalReportsPanel } from '@/components/daily-grid/OperationalReportsPanel';
import { SupervisorDashboard } from '@/components/daily-grid/SupervisorDashboard';
import { DaySummaryDrawer } from '@/components/daily-grid/DaySummaryDrawer';
import { usePermissionsStore, UserRole } from '@/lib/columnPermissions';
import { GridDataProvider, useGridData } from '@/contexts/GridDataContext';
import { Skeleton } from '@/components/ui/skeleton';
import { useDailyGridRealtime } from '@/hooks/useDailyGridRealtime';

// Sheets are always editable - no lock mechanism

function DailyGridSheetContent() {
  const { date } = useParams<{ date: string }>();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  
  const [errorsModalOpen, setErrorsModalOpen] = useState(false);
  const [shortcutsModalOpen, setShortcutsModalOpen] = useState(false);
  const [historyPanelOpen, setHistoryPanelOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [supervisorOpen, setSupervisorOpen] = useState(false);
  const [summaryDrawerOpen, setSummaryDrawerOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const { currentRole, setRole, getPermissions } = usePermissionsStore();
  const permissions = getPermissions();
  
  const {
    currentSheet,
    rows,
    openSheet,
    saveDirtyRows,
    undo,
    redo,
    undoStack,
    redoStack,
    isSaving,
    lastSaveTime,
    dirtyRowCount,
    addRow,
    validateAll,
    getErrorRows,
    navigateToRow,
    selectAllRows,
    clearSelection,
    deleteSelectedRows,
    selectedRows,
    pasteFromClipboard,
    copySelectedCells,
    selectedCell,
  } = useDailyGridStore();

  // Realtime sync across devices
  useDailyGridRealtime();

  useEffect(() => {
    if (date) {
      openSheet(date);
    }
  }, [date, openSheet]);


  // Keyboard shortcuts
  useHotkeys('ctrl+s, meta+s', (e) => {
    e.preventDefault();
    handleSave();
  }, { enableOnFormTags: true });

  useHotkeys('ctrl+z, meta+z', (e) => {
    e.preventDefault();
    undo();
  }, { enableOnFormTags: true });

  useHotkeys('ctrl+shift+z, meta+shift+z, ctrl+y, meta+y', (e) => {
    e.preventDefault();
    redo();
  }, { enableOnFormTags: true });

  useHotkeys('ctrl+a, meta+a', (e) => {
    e.preventDefault();
    selectAllRows();
  }, { enableOnFormTags: true });

  useHotkeys('escape', () => {
    clearSelection();
  }, { enableOnFormTags: true });

  useHotkeys('ctrl+delete, meta+delete', (e) => {
    e.preventDefault();
    if (selectedRows.size > 0) {
      deleteSelectedRows();
      toast({
        title: 'Linhas excluídas',
        description: `${selectedRows.size} linhas foram removidas.`,
      });
    }
  }, { enableOnFormTags: true });

  useHotkeys('insert', (e) => {
    e.preventDefault();
    addRow();
  }, { enableOnFormTags: true });

  useHotkeys('ctrl+v, meta+v', async (e) => {
    e.preventDefault();
    try {
      const text = await navigator.clipboard.readText();
      const startRow = selectedCell?.row ?? rows.length - 1;
      const startCol = selectedCell?.col ?? 0;
      pasteFromClipboard(text, startRow, startCol);
      toast({
        title: 'Dados colados',
        description: 'Dados do clipboard foram colados.',
      });
    } catch (err) {
      // Clipboard access denied
    }
  }, { enableOnFormTags: true });

  useHotkeys('ctrl+c, meta+c', async (e) => {
    e.preventDefault();
    const text = copySelectedCells();
    if (text) {
      await navigator.clipboard.writeText(text);
      toast({
        title: 'Copiado',
        description: 'Dados copiados para o clipboard.',
      });
    }
  }, { enableOnFormTags: true });

  useHotkeys('f1', (e) => {
    e.preventDefault();
    setShortcutsModalOpen(true);
  });

  const handleSave = async () => {
    if (dirtyRowCount === 0) {
      toast({
        title: 'Nada para salvar',
        description: 'Não há alterações pendentes.',
      });
      return;
    }

    const isValid = validateAll();
    if (!isValid) {
      const errorRows = getErrorRows();
      toast({
        variant: 'destructive',
        title: 'Erros de validação',
        description: `${errorRows.length} linha(s) com erros. Clique para ver detalhes.`,
        action: (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setErrorsModalOpen(true)}
          >
            Ver erros
          </Button>
        ),
      });
      return;
    }

    await saveDirtyRows();
    toast({
      title: 'Salvo com sucesso',
      description: `${dirtyRowCount} linhas foram salvas.`,
    });
  };

  const handleNavigateToRow = (rowIndex: number) => {
    navigateToRow(rowIndex);
    // Scroll to the row if needed
    const rowElement = document.querySelector(`[data-row-index="${rowIndex}"]`);
    rowElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // No unlock logic needed - sheets are always editable

  const { isLoading: isLoadingData } = useGridData();

  if (!currentSheet || isLoadingData) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Carregando dados...</p>
      </div>
    );
  }

  const isLocked = false; // Sheets are always editable
  const errorCount = getErrorRows().length;

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] animate-fade-up -mt-4" ref={containerRef}>
      {/* Header */}
      <div className="flex-none border-b bg-card px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate('/daily-grid')}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
            <div className="h-6 w-px bg-border" />
            <div>
              <h1 className="text-lg font-semibold text-foreground flex items-center gap-2">
                Vendas – {format(parseISO(currentSheet.date), "dd/MM/yyyy", { locale: ptBR })}
                <Badge 
                  variant={isLocked ? 'secondary' : 'default'}
                  className={cn(
                    'ml-2',
                    !isLocked && 'bg-success/10 text-success border-success/30'
                  )}
                >
                  {isLocked ? (
                    <><Lock className="mr-1 h-3 w-3" /> Bloqueada</>
                  ) : (
                    'Aberta'
                  )}
                </Badge>
              </h1>
              <p className="text-sm text-muted-foreground">
                {format(parseISO(currentSheet.date), "EEEE", { locale: ptBR })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Status indicators */}
            {dirtyRowCount > 0 && (
              <Badge variant="outline" className="bg-warning/10 text-warning-foreground border-warning/30">
                <AlertCircle className="mr-1 h-3 w-3" />
                {dirtyRowCount} pendentes
              </Badge>
            )}
            {errorCount > 0 && (
              <Badge 
                variant="outline" 
                className="bg-destructive/10 text-destructive border-destructive/30 cursor-pointer"
                onClick={() => setErrorsModalOpen(true)}
              >
                <AlertTriangle className="mr-1 h-3 w-3" />
                {errorCount} erros
              </Badge>
            )}
            {lastSaveTime && (
              <span className="text-xs text-muted-foreground">
                Salvo às {format(lastSaveTime, 'HH:mm')}
              </span>
            )}

            {/* Actions */}
            <div className="h-6 w-px bg-border mx-2" />
            <Button
              variant="ghost"
              size="icon"
              onClick={undo}
              disabled={undoStack.length === 0 || isLocked}
              title="Desfazer (Ctrl+Z)"
            >
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={redo}
              disabled={redoStack.length === 0 || isLocked}
              title="Refazer (Ctrl+Y)"
            >
              <Redo2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setHistoryPanelOpen(true)}
              title="Histórico de alterações"
            >
              <History className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={async () => {
                setIsRefreshing(true);
                await queryClient.invalidateQueries();
                toast({
                  title: 'Dados atualizados',
                  description: 'Todas as informações foram recarregadas.',
                });
                setIsRefreshing(false);
              }}
              disabled={isRefreshing}
              title="Atualizar dados (sem recarregar página)"
            >
              <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setReportsOpen(true)}
              title="Relatórios operacionais"
            >
              <BarChart3 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSupervisorOpen(true)}
              title="Dashboard do Supervisor"
            >
              <Activity className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShortcutsModalOpen(true)}
              title="Atalhos de teclado (F1)"
            >
              <HelpCircle className="h-4 w-4" />
            </Button>

            {/* Summary Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSummaryDrawerOpen(true)}
              className="ml-2"
            >
              <ClipboardList className="mr-2 h-4 w-4" />
              Resumo do dia
            </Button>
            
            {/* Role selector (for demo) */}
            <div className="h-6 w-px bg-border mx-1" />
            <Select value={currentRole} onValueChange={(v) => setRole(v as UserRole)}>
              <SelectTrigger className="w-[130px] h-8">
                <Shield className="h-3 w-3 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="supervisor">Supervisor</SelectItem>
                <SelectItem value="operator">Operador</SelectItem>
                <SelectItem value="viewer">Visualizador</SelectItem>
              </SelectContent>
            </Select>
            
            <div className="h-6 w-px bg-border mx-2" />
            <Button
              onClick={handleSave}
              disabled={dirtyRowCount === 0 || isSaving || isLocked || !permissions.canSave}
              className="min-w-[120px]"
            >
              {isSaving ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</>
              ) : (
                <><Save className="mr-2 h-4 w-4" /> Salvar (Ctrl+S)</>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Save progress bar */}
      {isSaving && <SaveProgressBar />}

      {/* No locked overlay - sheets are always editable */}

      {/* Toolbar */}
      <GridToolbar />


      {/* Grid */}
      <div className="flex-1 overflow-hidden">
        <DailyGridVirtualized />
      </div>

      {/* Footer */}
      <div className="flex-none border-t bg-card px-4 py-2">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            <span className="text-muted-foreground">
              {rows.length} linhas
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={addRow}
              disabled={isLocked || !permissions.canAddRows}
            >
              <Plus className="mr-1 h-4 w-4" />
              Nova linha (Insert)
            </Button>
          </div>
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="text-xs">
              <Shield className="h-3 w-3 mr-1" />
              {currentRole === 'admin' ? 'Administrador' : 
               currentRole === 'supervisor' ? 'Supervisor' : 
               currentRole === 'operator' ? 'Operador' : 'Visualizador'}
            </Badge>
            {dirtyRowCount > 0 && (
              <span className="text-warning-foreground">
                {dirtyRowCount} linhas alteradas
              </span>
            )}
            {lastSaveTime && (
              <span className="flex items-center gap-1 text-success">
                <CheckCircle2 className="h-4 w-4" />
                Último save: {format(lastSaveTime, 'HH:mm:ss')}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <ValidationErrorsModal
        open={errorsModalOpen}
        onOpenChange={setErrorsModalOpen}
        onNavigateToRow={handleNavigateToRow}
      />
      <KeyboardShortcutsModal
        open={shortcutsModalOpen}
        onOpenChange={setShortcutsModalOpen}
      />
      <UndoHistoryPanel
        open={historyPanelOpen}
        onOpenChange={setHistoryPanelOpen}
      />
      <OperationalReportsPanel
        open={reportsOpen}
        onOpenChange={setReportsOpen}
        selectedDate={date || format(new Date(), 'yyyy-MM-dd')}
      />
      <SupervisorDashboard
        open={supervisorOpen}
        onOpenChange={setSupervisorOpen}
      />
      <DaySummaryDrawer
        open={summaryDrawerOpen}
        onOpenChange={setSummaryDrawerOpen}
        selectedDate={date || format(new Date(), 'yyyy-MM-dd')}
      />

    </div>
  );
}

// Wrapper component with data provider for optimized loading
export default function DailyGridSheet() {
  return (
    <GridDataProvider>
      <DailyGridSheetContent />
    </GridDataProvider>
  );
}
