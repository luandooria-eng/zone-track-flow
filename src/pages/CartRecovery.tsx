import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { format, subDays, startOfDay, endOfDay, startOfYesterday, endOfYesterday, isWithinInterval, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import {
  ShoppingCart, Send, CheckCircle2, MessageCircle, MousePointerClick,
  TrendingUp, DollarSign, Clock, XCircle, Users, RefreshCw, Zap,
  BarChart3, AlertCircle, Lightbulb, Target, Activity,
  ShoppingBag, MessageSquare, Layout, X, CalendarIcon,
  ChevronRight, ArrowUpRight, ArrowDownRight, ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

/* ─── Types ─────────────────────────────────────────────────── */
type Log = {
  id: string;
  status: string;
  customer_name: string | null;
  phone: string | null;
  cart_link: string | null;
  message_sent: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  clicked_at: string | null;
  recovered_at: string | null;
  order_value: number | null;
  error_message: string | null;
  products: { name: string; quantity: number; price: number }[] | null;
};

type QuickFilter = 'today' | 'yesterday' | '7d' | '15d' | '30d' | 'custom' | 'all';

type DateRange = { from: Date; to: Date };

function cartValue(log: Log): number {
  if (!log.products?.length) return 0;
  return log.products.reduce((sum, p) => sum + (p.price ?? 0) * (p.quantity ?? 1), 0);
}

function getDateRange(qf: QuickFilter, custom?: DateRange): DateRange | null {
  const now = new Date();
  if (qf === 'today') return { from: startOfDay(now), to: endOfDay(now) };
  if (qf === 'yesterday') return { from: startOfYesterday(), to: endOfYesterday() };
  if (qf === '7d') return { from: startOfDay(subDays(now, 6)), to: endOfDay(now) };
  if (qf === '15d') return { from: startOfDay(subDays(now, 14)), to: endOfDay(now) };
  if (qf === '30d') return { from: startOfDay(subDays(now, 29)), to: endOfDay(now) };
  if (qf === 'custom' && custom) return { from: startOfDay(custom.from), to: endOfDay(custom.to) };
  return null; // 'all'
}

function getPrevRange(range: DateRange): DateRange {
  const days = Math.round((range.to.getTime() - range.from.getTime()) / 86400000) + 1;
  return { from: startOfDay(subDays(range.from, days)), to: endOfDay(subDays(range.to, days)) };
}

/* sent_at is always set (NOT NULL DEFAULT now()) — it's when the cart was received. */
function logDate(l: Log): Date | null {
  const raw = l.sent_at ?? l.recovered_at ?? l.delivered_at ?? l.read_at ?? l.clicked_at;
  return raw ? new Date(raw) : null;
}

function filterByRange(logs: Log[], range: DateRange | null): Log[] {
  if (!range) return logs;
  return logs.filter(l => {
    const d = logDate(l);
    if (!d) return false;
    return isWithinInterval(d, { start: range.from, end: range.to });
  });
}

/* ─── Date Picker (inline calendar popup) ───────────────────── */
function DatePicker({ value, onChange }: { value: DateRange | undefined; onChange: (r: DateRange) => void }) {
  const [open, setOpen] = useState(false);
  const [picking, setPicking] = useState<{ from?: Date; to?: Date }>({});
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const label = value
    ? isSameDay(value.from, value.to)
      ? format(value.from, 'dd/MM/yyyy', { locale: ptBR })
      : `${format(value.from, 'dd/MM/yy', { locale: ptBR })} – ${format(value.to, 'dd/MM/yy', { locale: ptBR })}`
    : 'Período personalizado';

  const handleDayClick = (day: Date) => {
    if (!picking.from || (picking.from && picking.to)) {
      setPicking({ from: day });
    } else {
      const from = picking.from <= day ? picking.from : day;
      const to = picking.from <= day ? day : picking.from;
      setPicking({ from, to });
      onChange({ from, to });
      setOpen(false);
    }
  };

  const modifiers: any = {};
  const modifiersStyles: any = {};
  if (picking.from) {
    modifiers.selected = picking.from;
    modifiers.rangeStart = picking.from;
    if (picking.to) modifiers.rangeEnd = picking.to;
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { setOpen(o => !o); setPicking(value ? { from: value.from, to: value.to } : {}); }}
        className={cn(
          'flex items-center gap-2 rounded-md border px-3 py-1.5 text-[12px] font-medium transition-all',
          value ? 'border-primary/40 bg-primary/10 text-primary' : 'border hover:bg-muted text-muted-foreground hover:text-foreground'
        )}
      >
        <CalendarIcon className="h-3.5 w-3.5" />
        {label}
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>

      {open && (
        <div className="absolute top-full mt-2 right-0 z-50 rounded-lg border bg-card shadow-xl p-4 min-w-[300px]" style={{ '--rdp-accent-color': '#8b5cf6', '--rdp-background-color': 'rgba(139,92,246,0.15)' } as any}>
          <p className="text-[11px] text-muted-foreground mb-3">
            {!picking.from ? 'Selecione a data inicial' : !picking.to ? 'Selecione a data final' : 'Período selecionado'}
          </p>
          <style>{`
            .rdp { --rdp-cell-size: 34px; margin: 0; }
            .rdp-day { color: #94a3b8; font-size: 12px; border-radius: 6px; }
            .rdp-day:hover { background: rgba(139,92,246,0.2) !important; color: white; }
            .rdp-day_selected, .rdp-day_range_start, .rdp-day_range_end { background: #8b5cf6 !important; color: white !important; }
            .rdp-day_range_middle { background: rgba(139,92,246,0.15) !important; color: #c4b5fd !important; border-radius: 0; }
            .rdp-head_cell { color: #475569; font-size: 11px; font-weight: 600; }
            .rdp-caption_label { color: white; font-size: 13px; font-weight: 700; }
            .rdp-nav_button { color: #64748b; }
            .rdp-nav_button:hover { color: white; background: rgba(255,255,255,0.1); }
            .rdp-day_today:not(.rdp-day_selected) { color: #8b5cf6; font-weight: 700; }
          `}</style>
          <div>
            {Array.from({ length: 5 }, (_, row) => {
              const month = subDays(new Date(), (4 - row) * 30);
              const year = month.getFullYear();
              const mon = month.getMonth();
              const firstDay = new Date(year, mon, 1);
              const days: (Date | null)[] = Array(firstDay.getDay()).fill(null);
              const daysInMonth = new Date(year, mon + 1, 0).getDate();
              for (let d = 1; d <= daysInMonth; d++) days.push(new Date(year, mon, d));
              while (days.length % 7 !== 0) days.push(null);
              return null; // we'll use a simple grid approach instead
            })}
            <SimpleCalendar
              from={picking.from}
              to={picking.to}
              onDayClick={handleDayClick}
            />
          </div>
          {picking.from && picking.to && (
            <div className="mt-3 pt-3 border-t flex justify-between items-center">
              <span className="text-[11px] text-muted-foreground">
                {format(picking.from, 'dd/MM/yy', { locale: ptBR })} → {format(picking.to, 'dd/MM/yy', { locale: ptBR })}
              </span>
              <button onClick={() => { setPicking({}); }} className="text-[11px] text-muted-foreground hover:text-foreground">Limpar</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Simple inline calendar ─────────────────────────────────── */
function SimpleCalendar({ from, to, onDayClick }: { from?: Date; to?: Date; onDayClick: (d: Date) => void }) {
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());

  const WEEK = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
  const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (Date | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(viewYear, viewMonth, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const prevMonth = () => { if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); } else setViewMonth(m => m - 1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); } else setViewMonth(m => m + 1); };

  const isSelected = (d: Date) => (from && isSameDay(d, from)) || (to && isSameDay(d, to));
  const isInRange = (d: Date) => from && to && d > from && d < to;
  const isToday = (d: Date) => isSameDay(d, new Date());

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button onClick={prevMonth} className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <ChevronDown className="h-3.5 w-3.5 rotate-90" />
        </button>
        <span className="text-[13px] font-bold text-foreground">{MONTHS[viewMonth]} {viewYear}</span>
        <button onClick={nextMonth} className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <ChevronDown className="h-3.5 w-3.5 -rotate-90" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {WEEK.map((w, i) => (
          <div key={i} className="text-center text-[10px] text-muted-foreground font-semibold py-1">{w}</div>
        ))}
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const sel = isSelected(d);
          const inRange = isInRange(d);
          const today = isToday(d);
          return (
            <button
              key={i}
              onClick={() => onDayClick(d)}
              className={cn(
                'text-[12px] h-8 w-full rounded-md flex items-center justify-center transition-all',
                sel && 'bg-primary text-primary-foreground font-bold',
                inRange && !sel && 'bg-primary/15 text-primary rounded-none',
                !sel && !inRange && today && 'text-primary font-bold',
                !sel && !inRange && !today && 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Mini sparkline ──────────────────────────────────────────── */
function Sparkline({ data, color }: { data: number[]; color: string }) {
  const pts = data.map((v) => ({ v }));
  return (
    <ResponsiveContainer width="100%" height={52}>
      <AreaChart data={pts} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`sg-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.35} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2}
          fill={`url(#sg-${color})`} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ─── Big KPI card ────────────────────────────────────────────── */
function BigKpi({ label, value, prevValue, color, sparkData, icon, onClick, valueType = 'num' }: {
  label: string; value: number; prevValue: number;
  color: string; sparkData: number[]; icon: React.ReactNode;
  onClick?: () => void; valueType?: 'currency' | 'num' | 'pct' | 'x';
}) {
  const delta = prevValue > 0 ? +((value - prevValue) / prevValue * 100).toFixed(1) : 0;
  const pos = delta >= 0;
  const fmt = (v: number) => {
    if (valueType === 'currency') return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    if (valueType === 'pct') return `${v.toFixed(1)}%`;
    if (valueType === 'x') return `${v.toFixed(1)}x`;
    return v.toLocaleString('pt-BR');
  };
  return (
    <div
      onClick={onClick}
      className={cn(
        'relative overflow-hidden rounded-lg border bg-card p-5 shadow-sm group hover:border-primary/30 transition-all duration-200',
        onClick && 'cursor-pointer hover:shadow-md hover:scale-[1.01]'
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border" style={{ background: color + '18', borderColor: color + '30' }}>
          <span style={{ color }}>{icon}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {onClick && (
            <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">Ver detalhes →</span>
          )}
          {prevValue > 0 && (
            <span className={`flex items-center gap-0.5 text-[12px] font-semibold rounded-md px-2 py-0.5 ${pos ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/15 text-red-600 dark:text-red-400'}`}>
              {pos ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {pos ? '+' : ''}{delta}%
            </span>
          )}
        </div>
      </div>
      <p className="text-2xl font-bold text-foreground tracking-tight">{fmt(value)}</p>
      <p className="text-[12px] text-muted-foreground mt-0.5 font-medium">{label}</p>
      {prevValue > 0 && (
        <p className="text-[11px] text-muted-foreground mt-0.5">Anterior: {fmt(prevValue)}</p>
      )}
      <div className="mt-3 -mx-1">
        <Sparkline data={sparkData} color={color} />
      </div>
    </div>
  );
}

/* ─── Small KPI chip ──────────────────────────────────────────── */
function SmallKpi({ icon, label, value, pct, color }: {
  icon: React.ReactNode; label: string; value: string | number; pct?: string; color: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 hover:border-primary/30 transition-all duration-150">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg shrink-0" style={{ background: color + '18' }}>
        <span style={{ color }} className="[&>*]:h-4 [&>*]:w-4">{icon}</span>
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground font-medium truncate">{label}</p>
        <div className="flex items-baseline gap-1.5">
          <p className="text-[17px] font-bold text-foreground">{value}</p>
          {pct && <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">{pct}</span>}
        </div>
      </div>
    </div>
  );
}

/* ─── Funnel bar ─────────────────────────────────────────────── */
function FunnelBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-[12px] text-muted-foreground w-36 shrink-0">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[12px] font-bold text-foreground w-12 text-right">{count.toLocaleString('pt-BR')}</span>
      <span className="text-[11px] text-muted-foreground w-10 text-right">{pct}%</span>
    </div>
  );
}

/* ─── Custom tooltip ─────────────────────────────────────────── */
function ChartTooltip({ active, payload, label, prefix = '', suffix = '' }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-card px-3 py-2 shadow-lg">
      <p className="text-[11px] text-muted-foreground mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} className="text-[13px] font-bold" style={{ color: p.color ?? 'currentColor' }}>
          {prefix}{typeof p.value === 'number' ? p.value.toLocaleString('pt-BR', { minimumFractionDigits: prefix === 'R$ ' ? 2 : 0, maximumFractionDigits: prefix === 'R$ ' ? 2 : 0 }) : p.value}{suffix}
        </p>
      ))}
    </div>
  );
}

/* ─── Status badge ───────────────────────────────────────────── */
function StatusBadge({ log }: { log: Log }) {
  if (log.recovered_at) return <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 text-[11px] font-semibold px-2 py-0.5">Recuperado</span>;
  if (log.status === 'sent') return <span className="inline-flex items-center gap-1 rounded-md bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/25 text-[11px] font-semibold px-2 py-0.5">Enviado</span>;
  if (log.status === 'test') return <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25 text-[11px] font-semibold px-2 py-0.5">Teste</span>;
  if (log.status === 'pending') return <span className="inline-flex items-center gap-1 rounded-md bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/25 text-[11px] font-semibold px-2 py-0.5">Pendente</span>;
  return <span className="inline-flex items-center gap-1 rounded-md bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/25 text-[11px] font-semibold px-2 py-0.5">Falha</span>;
}

/* ─── Failure reason parser ─────────────────────────────────── */
function parseFailureReason(msg: string | null): string {
  if (!msg) return 'Outro';
  const m = msg.toLowerCase();
  if (m.includes('phone') || m.includes('telefone') || m.includes('invalid number')) return 'Número inválido';
  if (m.includes('whatsapp') || m.includes('not in whatsapp')) return 'Sem WhatsApp';
  if (m.includes('not configured') || m.includes('z-api')) return 'API não configurada';
  if (m.includes('sem telefone') || m.includes('no phone')) return 'Sem telefone';
  if (m.includes('timeout') || m.includes('timed out')) return 'Timeout';
  return 'Outro';
}

/* ─── Heatmap ───────────────────────────────────────────────── */
const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const HOURS = [0, 3, 6, 9, 12, 15, 18, 21];

function SendHeatmap({ logs, onCellClick }: { logs: Log[]; onCellClick?: () => void }) {
  const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const l of logs) {
    if (!l.sent_at) continue;
    const d = new Date(l.sent_at);
    grid[d.getDay()][d.getHours()]++;
  }
  const maxVal = Math.max(...grid.flat(), 1);
  return (
    <div>
      <div className="flex gap-1 mb-1">
        <div className="w-7 shrink-0" />
        {Array.from({ length: 24 }, (_, h) => (
          <div key={h} className="flex-1 text-center text-[9px] text-slate-600">
            {HOURS.includes(h) ? `${h}h` : ''}
          </div>
        ))}
      </div>
      {DAYS.map((day, di) => (
        <div key={day} className="flex gap-1 mb-1">
          <div className="w-7 text-[10px] text-slate-500 flex items-center">{day}</div>
          {Array.from({ length: 24 }, (_, h) => {
            const v = grid[di][h];
            const opacity = v === 0 ? 0.05 : 0.15 + (v / maxVal) * 0.85;
            return (
              <div
                key={h}
                onClick={() => v > 0 && onCellClick?.()}
                className={cn('flex-1 h-4 rounded-[3px] transition-transform', v > 0 && onCellClick && 'cursor-pointer hover:scale-110')}
                style={{ background: `rgba(139, 92, 246, ${opacity})` }}
                title={`${day} ${h}h: ${v} envios`}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

/* ─── Modal shell ───────────────────────────────────────────── */
function Modal({ open, onClose, title, subtitle, children }: {
  open: boolean; onClose: () => void; title: string; subtitle?: string; children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-2xl max-h-[85vh] flex flex-col rounded-lg border bg-card shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-5 border-b shrink-0">
          <div>
            <p className="text-[15px] font-bold text-foreground">{title}</p>
            {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-md border bg-muted/50 text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-5">
          {children}
        </div>
      </div>
    </div>
  );
}

/* ─── Recovered purchases modal ─────────────────────────────── */
function RecoveredModal({ open, onClose, logs }: { open: boolean; onClose: () => void; logs: Log[] }) {
  const recovered = logs.filter(l => l.recovered_at).sort((a, b) =>
    new Date(b.recovered_at!).getTime() - new Date(a.recovered_at!).getTime()
  );
  const totalRevenue = recovered.reduce((s, l) => s + (l.order_value ?? 0), 0);

  return (
    <Modal open={open} onClose={onClose} title="Compras Recuperadas" subtitle={`${recovered.length} compras · ${totalRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} recuperados`}>
      {recovered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-slate-500">
          <ShoppingBag className="h-10 w-10 mb-3 opacity-30" />
          <p className="text-[13px]">Nenhuma compra recuperada ainda</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {recovered.map(l => (
            <div key={l.id} className="rounded-lg border bg-muted/30 p-4 flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-[13px] font-semibold text-foreground truncate">{l.customer_name || 'Cliente'}</p>
                  <span className="text-[10px] text-muted-foreground font-mono shrink-0">{l.phone}</span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span>Carrinho enviado: {l.sent_at ? format(new Date(l.sent_at), 'dd/MM/yy HH:mm') : '—'}</span>
                  <span className="text-emerald-500">→</span>
                  <span>Compra: {l.recovered_at ? format(new Date(l.recovered_at), 'dd/MM/yy HH:mm') : '—'}</span>
                </div>
                {l.products && l.products.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {l.products.map((p, i) => (
                      <span key={i} className="text-[10px] rounded-md bg-muted border px-1.5 py-0.5 text-muted-foreground">
                        {p.name} ×{p.quantity}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="text-[16px] font-bold text-emerald-600 dark:text-emerald-400">
                  {(l.order_value ?? cartValue(l)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
                {l.cart_link && (
                  <a href={l.cart_link} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:text-primary/80">
                    Ver pedido →
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

/* ─── Hour analysis modal ───────────────────────────────────── */
function HourModal({ open, onClose, logs }: { open: boolean; onClose: () => void; logs: Log[] }) {
  const hourStats = useMemo(() => {
    const stats = Array.from({ length: 24 }, (_, h) => ({ hour: h, sent: 0, clicked: 0, recovered: 0 }));
    for (const l of logs) {
      if (!l.sent_at) continue;
      const h = new Date(l.sent_at).getHours();
      stats[h].sent++;
      if (l.clicked_at) stats[h].clicked++;
      if (l.recovered_at) stats[h].recovered++;
    }
    return stats.filter(s => s.sent > 0).map(s => ({
      ...s,
      label: `${String(s.hour).padStart(2, '0')}h`,
      clickRate: s.sent > 0 ? +(s.clicked / s.sent * 100).toFixed(1) : 0,
      recoveryRate: s.sent > 0 ? +(s.recovered / s.sent * 100).toFixed(1) : 0,
    })).sort((a, b) => b.recovered - a.recovered || b.clicked - a.clicked);
  }, [logs]);

  const bestHours = hourStats.filter(h => h.recovered > 0 || h.clickRate > 0).slice(0, 5);

  return (
    <Modal open={open} onClose={onClose} title="Análise de Horários" subtitle="Melhores janelas de envio baseadas em dados reais">
      {hourStats.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-slate-500">
          <Clock className="h-10 w-10 mb-3 opacity-30" />
          <p className="text-[13px]">Dados insuficientes para análise</p>
        </div>
      ) : (
        <div className="space-y-5">
          {bestHours.length > 0 && (
            <div>
              <p className="text-[12px] font-semibold text-foreground mb-2.5">Melhores horários para envio</p>
              <div className="space-y-2">
                {bestHours.map((h, i) => (
                  <div key={h.hour} className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3">
                    <span className="text-[11px] font-bold text-primary w-5">{i + 1}°</span>
                    <span className="text-[14px] font-bold text-foreground w-10">{h.label}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.max(h.clickRate, 5)}%` }} />
                    </div>
                    <div className="flex items-center gap-3 text-[11px] shrink-0">
                      <span className="text-muted-foreground">{h.sent} envios</span>
                      {h.clicked > 0 && <span className="text-orange-500">{h.clicked} cliques ({h.clickRate}%)</span>}
                      {h.recovered > 0 && <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{h.recovered} compras</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div>
            <p className="text-[12px] font-semibold text-foreground mb-2.5">Todos os horários com envios</p>
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-4 py-2.5 text-muted-foreground font-semibold">Hora</th>
                    <th className="text-right px-4 py-2.5 text-muted-foreground font-semibold">Enviados</th>
                    <th className="text-right px-4 py-2.5 text-muted-foreground font-semibold">Cliques</th>
                    <th className="text-right px-4 py-2.5 text-muted-foreground font-semibold">Taxa clique</th>
                    <th className="text-right px-4 py-2.5 text-muted-foreground font-semibold">Compras</th>
                  </tr>
                </thead>
                <tbody>
                  {hourStats.map(h => (
                    <tr key={h.hour} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-2 font-bold text-foreground">{h.label}</td>
                      <td className="px-4 py-2 text-right text-muted-foreground">{h.sent}</td>
                      <td className="px-4 py-2 text-right text-orange-500">{h.clicked}</td>
                      <td className="px-4 py-2 text-right text-orange-500">{h.clickRate}%</td>
                      <td className="px-4 py-2 text-right font-semibold text-emerald-600 dark:text-emerald-400">{h.recovered}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ─── Empty period notice ────────────────────────────────────── */
function EmptyPeriodNotice({ filterLabel, allLogs, onSelectDay, onViewAll }: {
  filterLabel: string;
  allLogs: Log[];
  onSelectDay: (day: Date) => void;
  onViewAll: () => void;
}) {
  /* Build a map of day → count using sent_at */
  const dayCounts = useMemo(() => {
    const map: Record<string, { date: Date; count: number; label: string }> = {};
    for (const l of allLogs) {
      if (!l.sent_at) continue;
      const d = new Date(l.sent_at);
      const key = format(d, 'yyyy-MM-dd');
      if (!map[key]) map[key] = { date: startOfDay(d), count: 0, label: format(d, 'dd/MM/yy', { locale: ptBR }) };
      map[key].count++;
    }
    return Object.values(map).sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [allLogs]);

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/8 p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-[13px] font-semibold text-foreground">
              Nenhum carrinho em <span className="text-amber-600 dark:text-amber-400">{filterLabel}</span>
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              O sistema tem {allLogs.length} carrinhos distribuídos em {dayCounts.length} {dayCounts.length === 1 ? 'dia' : 'dias'}. Clique em um dia abaixo para ver os dados:
            </p>
          </div>
        </div>
        <button
          onClick={onViewAll}
          className="shrink-0 text-[11px] font-semibold text-amber-600 dark:text-amber-400 hover:text-amber-700 border border-amber-500/40 rounded-md px-3 py-1.5 transition-colors whitespace-nowrap"
        >
          Ver tudo
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {dayCounts.map(d => (
          <button
            key={d.label}
            onClick={() => onSelectDay(d.date)}
            className="flex items-center gap-1.5 rounded-md border bg-background hover:bg-muted hover:border-amber-500/40 px-3 py-1.5 transition-all"
          >
            <CalendarIcon className="h-3 w-3 text-muted-foreground" />
            <span className="text-[12px] font-semibold text-foreground">{d.label}</span>
            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">{d.count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── Main page ─────────────────────────────────────────────── */
export default function CartRecovery() {
  const [allLogs, setAllLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [manualApproval, setManualApproval] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'records'>('dashboard');
  const [showRecoveredModal, setShowRecoveredModal] = useState(false);
  const [showHourModal, setShowHourModal] = useState(false);

  /* ─── Date filter state ───────────────────────────────────── */
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('30d');
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [compareEnabled, setCompareEnabled] = useState(false);

  const activeRange = useMemo(() => getDateRange(quickFilter, customRange), [quickFilter, customRange]);
  const prevRange = useMemo(() => activeRange ? getPrevRange(activeRange) : null, [activeRange]);

  /* Load all records once — filtering happens client-side */
  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: logsData }, { data: config }] = await Promise.all([
      (supabase.from('cart_recovery_logs' as any) as any)
        .select('*')
        .order('sent_at', { ascending: false })
        .limit(3000),
      (supabase.from('cart_recovery_config' as any) as any)
        .select('manual_approval')
        .eq('id', '00000000-0000-0000-0000-000000000098')
        .maybeSingle(),
    ]);
    setAllLogs((logsData as Log[]) ?? []);
    setManualApproval((config as any)?.manual_approval ?? false);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  /* Client-side filter using best available date per record */
  const filteredLogs = useMemo(() => filterByRange(allLogs, activeRange), [allLogs, activeRange]);
  const prevLogs = useMemo(() => compareEnabled && prevRange ? filterByRange(allLogs, prevRange) : [], [allLogs, prevRange, compareEnabled]);

  const toggleManualApproval = async () => {
    const newVal = !manualApproval;
    setManualApproval(newVal);
    await supabase.from('cart_recovery_config' as any).update({ manual_approval: newVal }).eq('id', '00000000-0000-0000-0000-000000000098');
    toast.success(newVal ? 'Aprovação manual ativada' : 'Envio automático ativado');
  };

  const sendNow = async (log: Log) => {
    setSendingId(log.id);
    try {
      // Reset to pending so cart-recovery-send accepts it
      if (log.status !== 'pending') {
        await (supabase.from('cart_recovery_logs' as any) as any)
          .update({ status: 'pending', error_message: null })
          .eq('id', log.id);
      }
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cart-recovery-send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ log_id: log.id }),
      });
      const result = await res.json();
      if (result.ok && result.status === 'sent') {
        setAllLogs(prev => prev.map(l => l.id === log.id ? { ...l, status: 'sent' } : l));
        toast.success('Mensagem enviada!');
      } else toast.error(result.error ?? 'Erro ao enviar');
    } catch (e) { toast.error(`Erro: ${e}`); }
    finally { setSendingId(null); }
  };

  /* ─── KPI computation helper ──────────────────────────────── */
  const computeKpis = (ls: Log[]) => {
    const total = ls.length;
    const sent = ls.filter(l => ['sent', 'test'].includes(l.status)).length;
    const failed = ls.filter(l => l.status === 'failed').length;
    const pending = ls.filter(l => l.status === 'pending').length;
    const delivered = ls.filter(l => l.delivered_at).length;
    const read = ls.filter(l => l.read_at).length;
    const clicked = ls.filter(l => l.clicked_at).length;
    const recovered = ls.filter(l => l.recovered_at).length;
    const revenue = ls.reduce((a, l) => a + (l.order_value ?? 0), 0);
    const totalCartValue = ls.reduce((a, l) => a + cartValue(l), 0);
    const unique = new Set(ls.map(l => l.phone).filter(Boolean)).size;
    const recoveryRate = sent > 0 ? (recovered / sent) * 100 : 0;
    const avgTicket = recovered > 0 ? revenue / recovered : 0;
    const potential = totalCartValue > 0 ? totalCartValue - revenue : failed * avgTicket;
    const roi = revenue > 0 ? revenue / Math.max(revenue * 0.05, 1) : 0;
    return { total, sent, failed, pending, delivered, read, clicked, recovered, revenue, unique, recoveryRate, avgTicket, potential, roi };
  };

  const kpis = useMemo(() => computeKpis(filteredLogs), [filteredLogs]);
  const prevKpis = useMemo(() => computeKpis(prevLogs), [prevLogs]);

  /* Time series for charts — span of current range */
  const timeSeries = useMemo(() => {
    const rangeLen = activeRange
      ? Math.max(1, Math.round((activeRange.to.getTime() - activeRange.from.getTime()) / 86400000) + 1)
      : 14;
    const spanDays = Math.min(rangeLen, 60);
    const days: Record<string, { date: string; revenue: number; compras: number; prevRevenue: number; prevCompras: number }> = {};
    for (let i = spanDays - 1; i >= 0; i--) {
      const base = activeRange ? activeRange.to : new Date();
      const d = format(subDays(base, i), 'dd/MM');
      days[d] = { date: d, revenue: 0, compras: 0, prevRevenue: 0, prevCompras: 0 };
    }
    for (const l of filteredLogs) {
      const raw = l.sent_at;
      if (!raw) continue;
      const d = format(new Date(raw), 'dd/MM');
      if (days[d]) {
        days[d].revenue += l.recovered_at ? (l.order_value ?? 0) : 0;
        days[d].compras += l.recovered_at ? 1 : 0;
      }
    }
    if (compareEnabled) {
      const offset = activeRange ? Math.round((activeRange.to.getTime() - activeRange.from.getTime()) / 86400000) + 1 : 14;
      for (const l of prevLogs) {
        const raw = l.sent_at;
        if (!raw) continue;
        const shiftedDate = new Date(new Date(raw).getTime() + offset * 86400000);
        const shiftedKey = format(shiftedDate, 'dd/MM');
        if (days[shiftedKey]) {
          days[shiftedKey].prevRevenue += l.recovered_at ? (l.order_value ?? 0) : 0;
          days[shiftedKey].prevCompras += l.recovered_at ? 1 : 0;
        }
      }
    }
    return Object.values(days);
  }, [filteredLogs, prevLogs, activeRange, compareEnabled]);

  const sparkRevenue = timeSeries.map(d => d.revenue);
  const sparkCompras = timeSeries.map(d => d.compras);
  const sparkRate = timeSeries.map(d => d.compras);
  const sparkRoi = timeSeries.map(d => d.revenue * 0.95);

  /* Failure reasons */
  const failureReasons = useMemo(() => {
    const map: Record<string, number> = {};
    for (const l of filteredLogs.filter(l => l.status === 'failed')) {
      const r = parseFailureReason(l.error_message);
      map[r] = (map[r] ?? 0) + 1;
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, value]) => ({ name, value }));
  }, [filteredLogs]);

  const FAILURE_COLORS = ['#f43f5e', '#f97316', '#eab308', '#8b5cf6', '#6b7280'];

  const fmtCur = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const fmtNum = (v: number) => v.toLocaleString('pt-BR');

  /* Best hour insight */
  const bestHour = useMemo(() => {
    const hours: number[] = Array(24).fill(0);
    for (const l of filteredLogs) {
      if (l.sent_at && l.clicked_at) hours[new Date(l.sent_at).getHours()]++;
    }
    return hours.indexOf(Math.max(...hours));
  }, [filteredLogs]);

  const now = format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR });

  /* Date filter label */
  const filterLabel = useMemo(() => {
    if (!activeRange) return 'Todo o período';
    if (isSameDay(activeRange.from, activeRange.to)) return format(activeRange.from, "dd/MM/yyyy", { locale: ptBR });
    return `${format(activeRange.from, 'dd/MM/yy', { locale: ptBR })} – ${format(activeRange.to, 'dd/MM/yy', { locale: ptBR })}`;
  }, [activeRange]);

  const QUICK_OPTS: { key: QuickFilter; label: string }[] = [
    { key: 'today', label: 'Hoje' },
    { key: 'yesterday', label: 'Ontem' },
    { key: '7d', label: '7 dias' },
    { key: '15d', label: '15 dias' },
    { key: '30d', label: '30 dias' },
    { key: 'all', label: 'Tudo' },
  ];

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
            <ShoppingCart className="h-4 w-4 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-foreground">Recuperação de Carrinho</h1>
            </div>
            <p className="text-sm text-muted-foreground">{filterLabel}</p>
          </div>
        </div>

        {/* ── Date filters ─────────────────────────────────── */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {QUICK_OPTS.map(opt => (
            <button
              key={opt.key}
              onClick={() => { setQuickFilter(opt.key); if (opt.key !== 'custom') setCustomRange(undefined); }}
              className={cn(
                'px-3 py-1.5 rounded-md text-[12px] font-medium transition-all border',
                quickFilter === opt.key && opt.key !== 'custom'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border hover:bg-muted text-muted-foreground hover:text-foreground'
              )}
            >
              {opt.label}
            </button>
          ))}

          <DatePicker
            value={customRange}
            onChange={(r) => { setCustomRange(r); setQuickFilter('custom'); }}
          />

          {activeRange && (
            <button
              onClick={() => setCompareEnabled(c => !c)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium border transition-all',
                compareEnabled
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border hover:bg-muted text-muted-foreground hover:text-foreground'
              )}
            >
              <Activity className="h-3 w-3" />
              Comparar
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Tab switcher */}
          <div className="flex rounded-md border bg-muted p-0.5">
            <button onClick={() => setActiveTab('dashboard')} className={cn('px-3 py-1.5 rounded-sm text-[12px] font-medium transition-all', activeTab === 'dashboard' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
              <BarChart3 className="h-3.5 w-3.5 inline mr-1.5" />Dashboard
            </button>
            <button onClick={() => setActiveTab('records')} className={cn('px-3 py-1.5 rounded-sm text-[12px] font-medium transition-all', activeTab === 'records' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
              <Layout className="h-3.5 w-3.5 inline mr-1.5" />Registros
            </button>
          </div>
          {/* Auto/Manual toggle */}
          <button
            onClick={toggleManualApproval}
            className={cn('flex items-center gap-2 rounded-md border px-3 py-1.5 text-[12px] font-medium transition-all',
              manualApproval ? 'border-orange-500/40 bg-orange-500/10 text-orange-600 dark:text-orange-400' : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400')}
          >
            <Zap className="h-3 w-3" />
            {manualApproval ? 'Manual' : 'Auto'}
            <div className={cn('relative inline-flex h-4 w-7 items-center rounded-full transition-colors', manualApproval ? 'bg-orange-500' : 'bg-emerald-500')}>
              <span className={cn('inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform', manualApproval ? 'translate-x-3.5' : 'translate-x-0.5')} />
            </div>
          </button>
          <button onClick={load} disabled={loading} className="flex h-8 w-8 items-center justify-center rounded-md border bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Compare banner */}
      {compareEnabled && prevRange && (
        <div className="rounded-md border bg-muted/50 px-4 py-2 flex items-center gap-3 text-[11px]">
          <span className="text-muted-foreground">Comparando com:</span>
          <span className="text-primary font-semibold">
            {format(prevRange.from, 'dd/MM/yy', { locale: ptBR })} – {format(prevRange.to, 'dd/MM/yy', { locale: ptBR })}
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">{prevLogs.length} registros no período anterior</span>
        </div>
      )}

      {/* ── Empty period notice with days-with-data ─────────── */}
      {!loading && activeRange && filteredLogs.length === 0 && allLogs.length > 0 && (
        <EmptyPeriodNotice
          filterLabel={filterLabel}
          allLogs={allLogs}
          onSelectDay={(day) => {
            setCustomRange({ from: day, to: day });
            setQuickFilter('custom');
          }}
          onViewAll={() => setQuickFilter('all')}
        />
      )}

      {activeTab === 'dashboard' ? (
        <div className="space-y-4 w-full">

          {/* ── Big KPIs ──────────────────────────────────────── */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <BigKpi
              label="Receita Recuperada" value={kpis.revenue} prevValue={compareEnabled ? prevKpis.revenue : 0}
              color="#8b5cf6" sparkData={sparkRevenue} icon={<DollarSign className="h-4 w-4" />}
              onClick={() => setShowRecoveredModal(true)} valueType="currency"
            />
            <BigKpi
              label="Compras Recuperadas" value={kpis.recovered} prevValue={compareEnabled ? prevKpis.recovered : 0}
              color="#3b82f6" sparkData={sparkCompras} icon={<ShoppingBag className="h-4 w-4" />}
              onClick={() => setShowRecoveredModal(true)} valueType="num"
            />
            <BigKpi
              label="Taxa de Recuperação" value={kpis.recoveryRate} prevValue={compareEnabled ? prevKpis.recoveryRate : 0}
              color="#10b981" sparkData={sparkRate} icon={<TrendingUp className="h-4 w-4" />}
              onClick={() => setShowRecoveredModal(true)} valueType="pct"
            />
            <BigKpi
              label="ROI Estimado" value={kpis.roi} prevValue={compareEnabled ? prevKpis.roi : 0}
              color="#f59e0b" sparkData={sparkRoi} icon={<Activity className="h-4 w-4" />}
              valueType="x"
            />
          </div>

          {/* ── Small KPIs ────────────────────────────────────── */}
          <div className="grid grid-cols-4 xl:grid-cols-8 gap-2.5">
            <SmallKpi icon={<ShoppingCart />} label="Carrinhos" value={fmtNum(kpis.total)} color="#8b5cf6" />
            <SmallKpi icon={<Users />} label="Clientes únicos" value={fmtNum(kpis.unique)} color="#3b82f6" />
            <SmallKpi icon={<Send />} label="Enviadas" value={fmtNum(kpis.sent)} color="#06b6d4" />
            <SmallKpi icon={<CheckCircle2 />} label="Entregues" value={fmtNum(kpis.delivered)} pct={kpis.sent > 0 ? `${Math.round(kpis.delivered/Math.max(kpis.sent,1)*100)}%` : ''} color="#10b981" />
            <SmallKpi icon={<MessageCircle />} label="Lidas" value={fmtNum(kpis.read)} pct={kpis.sent > 0 ? `${Math.round(kpis.read/Math.max(kpis.sent,1)*100)}%` : ''} color="#a855f7" />
            <SmallKpi icon={<MousePointerClick />} label="Cliques" value={fmtNum(kpis.clicked)} pct={kpis.sent > 0 ? `${Math.round(kpis.clicked/Math.max(kpis.sent,1)*100)}%` : ''} color="#f97316" />
            <SmallKpi icon={<XCircle />} label="Falhas" value={fmtNum(kpis.failed)} color="#f43f5e" />
            <SmallKpi icon={<Clock />} label="Aguardando" value={fmtNum(kpis.pending)} color="#eab308" />
          </div>

          {/* ── Charts row ────────────────────────────────────── */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            {/* Revenue area chart */}
            <div className="xl:col-span-1 rounded-lg border bg-card p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-[13px] font-bold text-foreground">Receita Recuperada</p>
                  <p className="text-[11px] text-muted-foreground">{filterLabel}</p>
                </div>
                {compareEnabled && <span className="text-[10px] text-primary border border-primary/30 bg-primary/10 rounded-md px-1.5 py-0.5">Comparando</span>}
              </div>
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={timeSeries} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="prevRevGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={v => v > 0 ? `R$${v}` : ''} />
                  <Tooltip content={<ChartTooltip prefix="R$ " />} />
                  <Area type="monotone" dataKey="revenue" stroke="#8b5cf6" strokeWidth={2} fill="url(#revGrad)" dot={false} />
                  {compareEnabled && <Area type="monotone" dataKey="prevRevenue" stroke="#22d3ee" strokeWidth={1.5} strokeDasharray="4 2" fill="url(#prevRevGrad)" dot={false} />}
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Purchases bar chart */}
            <div className="xl:col-span-1 rounded-lg border bg-card p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-[13px] font-bold text-foreground">Compras Recuperadas</p>
                  <p className="text-[11px] text-muted-foreground">{filterLabel}</p>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={timeSeries} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="compras" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  {compareEnabled && <Bar dataKey="prevCompras" fill="#22d3ee" opacity={0.5} radius={[4, 4, 0, 0]} />}
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Funnel */}
            <div className="xl:col-span-1 rounded-lg border bg-card p-5">
              <p className="text-[13px] font-bold text-foreground mb-1">Conversão por Etapa</p>
              <p className="text-[11px] text-muted-foreground mb-4">Do carrinho à compra</p>
              <div className="space-y-3">
                <FunnelBar label="Carrinhos Recebidos" count={kpis.total} total={kpis.total} color="#8b5cf6" />
                <FunnelBar label="Mensagens Enviadas" count={kpis.sent} total={kpis.total} color="#3b82f6" />
                <FunnelBar label="Entregues" count={kpis.delivered} total={kpis.total} color="#06b6d4" />
                <FunnelBar label="Lidas" count={kpis.read} total={kpis.total} color="#a855f7" />
                <FunnelBar label="Cliques no Link" count={kpis.clicked} total={kpis.total} color="#f97316" />
                <FunnelBar label="Compras" count={kpis.recovered} total={kpis.total} color="#10b981" />
              </div>
            </div>
          </div>

          {/* ── Bottom row ────────────────────────────────────── */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            {/* Heatmap */}
            <div
              className="rounded-lg border bg-card p-5 cursor-pointer hover:border-primary/30 transition-all group"
              onClick={() => setShowHourModal(true)}
            >
              <div className="flex items-center justify-between mb-1">
                <p className="text-[13px] font-bold text-foreground">Melhor Horário para Envio</p>
                <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">Ver análise →</span>
              </div>
              <p className="text-[11px] text-muted-foreground mb-4">Baseado na taxa de conversão · clique para detalhes</p>
              <SendHeatmap logs={filteredLogs} onCellClick={() => setShowHourModal(true)} />
            </div>

            {/* Insights */}
            <div className="rounded-lg border bg-card p-5">
              <p className="text-[13px] font-bold text-foreground mb-1">Insights Inteligentes</p>
              <p className="text-[11px] text-muted-foreground mb-4">Análise automática dos seus dados</p>
              <div className="space-y-3">
                {kpis.revenue > 0 && (
                  <div className="flex gap-3 rounded-lg bg-emerald-500/8 border border-emerald-500/20 p-3">
                    <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[12px] font-semibold text-foreground">Receita recuperada: {fmtCur(kpis.revenue)}</p>
                      <p className="text-[11px] text-muted-foreground">Continue assim, os resultados são positivos.</p>
                    </div>
                  </div>
                )}
                {kpis.failed > 0 && (
                  <div className="flex gap-3 rounded-lg bg-red-500/8 border border-red-500/20 p-3">
                    <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[12px] font-semibold text-foreground">{kpis.failed} mensagens falharam</p>
                      <p className="text-[11px] text-muted-foreground">Verifique configuração Z-API e telefones.</p>
                    </div>
                  </div>
                )}
                {bestHour >= 0 && (
                  <button
                    onClick={() => setShowHourModal(true)}
                    className="w-full text-left flex gap-3 rounded-lg bg-primary/5 border border-primary/20 p-3 hover:bg-primary/10 transition-colors group"
                  >
                    <Clock className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-[12px] font-semibold text-foreground">Melhor horário: {bestHour}h às {bestHour + 2}h</p>
                      <p className="text-[11px] text-muted-foreground">Maior taxa de cliques nesse período.</p>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary mt-0.5 transition-colors" />
                  </button>
                )}
                {kpis.potential > 0 && (
                  <div className="flex gap-3 rounded-lg bg-amber-500/8 border border-amber-500/20 p-3">
                    <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[12px] font-semibold text-foreground">Potencial: {fmtCur(kpis.potential)}</p>
                      <p className="text-[11px] text-muted-foreground">Carrinhos com falha ainda recuperáveis.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Failures donut */}
            <div className="rounded-lg border bg-card p-5">
              <p className="text-[13px] font-bold text-foreground mb-1">Falhas por Motivo</p>
              <p className="text-[11px] text-muted-foreground mb-4">{kpis.failed} falhas no total</p>
              {failureReasons.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                  <CheckCircle2 className="h-8 w-8 mb-2 text-emerald-500/40" />
                  <p className="text-[12px]">Nenhuma falha registrada</p>
                </div>
              ) : (
                <div className="flex gap-4 items-center">
                  <PieChart width={100} height={100}>
                    <Pie data={failureReasons} cx={45} cy={45} innerRadius={28} outerRadius={45} dataKey="value" paddingAngle={2}>
                      {failureReasons.map((_, i) => (
                        <Cell key={i} fill={FAILURE_COLORS[i % FAILURE_COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                  <div className="flex-1 space-y-1.5">
                    {failureReasons.map((r, i) => (
                      <div key={r.name} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <div className="h-2 w-2 rounded-full shrink-0" style={{ background: FAILURE_COLORS[i % FAILURE_COLORS.length] }} />
                          <span className="text-[11px] text-foreground truncate max-w-[110px]">{r.name}</span>
                        </div>
                        <span className="text-[11px] font-bold text-foreground shrink-0">{r.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Footer metrics ────────────────────────────────── */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            {[
              { icon: <DollarSign className="h-4 w-4" />, label: 'Valor Total Carrinhos', value: fmtCur(filteredLogs.reduce((a,l)=>a+cartValue(l),0)), sub: 'Soma de todos os carrinhos', color: '#8b5cf6' },
              { icon: <Target className="h-4 w-4" />, label: 'Ticket Médio Recuperado', value: fmtCur(kpis.avgTicket), sub: 'Por compra', color: '#3b82f6' },
              { icon: <Clock className="h-4 w-4" />, label: 'Aguardando Envio', value: fmtNum(kpis.pending), sub: 'Carrinhos pendentes', color: '#eab308' },
              { icon: <MessageSquare className="h-4 w-4" />, label: 'Taxa de Clique', value: kpis.sent > 0 ? `${((kpis.clicked / kpis.sent) * 100).toFixed(1)}%` : '0%', sub: 'Cliques / Enviados', color: '#10b981' },
            ].map(m => (
              <div key={m.label} className="rounded-lg border bg-card p-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg shrink-0" style={{ background: m.color + '18', border: `1px solid ${m.color}30` }}>
                  <span style={{ color: m.color }}>{m.icon}</span>
                </div>
                <div>
                  <p className="text-[18px] font-bold text-foreground">{m.value}</p>
                  <p className="text-[11px] font-medium text-muted-foreground">{m.label}</p>
                  <p className="text-[10px] text-muted-foreground/60">{m.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* ── Records tab ─────────────────────────────────────── */
        <div className="w-full">
          <div className="rounded-lg border bg-card overflow-hidden">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <div>
                <p className="text-[14px] font-bold text-foreground">Todos os Registros</p>
                <p className="text-[11px] text-muted-foreground">{filteredLogs.length} carrinhos · {filterLabel}</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {['Status', 'Cliente', 'Telefone', 'Valor', 'Entregue', 'Lida', 'Clique', 'Link', 'Data', ''].map(h => (
                      <TableHead key={h} className="text-[11px] font-semibold py-3">{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={9} className="text-center py-16 text-muted-foreground">
                      <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" />carregando...
                    </TableCell></TableRow>
                  ) : filteredLogs.map(l => (
                    <TableRow key={l.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="py-3"><StatusBadge log={l} /></TableCell>
                      <TableCell className="py-3 text-[13px] font-semibold text-foreground">{l.customer_name || '—'}</TableCell>
                      <TableCell className="py-3 text-[12px] font-mono text-muted-foreground">{l.phone || '—'}</TableCell>
                      <TableCell className="py-3">
                        {cartValue(l) > 0
                          ? <span className="text-[12px] font-semibold text-emerald-600 dark:text-emerald-400">{cartValue(l).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                          : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="py-3 text-center">{l.delivered_at ? <span className="text-indigo-600 dark:text-indigo-400 font-bold" title={format(new Date(l.delivered_at), 'dd/MM HH:mm')}>✓</span> : <span className="text-muted-foreground/30">—</span>}</TableCell>
                      <TableCell className="py-3 text-center">{l.read_at ? <span className="text-blue-600 dark:text-blue-400 font-bold" title={format(new Date(l.read_at), 'dd/MM HH:mm')}>✓✓</span> : <span className="text-muted-foreground/30">—</span>}</TableCell>
                      <TableCell className="py-3 text-center">{l.clicked_at ? <span title={format(new Date(l.clicked_at), 'dd/MM HH:mm')}>🔗</span> : <span className="text-muted-foreground/30">—</span>}</TableCell>
                      <TableCell className="py-3">{l.cart_link ? <a href={l.cart_link} target="_blank" rel="noopener noreferrer" className="text-[12px] text-primary hover:text-primary/80 font-medium">Abrir →</a> : <span className="text-muted-foreground/30">—</span>}</TableCell>
                      <TableCell className="py-3 text-[12px] text-muted-foreground">{l.sent_at ? format(new Date(l.sent_at), 'dd/MM/yy HH:mm') : '—'}</TableCell>
                      <TableCell className="py-3">
                        {l.phone && (
                          <button onClick={() => sendNow(l)} disabled={sendingId === l.id}
                            className="flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 text-[11px] font-semibold px-2.5 py-1 transition-all disabled:opacity-50">
                            <Send className="h-3 w-3" />
                            {sendingId === l.id ? '...' : l.status === 'pending' ? 'Enviar' : 'Reenviar'}
                          </button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      )}

      <RecoveredModal open={showRecoveredModal} onClose={() => setShowRecoveredModal(false)} logs={filteredLogs} />
      <HourModal open={showHourModal} onClose={() => setShowHourModal(false)} logs={filteredLogs} />
    </div>
  );
}
