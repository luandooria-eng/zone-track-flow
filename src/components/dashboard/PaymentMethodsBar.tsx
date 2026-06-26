import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts';
import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { DollarSign, CreditCard, Hash, Inbox } from 'lucide-react';
import { PaymentMethodData } from '@/hooks/useDashboardData';

const COLORS: Record<string, string> = {
  'pix': 'hsl(152, 56%, 40%)',
  'cash': 'hsl(43, 70%, 52%)',
  'Banknote': 'hsl(43, 70%, 52%)',
  'credit': 'hsl(213, 80%, 49%)',
  'CreditCard': 'hsl(213, 80%, 49%)',
  'debit': 'hsl(280, 60%, 55%)',
  'credit_account': 'hsl(340, 60%, 55%)',
  'Wallet': 'hsl(340, 60%, 55%)',
  'Smartphone': 'hsl(152, 56%, 40%)',
};

interface PaymentMethodsBarProps {
  data: PaymentMethodData[];
}

export function PaymentMethodsBar({ data }: PaymentMethodsBarProps) {
  const [showComparison, setShowComparison] = useState(false);

  const paymentData = data.map(p => ({
    name: p.paymentMethodName,
    value: p.total,
    transactions: p.transactions,
    percentage: Math.round(p.percentage),
    previousValue: 0,
    fill: COLORS[p.type] || 'hsl(var(--primary))',
  }));

  const totalValue = paymentData.reduce((acc, p) => acc + p.value, 0);
  const totalTransactions = paymentData.reduce((acc, p) => acc + p.transactions, 0);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Empty state
  if (paymentData.length === 0) {
    return (
      <div className="kpi-card">
        <div className="mb-4">
          <h3 className="text-lg font-semibold">Formas de Pagamento</h3>
          <p className="text-sm text-muted-foreground">Valor por método de pagamento</p>
        </div>
        
        {/* Summary KPIs - Zerados */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <DollarSign className="h-4 w-4" />
              <span className="text-xs">Total</span>
            </div>
            <p className="text-xl font-bold">R$ 0</p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Hash className="h-4 w-4" />
              <span className="text-xs">Transações</span>
            </div>
            <p className="text-xl font-bold">0</p>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <Inbox className="h-12 w-12 mb-4 opacity-50" />
          <p className="font-medium">Nenhuma venda registrada</p>
          <p className="text-sm">Os dados aparecerão após o primeiro pedido</p>
        </div>
      </div>
    );
  }

  return (
    <div className="kpi-card">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Formas de Pagamento</h3>
          <p className="text-sm text-muted-foreground">Valor por método de pagamento</p>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="comparison"
            checked={showComparison}
            onCheckedChange={setShowComparison}
          />
          <Label htmlFor="comparison" className="text-sm">
            Comparar
          </Label>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="rounded-lg border bg-muted/30 p-3">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <DollarSign className="h-4 w-4" />
            <span className="text-xs">Total</span>
          </div>
          <p className="text-xl font-bold">{formatCurrency(totalValue)}</p>
        </div>
        <div className="rounded-lg border bg-muted/30 p-3">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Hash className="h-4 w-4" />
            <span className="text-xs">Transações</span>
          </div>
          <p className="text-xl font-bold">{totalTransactions}</p>
        </div>
      </div>

      {/* Bar Chart */}
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={paymentData} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
          <XAxis
            type="number"
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
            tickFormatter={(value) => formatCurrency(value)}
          />
          <YAxis
            type="category"
            dataKey="name"
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
            width={80}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            }}
            formatter={(value: number, name: string, props: any) => {
              if (name === 'previousValue') {
                return [formatCurrency(value), 'Período anterior'];
              }
              return [
                `${formatCurrency(value)} (${props.payload.percentage}%)`,
                'Período atual'
              ];
            }}
            labelFormatter={(label) => {
              const item = paymentData.find(p => p.name === label);
              return `${label} - ${item?.transactions} transações`;
            }}
          />
          {showComparison && (
            <Bar
              dataKey="previousValue"
              fill="hsl(var(--muted-foreground))"
              radius={[0, 4, 4, 0]}
              barSize={14}
              name="Período anterior"
            />
          )}
          <Bar
            dataKey="value"
            radius={[0, 4, 4, 0]}
            barSize={showComparison ? 14 : 20}
            name="Período atual"
          >
            {paymentData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Bar>
          {showComparison && <Legend />}
        </BarChart>
      </ResponsiveContainer>

      {/* Detailed List */}
      <div className="mt-4 pt-4 border-t border-border space-y-3">
        {paymentData.map((payment) => (
          <div key={payment.name} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: payment.fill }}
              />
              <span className="text-sm font-medium">{payment.name}</span>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1">
                <CreditCard className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">{payment.transactions}</span>
              </div>
              <div className="w-24 text-right font-semibold">
                {formatCurrency(payment.value)}
              </div>
              <div className="w-12 text-right text-primary font-medium">
                {payment.percentage}%
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
