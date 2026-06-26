import { useState, useMemo } from 'react';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  FileText, 
  Download, 
  TrendingUp, 
  TrendingDown,
  RefreshCw,
  Percent,
  Filter,
  X,
  ChevronRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { KPICard } from '@/components/dashboard/KPICard';
import { useDREData, type TimeGrouping } from '@/hooks/useDREData';
import { useFilters } from '@/hooks/useFilters';
import { DashboardFilters } from '@/components/dashboard/DashboardFilters';
import { DREResultChart } from '@/components/finance/DREResultChart';
import { DREStackedBarChart } from '@/components/finance/DREStackedBarChart';
import { DREDonutChart } from '@/components/finance/DREDonutChart';
import { DREWaterfallChart } from '@/components/finance/DREWaterfallChart';
import { DRETopCategoriesChart } from '@/components/finance/DRETopCategoriesChart';
import { DREDrilldownDrawer } from '@/components/finance/DREDrilldownDrawer';
import { 
  exportDREToCSV, 
  generateDRETableHtml, 
  generatePDFContent, 
  printPDF,
  formatCurrency,
  type DRELine 
} from '@/lib/exportUtils';

export default function DRE() {
  const { filters } = useFilters();
  const [grouping, setGrouping] = useState<TimeGrouping>('day');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [drilldownOpen, setDrilldownOpen] = useState(false);
  const [drilldownTitle, setDrilldownTitle] = useState('');
  
  // Use proper ISO timestamps with timezone for correct date filtering
  const startDate = filters.dateRange.from 
    ? new Date(filters.dateRange.from.setHours(0, 0, 0, 0)).toISOString()
    : new Date(subDays(new Date(), 30).setHours(0, 0, 0, 0)).toISOString();
  const endDate = filters.dateRange.to 
    ? new Date(filters.dateRange.to.setHours(23, 59, 59, 999)).toISOString()
    : new Date(new Date().setHours(23, 59, 59, 999)).toISOString();

  const { data: dre, isLoading, refetch } = useDREData(startDate, endDate, grouping);

  const periodDisplay = useMemo(() => {
    if (filters.dateRange.from && filters.dateRange.to) {
      return `${format(filters.dateRange.from, 'dd/MM/yyyy', { locale: ptBR })} a ${format(filters.dateRange.to, 'dd/MM/yyyy', { locale: ptBR })}`;
    }
    return 'Últimos 30 dias';
  }, [filters.dateRange]);

  // Build DRE lines for display and export
  const dreLines: DRELine[] = useMemo(() => {
    if (!dre) return [];
    
    return [
      { label: 'RECEITA BRUTA', value: dre.receitaBruta, isTotal: true },
      { label: 'Receita de Vendas', value: dre.receitaVendas, indent: 1 },
      { label: 'Recebimentos Carteira', value: dre.receitaCarteira, indent: 1 },
      { label: '(-) Deduções/Impostos', value: -dre.deducoes, indent: 1 },
      { label: 'RECEITA LÍQUIDA', value: dre.receitaLiquida, isSubtotal: true },
      { label: '(-) CMV - Custo dos Produtos Vendidos', value: -dre.cmv, isSubtotal: true },
      { label: 'Custo Água/Galões', value: -dre.cmvAgua, indent: 1 },
      { label: 'Custo Gás/Botijões', value: -dre.cmvGas, indent: 1 },
      { label: 'Custo Outros Produtos', value: -dre.cmvOutros, indent: 1 },
      { label: 'LUCRO BRUTO', value: dre.lucroBruto, isTotal: true },
      { label: '(-) DESPESAS OPERACIONAIS', value: -dre.despesasOperacionais, isSubtotal: true },
      { label: 'Despesas Fixas', value: -dre.despesasFixas, indent: 1 },
      { label: 'Despesas Variáveis/Compras', value: -dre.despesasVariaveis, indent: 1 },
      { label: 'Salários/Prestadores', value: -dre.salarios, indent: 1 },
      { label: 'RESULTADO OPERACIONAL', value: dre.resultadoOperacional, isTotal: true },
    ];
  }, [dre]);

  const handleExportCSV = () => {
    exportDREToCSV(dreLines, {
      filename: `dre_${startDate}_${endDate}`,
      title: 'DRE - Demonstrativo de Resultado',
      period: periodDisplay,
    });
  };

  const handleExportPDF = () => {
    const tableHtml = generateDRETableHtml(dreLines);
    const htmlContent = generatePDFContent(
      'DRE - Demonstrativo de Resultado',
      periodDisplay,
      tableHtml
    );
    printPDF(htmlContent);
  };

  const handleRowClick = (lineLabel: string) => {
    setDrilldownTitle(lineLabel);
    setDrilldownOpen(true);
  };

  const handleCategoryClick = (category: string) => {
    if (selectedCategory === category) {
      setSelectedCategory(null);
    } else {
      setSelectedCategory(category);
    }
  };

  const clearFilters = () => {
    setSelectedCategory(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">DRE</h1>
          <p className="text-sm text-muted-foreground">
            Demonstrativo de Resultado do Exercício • {periodDisplay}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={grouping} onValueChange={(v) => setGrouping(v as TimeGrouping)}>
            <TabsList>
              <TabsTrigger value="day">Dia</TabsTrigger>
              <TabsTrigger value="week">Semana</TabsTrigger>
              <TabsTrigger value="month">Mês</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportPDF}>
                <FileText className="h-4 w-4 mr-2" />
                PDF (Imprimir)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportCSV}>
                <FileText className="h-4 w-4 mr-2" />
                CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Filters */}
      <DashboardFilters />

      {/* Active filter indicator */}
      {selectedCategory && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-2">
            <Filter className="h-3 w-3" />
            Filtro: {selectedCategory}
            <button onClick={clearFilters} className="hover:text-destructive">
              <X className="h-3 w-3" />
            </button>
          </Badge>
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Limpar filtros
          </Button>
        </div>
      )}

      {/* Margin KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          title="Resultado do Período"
          value={formatCurrency(dre?.resultadoOperacional || 0)}
          icon={dre?.resultadoOperacional && dre.resultadoOperacional >= 0 
            ? <TrendingUp className="h-5 w-5" /> 
            : <TrendingDown className="h-5 w-5" />}
          className={`border-l-4 ${dre?.resultadoOperacional && dre.resultadoOperacional >= 0 ? 'border-l-green-500' : 'border-l-red-500'}`}
        />
        <KPICard
          title="Lucro Bruto"
          value={formatCurrency(dre?.lucroBruto || 0)}
          icon={<TrendingUp className="h-5 w-5" />}
          className="border-l-4 border-l-blue-500"
        />
        <KPICard
          title="Margem Bruta"
          value={`${(dre?.margemBruta || 0).toFixed(1)}%`}
          icon={<Percent className="h-5 w-5" />}
        />
        <KPICard
          title="Margem Operacional"
          value={`${(dre?.margemOperacional || 0).toFixed(1)}%`}
          icon={<Percent className="h-5 w-5" />}
          className={dre?.margemOperacional && dre.margemOperacional < 0 ? 'border-l-4 border-l-red-500' : ''}
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Line Chart - Results over time */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Resultado ao Longo do Tempo</CardTitle>
          </CardHeader>
          <CardContent>
            <DREResultChart 
              data={dre?.timeSeries || []} 
              isLoading={isLoading}
            />
          </CardContent>
        </Card>

        {/* Waterfall Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Formação do Resultado (Cascata)</CardTitle>
          </CardHeader>
          <CardContent>
            <DREWaterfallChart 
              data={dre?.waterfallData || []} 
              isLoading={isLoading}
            />
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stacked Bar */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Composição das Despesas</CardTitle>
          </CardHeader>
          <CardContent>
            <DREStackedBarChart 
              data={dre?.timeSeries || []} 
              isLoading={isLoading}
              onCategoryClick={handleCategoryClick}
            />
          </CardContent>
        </Card>

        {/* Donut Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Distribuição por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            <DREDonutChart 
              data={dre?.categoryBreakdown || []} 
              isLoading={isLoading}
              onCategoryClick={handleCategoryClick}
              selectedCategory={selectedCategory}
            />
          </CardContent>
        </Card>

        {/* Top Categories */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Top Categorias</CardTitle>
          </CardHeader>
          <CardContent>
            <DRETopCategoriesChart 
              data={dre?.topCategories || []} 
              isLoading={isLoading}
              onCategoryClick={handleCategoryClick}
            />
          </CardContent>
        </Card>
      </div>

      {/* DRE Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Demonstrativo de Resultado
            <span className="text-muted-foreground font-normal text-sm ml-2">
              (clique na linha para detalhes)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(12)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Descrição</th>
                    <th className="text-right py-3 px-4 font-semibold text-muted-foreground w-40">Valor (R$)</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {dreLines.map((line, index) => (
                    <tr 
                      key={index}
                      onClick={() => handleRowClick(line.label)}
                      className={`
                        border-b last:border-0 cursor-pointer transition-colors
                        ${line.isTotal ? 'bg-muted/50 font-bold' : ''}
                        ${line.isSubtotal ? 'bg-muted/30 font-semibold' : ''}
                        hover:bg-muted/60
                      `}
                    >
                      <td 
                        className="py-3 px-4"
                        style={{ paddingLeft: line.indent ? `${line.indent * 24 + 16}px` : undefined }}
                      >
                        {line.label}
                      </td>
                      <td 
                        className={`text-right py-3 px-4 font-mono ${
                          line.value >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {formatCurrency(Math.abs(line.value))}
                        {line.value < 0 && ' (-)'}
                      </td>
                      <td className="py-3 px-2">
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Drilldown Drawer */}
      <DREDrilldownDrawer
        open={drilldownOpen}
        onOpenChange={setDrilldownOpen}
        title={drilldownTitle}
        transactions={dre?.detailedTransactions || []}
        categoryBreakdown={dre?.categoryBreakdown}
        selectedCategory={selectedCategory}
      />
    </div>
  );
}
