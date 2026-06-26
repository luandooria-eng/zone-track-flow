import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePortalAuth } from '@/contexts/PortalAuthContext';
import { fetchVouchers } from '@/lib/portalApi';
import { useQuery } from '@tanstack/react-query';
import { PortalLayout } from '@/components/portal/PortalLayout';
import { motion } from 'framer-motion';
import { Ticket, Copy, Share2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function PortalVouchers() {
  const { customer, isAuthenticated, isLoading } = usePortalAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) navigate('/c/login');
  }, [isLoading, isAuthenticated, navigate]);

  const { data: vouchers } = useQuery({
    queryKey: ['portal-vouchers', customer?.id],
    enabled: !!customer?.id,
    queryFn: () => fetchVouchers(customer!.id),
  });

  if (isLoading || !customer) return null;

  const statusMap: Record<string, { label: string; color: string }> = {
    active: { label: 'Ativo', color: 'var(--portal-success)' },
    validated: { label: 'Usado', color: 'var(--portal-muted-foreground)' },
    reversed: { label: 'Estornado', color: 'var(--portal-destructive)' },
  };

  return (
    <PortalLayout>
      <div className="space-y-4">
        <h2 className="text-lg font-bold">Meus Vouchers</h2>

        <div className="space-y-3">
          {!vouchers?.length ? (
            <div className="text-center py-12">
              <Ticket className="h-10 w-10 mx-auto text-[hsl(var(--portal-muted-foreground))] mb-3" />
              <p className="text-sm text-[hsl(var(--portal-muted-foreground))]">Nenhum voucher ainda</p>
              <button onClick={() => navigate('/c/catalogo')} className="text-sm font-medium text-[hsl(var(--portal-primary))] mt-2 hover:underline">
                Resgatar um cupom
              </button>
            </div>
          ) : vouchers.map((v: any, i: number) => {
            const status = statusMap[v.status] || statusMap.active;
            return (
              <motion.div
                key={v.id}
                className="bg-[hsl(var(--portal-card))] rounded-xl border border-[hsl(var(--portal-border))] p-4 shadow-sm"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * i }}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="min-w-0">
                    <p className="text-lg font-mono font-bold tracking-wider">{v.code}</p>
                    <p className="text-xs text-[hsl(var(--portal-muted-foreground))]">{(v as any).coupon?.title}</p>
                  </div>
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded-full shrink-0"
                    style={{ background: `hsl(${status.color} / 0.1)`, color: `hsl(${status.color})` }}
                  >
                    {status.label}
                  </span>
                </div>
                <p className="text-[10px] text-[hsl(var(--portal-muted-foreground))]">
                  Resgatado em {format(new Date(v.redeemed_at), 'dd/MM/yyyy')} · {v.points_spent} pts
                </p>
                {v.status === 'active' && (
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => { navigator.clipboard.writeText(v.code); toast.success('Código copiado!'); }}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[hsl(var(--portal-muted))] text-xs font-medium hover:bg-[hsl(var(--portal-border))] transition-colors"
                    >
                      <Copy className="h-3 w-3" /> Copiar
                    </button>
                    <button
                      onClick={() => {
                        const coupon = (v as any).coupon;
                        const phone = coupon?.whatsapp_phone || '';
                        const msgTemplate = coupon?.whatsapp_message || 'Olá! Resgatei o cupom *{codigo}* do programa de fidelidade. Gostaria de utilizar meu voucher!';
                        const msg = msgTemplate.replace(/\{codigo\}/g, v.code);
                        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`);
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[hsl(var(--portal-muted))] text-xs font-medium hover:bg-[hsl(var(--portal-border))] transition-colors"
                    >
                      <Share2 className="h-3 w-3" /> WhatsApp
                    </button>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </PortalLayout>
  );
}
