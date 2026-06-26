import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, parseISO, startOfWeek, startOfMonth, endOfWeek, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export type TimeGrouping = 'day' | 'week' | 'month';

export interface DREData {
  receitaBruta: number;
  receitaVendas: number;
  receitaCarteira: number;
  deducoes: number;
  receitaLiquida: number;
  cmv: number;
  cmvAgua: number;
  cmvGas: number;
  cmvOutros: number;
  lucroBruto: number;
  despesasOperacionais: number;
  despesasFixas: number;
  despesasVariaveis: number;
  salarios: number;
  resultadoOperacional: number;
  margemBruta: number;
  margemOperacional: number;
}

export interface DRETimeSeries {
  date: string;
  label: string;
  receitas: number;
  despesas: number;
  cmv: number;
  resultado: number;
}

export interface DRECategoryBreakdown {
  category: string;
  sourceModule: string;
  total: number;
  percentage: number;
}

export interface DREWaterfallItem {
  name: string;
  value: number;
  isTotal?: boolean;
  isSubtraction?: boolean;
}

export interface DREDetailedTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  sourceModule: string;
  paymentMethod?: string;
}

export interface DREEnhancedData extends DREData {
  timeSeries: DRETimeSeries[];
  categoryBreakdown: DRECategoryBreakdown[];
  waterfallData: DREWaterfallItem[];
  detailedTransactions: DREDetailedTransaction[];
  topCategories: DRECategoryBreakdown[];
}

function getTimeBuckets(startDate: string, endDate: string, grouping: TimeGrouping): { start: Date; end: Date; label: string }[] {
  const start = parseISO(startDate);
  const end = parseISO(endDate.split('T')[0]);
  
  if (grouping === 'day') {
    return eachDayOfInterval({ start, end }).map(date => ({
      start: date,
      end: date,
      label: format(date, 'dd/MM', { locale: ptBR }),
    }));
  } else if (grouping === 'week') {
    return eachWeekOfInterval({ start, end }, { weekStartsOn: 0 }).map(date => ({
      start: startOfWeek(date, { weekStartsOn: 0 }),
      end: endOfWeek(date, { weekStartsOn: 0 }),
      label: `Sem ${format(date, 'dd/MM', { locale: ptBR })}`,
    }));
  } else {
    return eachMonthOfInterval({ start, end }).map(date => ({
      start: startOfMonth(date),
      end: endOfMonth(date),
      label: format(date, 'MMM/yy', { locale: ptBR }),
    }));
  }
}

