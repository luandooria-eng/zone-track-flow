import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Calendar, 
  Lock, 
  Unlock, 
  FileSpreadsheet, 
  Plus,
  Download,
  Filter
} from 'lucide-react';
import { useDailyGridStore } from '@/stores/dailyGridStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function DailyGrid() {
  const navigate = useNavigate();
  const { sheets, loadSheets, createTodaySheet } = useDailyGridStore();

  useEffect(() => {
    loadSheets();
  }, [loadSheets]);

  const handleOpenSheet = (date: string) => {
    navigate(`/daily-grid/${date}`);
  };

  const handleCreateToday = () => {
    createTodaySheet();
    navigate(`/daily-grid/${format(new Date(), 'yyyy-MM-dd')}`);
  };

  const todaySheet = sheets.find(s => s.date === format(new Date(), 'yyyy-MM-dd'));

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Vendas Diária</h1>
          <p className="text-muted-foreground">
            Grid de lançamento rápido estilo planilha
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm">
            <Filter className="mr-2 h-4 w-4" />
            Filtrar
          </Button>
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
          <Button onClick={handleCreateToday}>
            <Plus className="mr-2 h-4 w-4" />
            {todaySheet ? 'Abrir Hoje' : 'Criar Planilha de Hoje'}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="kpi-card">
          <CardHeader className="pb-2">
            <CardDescription>Planilhas Abertas</CardDescription>
            <CardTitle className="text-2xl">
              {sheets.filter(s => s.status === 'open').length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="kpi-card">
          <CardHeader className="pb-2">
            <CardDescription>Total de Registros Hoje</CardDescription>
            <CardTitle className="text-2xl">
              {todaySheet?.rowCount || 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="kpi-card">
          <CardHeader className="pb-2">
            <CardDescription>Planilhas Disponíveis</CardDescription>
            <CardTitle className="text-2xl">
              {sheets.length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="kpi-card">
          <CardHeader className="pb-2">
            <CardDescription>Última Semana</CardDescription>
            <CardTitle className="text-2xl">
              {sheets.reduce((acc, s) => acc + s.rowCount, 0)} pedidos
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Sheets List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Planilhas Recentes
          </CardTitle>
          <CardDescription>
            Clique em uma planilha para abrir e editar
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {sheets.map((sheet, index) => (
              <div
                key={sheet.id}
                onClick={() => handleOpenSheet(sheet.date)}
                className={cn(
                  'flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-all duration-200',
                  'hover:bg-accent/50 hover:border-primary/30',
                  'bg-card border-border'
                )}
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">
                      {format(parseISO(sheet.date), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {sheet.rowCount} registros • Criado {format(sheet.createdAt, "HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge 
                    variant="default"
                    className="bg-success/10 text-success border-success/30"
                  >
                    <Unlock className="mr-1 h-3 w-3" /> Editável
                  </Badge>
                  <Button variant="ghost" size="sm">
                    Abrir
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Keyboard shortcuts help */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Atalhos de Teclado</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center gap-2 text-sm">
              <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">Ctrl+S</kbd>
              <span className="text-muted-foreground">Salvar alterações</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">Enter</kbd>
              <span className="text-muted-foreground">Próxima linha</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">Tab</kbd>
              <span className="text-muted-foreground">Próxima célula</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">F2</kbd>
              <span className="text-muted-foreground">Editar célula</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">Ctrl+Z</kbd>
              <span className="text-muted-foreground">Desfazer</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">Ctrl+V</kbd>
              <span className="text-muted-foreground">Colar do clipboard</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