export function useDREData(startDate: string, endDate: string, grouping: TimeGrouping = 'day') {
  return useQuery({
    queryKey: ['dre-data-enhanced', startDate, endDate, grouping],
    queryFn: async (): Promise<DREEnhancedData> => {
      // 1. Fetch all IN transactions
      const { data: inTransactions, error: inError } = await supabase
        .from('finance_transactions')
        .select('id, amount, source_module, transaction_date, description, payment_method:payment_methods(name)')
        .eq('type', 'IN')
        .gte('transaction_date', startDate)
        .lte('transaction_date', endDate)
        .order('transaction_date', { ascending: true });

      if (inError) throw inError;

      // 2. Fetch all OUT transactions
      const { data: outTransactions, error: outError } = await supabase
        .from('finance_transactions')
        .select('id, amount, source_module, transaction_date, description, payment_method:payment_methods(name)')
        .eq('type', 'OUT')
        .gte('transaction_date', startDate)
        .lte('transaction_date', endDate)
        .order('transaction_date', { ascending: true });

      if (outError) throw outError;

      // 3. Fetch orders for CMV
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('id, status, delivered_at')
        .eq('status', 'delivered')
        .gte('delivered_at', startDate)
        .lte('delivered_at', endDate);

      if (ordersError) throw ordersError;

      let cmvTotal = 0;
      let cmvAgua = 0;
      let cmvGas = 0;
      let cmvOutros = 0;
      const cmvByDate: Record<string, number> = {};

      if (orders && orders.length > 0) {
        const orderIds = orders.map(o => o.id);
        
        const { data: orderItems, error: itemsError } = await supabase
          .from('order_items')
          .select(`
            quantity,
            product_id,
            order_id,
            product:products(name, cost)
          `)
          .in('order_id', orderIds);

        if (itemsError) throw itemsError;

        // Create order date map
        const orderDateMap = new Map(orders.map(o => [o.id, o.delivered_at?.split('T')[0] || '']));

        (orderItems || []).forEach(item => {
          const product = item.product as { name: string; cost: number | null } | null;
          const cost = product?.cost || 0;
          const itemCmv = Number(item.quantity) * Number(cost);
          cmvTotal += itemCmv;

          const orderDate = orderDateMap.get(item.order_id) || '';
          if (orderDate) {
            cmvByDate[orderDate] = (cmvByDate[orderDate] || 0) + itemCmv;
          }

          const productName = (product?.name || '').toLowerCase();
          if (productName.includes('água') || productName.includes('galão') || productName.includes('mineral')) {
            cmvAgua += itemCmv;
          } else if (productName.includes('gás') || productName.includes('botijão') || productName.includes('glp')) {
            cmvGas += itemCmv;
          } else {
            cmvOutros += itemCmv;
          }
        });
      }

      // Calculate totals
      const receitaVendas = (inTransactions || [])
        .filter(t => t.source_module === 'sales')
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const receitaCarteira = (inTransactions || [])
        .filter(t => t.source_module === 'wallet')
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const receitaBruta = receitaVendas + receitaCarteira;
      const deducoes = 0;
      const receitaLiquida = receitaBruta - deducoes;
      const lucroBruto = receitaLiquida - cmvTotal;

      const despesasFixas = (outTransactions || [])
        .filter(t => t.source_module === 'expense')
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const salarios = (outTransactions || [])
        .filter(t => t.source_module === 'payroll')
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const despesasVariaveis = (outTransactions || [])
        .filter(t => t.source_module === 'stock')
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const despesasOperacionais = despesasFixas + despesasVariaveis + salarios;
      const resultadoOperacional = lucroBruto - despesasOperacionais;

      const margemBruta = receitaLiquida > 0 ? (lucroBruto / receitaLiquida) * 100 : 0;
      const margemOperacional = receitaLiquida > 0 ? (resultadoOperacional / receitaLiquida) * 100 : 0;

      // Build time series
      const timeBuckets = getTimeBuckets(startDate, endDate, grouping);
      const timeSeries: DRETimeSeries[] = timeBuckets.map(bucket => {
        const bucketStart = format(bucket.start, 'yyyy-MM-dd');
        const bucketEnd = format(bucket.end, 'yyyy-MM-dd');

        const receitas = (inTransactions || [])
          .filter(t => {
            const txDate = t.transaction_date.split('T')[0];
            return txDate >= bucketStart && txDate <= bucketEnd;
          })
          .reduce((sum, t) => sum + Number(t.amount), 0);

        const despesas = (outTransactions || [])
          .filter(t => {
            const txDate = t.transaction_date.split('T')[0];
            return txDate >= bucketStart && txDate <= bucketEnd;
          })
          .reduce((sum, t) => sum + Number(t.amount), 0);

        const cmv = Object.entries(cmvByDate)
          .filter(([date]) => date >= bucketStart && date <= bucketEnd)
          .reduce((sum, [, val]) => sum + val, 0);

        return {
          date: bucketStart,
          label: bucket.label,
          receitas,
          despesas,
          cmv,
          resultado: receitas - despesas - cmv,
        };
      });

      // Category breakdown for expenses
      const sourceModuleLabels: Record<string, string> = {
        expense: 'Despesas Fixas',
        payroll: 'Salários',
        stock: 'Compras/Estoque',
        sales: 'Vendas',
        wallet: 'Carteira',
      };

      const totalDespesas = despesasOperacionais || 1;
      const categoryBreakdown: DRECategoryBreakdown[] = [
        { category: 'Despesas Fixas', sourceModule: 'expense', total: despesasFixas, percentage: (despesasFixas / totalDespesas) * 100 },
        { category: 'Salários', sourceModule: 'payroll', total: salarios, percentage: (salarios / totalDespesas) * 100 },
        { category: 'Compras/Estoque', sourceModule: 'stock', total: despesasVariaveis, percentage: (despesasVariaveis / totalDespesas) * 100 },
      ].filter(c => c.total > 0);

      // Waterfall data
      const waterfallData: DREWaterfallItem[] = [
        { name: 'Receita Bruta', value: receitaBruta },
        { name: 'Deduções', value: -deducoes, isSubtraction: true },
        { name: 'CMV', value: -cmvTotal, isSubtraction: true },
        { name: 'Despesas Op.', value: -despesasOperacionais, isSubtraction: true },
        { name: 'Resultado', value: resultadoOperacional, isTotal: true },
      ];

      // Detailed transactions
      const detailedTransactions: DREDetailedTransaction[] = [
        ...(inTransactions || []).map(t => ({
          id: t.id,
          date: t.transaction_date,
          description: t.description || sourceModuleLabels[t.source_module] || t.source_module,
          amount: Number(t.amount),
          sourceModule: t.source_module,
          paymentMethod: (t.payment_method as { name: string } | null)?.name,
        })),
        ...(outTransactions || []).map(t => ({
          id: t.id,
          date: t.transaction_date,
          description: t.description || sourceModuleLabels[t.source_module] || t.source_module,
          amount: -Number(t.amount),
          sourceModule: t.source_module,
          paymentMethod: (t.payment_method as { name: string } | null)?.name,
        })),
      ].sort((a, b) => b.date.localeCompare(a.date));

      // Top categories (same as categoryBreakdown but sorted)
      const topCategories = [...categoryBreakdown].sort((a, b) => b.total - a.total);

      return {
        receitaBruta,
        receitaVendas,
        receitaCarteira,
        deducoes,
        receitaLiquida,
        cmv: cmvTotal,
        cmvAgua,
        cmvGas,
        cmvOutros,
        lucroBruto,
        despesasOperacionais,
        despesasFixas,
        despesasVariaveis,
        salarios,
        resultadoOperacional,
        margemBruta,
        margemOperacional,
        timeSeries,
        categoryBreakdown,
        waterfallData,
        detailedTransactions,
        topCategories,
      };
    },
  });
}
