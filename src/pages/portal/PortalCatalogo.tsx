import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePortalAuth } from '@/contexts/PortalAuthContext';
import { fetchCoupons } from '@/lib/portalApi';
import { useRedeemCoupon } from '@/hooks/useLoyaltyData';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PortalLayout } from '@/components/portal/PortalLayout';
import { motion, AnimatePresence } from 'framer-motion';
import { Gift, Star, Check, Loader2, Copy, Share2, Filter, Sparkles, Package } from 'lucide-react';
import { toast } from 'sonner';
import { fireRedeemConfetti } from '@/lib/confetti';

const SORT_OPTIONS = [
  { value: 'cost_asc', label: 'Menor custo' },
  { value: 'cost_desc', label: 'Maior custo' },
];

export default function PortalCatalogo() {
  const { customer, isAuthenticated, isLoading, refreshCustomer } = usePortalAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const redeem = useRedeemCoupon();
  const [selectedCoupon, setSelectedCoupon] = useState<any>(null);
  const [redeemedCode, setRedeemedCode] = useState<string | null>(null);
  const [redeemedCoupon, setRedeemedCoupon] = useState<any>(null);
  const [sortBy, setSortBy] = useState('cost_asc');
  const [showAffordable, setShowAffordable] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) navigate('/c/login');
  }, [isLoading, isAuthenticated, navigate]);

  const { data: coupons } = useQuery({
    queryKey: ['portal-coupons'],
    enabled: !!customer?.id,
    queryFn: fetchCoupons,
  });

  if (isLoading || !customer) return null;

  const balance = customer.points_balance ?? 0;

  // Filter & sort
  let filtered = coupons || [];
  if (showAffordable) filtered = filtered.filter((c: any) => balance >= c.points_cost);
  filtered = [...filtered].sort((a: any, b: any) =>
    sortBy === 'cost_asc' ? a.points_cost - b.points_cost : b.points_cost - a.points_cost
  );

  const handleRedeem = async () => {
    if (!selectedCoupon) return;
    try {
      const result = await redeem.mutateAsync({
        customer_id: customer.id,
        coupon_id: selectedCoupon.id,
        points_cost: selectedCoupon.points_cost,
      });
      setRedeemedCode(result.code);
      setRedeemedCoupon(selectedCoupon);
      setSelectedCoupon(null);
      fireRedeemConfetti();
      await refreshCustomer();
      qc.invalidateQueries({ queryKey: ['portal-ledger'] });
      qc.invalidateQueries({ queryKey: ['portal-coupons'] });
    } catch {
      toast.error('Erro ao resgatar cupom');
    }
  };

  return (
    <PortalLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Catálogo</h2>
          <span className="text-sm font-medium flex items-center gap-1 text-[hsl(var(--portal-primary))]">
            <Star className="h-3.5 w-3.5" /> {balance.toLocaleString('pt-BR')} pts
          </span>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowAffordable(!showAffordable)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              showAffordable
                ? 'bg-[hsl(var(--portal-primary))] text-white'
                : 'bg-[hsl(var(--portal-muted))] text-[hsl(var(--portal-muted-foreground))] hover:bg-[hsl(var(--portal-border))]'
            }`}
          >
            <Sparkles className="h-3 w-3" /> Posso resgatar
          </button>
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSortBy(opt.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                sortBy === opt.value
                  ? 'bg-[hsl(var(--portal-primary))] text-white'
                  : 'bg-[hsl(var(--portal-muted))] text-[hsl(var(--portal-muted-foreground))] hover:bg-[hsl(var(--portal-border))]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Redeemed voucher with confetti */}
        <AnimatePresence>
          {redeemedCode && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="p-5 rounded-2xl bg-[hsl(var(--portal-success))/0.08] border-2 border-[hsl(var(--portal-success))] text-center"
            >
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
              >
                <Check className="h-12 w-12 mx-auto text-[hsl(var(--portal-success))] mb-2" />
              </motion.div>
              <motion.p
                className="font-bold text-lg"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                🎉 Cupom Resgatado!
              </motion.p>
              <motion.p
                className="text-2xl font-mono font-bold mt-2 tracking-wider"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                {redeemedCode}
              </motion.p>
              <motion.div
                className="flex gap-2 justify-center mt-3"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <button
                  onClick={() => { navigator.clipboard.writeText(redeemedCode); toast.success('Copiado!'); }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[hsl(var(--portal-card))] border border-[hsl(var(--portal-border))] text-sm font-medium active:scale-95 transition-transform"
                >
                  <Copy className="h-3.5 w-3.5" /> Copiar
                </button>
                <button
                  onClick={() => {
                    const phone = redeemedCoupon?.whatsapp_phone || '';
                    const msgTemplate = redeemedCoupon?.whatsapp_message || 'Olá! Resgatei o cupom *{codigo}* do programa de fidelidade. Gostaria de utilizar meu voucher!';
                    const msg = msgTemplate.replace(/\{codigo\}/g, redeemedCode || '');
                    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`);
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[hsl(var(--portal-card))] border border-[hsl(var(--portal-border))] text-sm font-medium active:scale-95 transition-transform"
                >
                  <Share2 className="h-3.5 w-3.5" /> WhatsApp
                </button>
              </motion.div>
              <button onClick={() => setRedeemedCode(null)} className="text-xs text-[hsl(var(--portal-muted-foreground))] mt-3 hover:underline">
                Fechar
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Coupons Grid */}
        <div className="grid gap-3">
          {!filtered.length ? (
            <p className="text-sm text-[hsl(var(--portal-muted-foreground))] text-center py-8">
              {showAffordable ? 'Nenhum cupom acessível com seu saldo atual' : 'Nenhum cupom disponível no momento'}
            </p>
          ) : filtered.map((coupon: any, i: number) => {
            const canRedeem = balance >= coupon.points_cost;
            const isLowStock = coupon.stock !== null && coupon.stock <= 5 && coupon.stock > 0;
            const isOutOfStock = coupon.stock !== null && coupon.stock <= 0;
            return (
              <motion.div
                key={coupon.id}
                className={`bg-[hsl(var(--portal-card))] rounded-xl border border-[hsl(var(--portal-border))] overflow-hidden shadow-sm ${isOutOfStock ? 'opacity-60' : ''}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * i }}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                {/* Image */}
                {coupon.image_url && (
                  <div className="h-32 w-full overflow-hidden bg-[hsl(var(--portal-muted))]">
                    <img src={coupon.image_url} alt={coupon.title} className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{coupon.title}</p>
                      {coupon.description && (
                        <p className="text-xs text-[hsl(var(--portal-muted-foreground))] mt-0.5 line-clamp-2">{coupon.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[hsl(var(--portal-primary))/0.1] text-[hsl(var(--portal-primary))] text-xs font-bold">
                          <Star className="h-3 w-3" /> {coupon.points_cost}
                        </span>
                        {coupon.stock !== null && (
                          <span className={`inline-flex items-center gap-1 text-[10px] ${
                            isOutOfStock ? 'text-[hsl(var(--portal-destructive))]' : isLowStock ? 'text-[hsl(var(--portal-accent-foreground))]' : 'text-[hsl(var(--portal-muted-foreground))]'
                          }`}>
                            <Package className="h-3 w-3" />
                            {isOutOfStock ? 'Esgotado' : `${coupon.stock} restante${coupon.stock !== 1 ? 's' : ''}`}
                          </span>
                        )}
                        {coupon.expires_at && (
                          <span className="text-[10px] text-[hsl(var(--portal-muted-foreground))]">
                            Até {new Date(coupon.expires_at).toLocaleDateString('pt-BR')}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedCoupon(coupon)}
                      disabled={!canRedeem || isOutOfStock}
                      className={`shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-[0.95] ${
                        canRedeem && !isOutOfStock
                          ? 'bg-[hsl(var(--portal-primary))] text-white hover:brightness-110'
                          : 'bg-[hsl(var(--portal-muted))] text-[hsl(var(--portal-muted-foreground))] cursor-not-allowed'
                      }`}
                    >
                      {isOutOfStock ? 'Esgotado' : 'Resgatar'}
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Confirmation Modal */}
        <AnimatePresence>
          {selectedCoupon && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-black/40 flex items-end sm:items-center justify-center p-4"
              onClick={() => setSelectedCoupon(null)}
            >
              <motion.div
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="bg-[hsl(var(--portal-card))] rounded-2xl p-6 pb-8 w-full max-w-sm shadow-xl mb-16 sm:mb-0"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="text-center mb-5">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
                  >
                    <Gift className="h-10 w-10 mx-auto text-[hsl(var(--portal-accent-foreground))] mb-2" />
                  </motion.div>
                  <h3 className="font-bold text-lg">Confirmar Resgate</h3>
                  <p className="text-sm text-[hsl(var(--portal-muted-foreground))] mt-1">{selectedCoupon.title}</p>
                </div>
                <div className="bg-[hsl(var(--portal-muted))] rounded-xl p-4 mb-5 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Custo</span>
                    <span className="font-bold">{selectedCoupon.points_cost} pts</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Seu saldo</span>
                    <span className="font-bold">{balance.toLocaleString('pt-BR')} pts</span>
                  </div>
                  <div className="border-t border-[hsl(var(--portal-border))] pt-2 flex justify-between text-sm">
                    <span>Saldo após</span>
                    <span className="font-bold text-[hsl(var(--portal-primary))]">
                      {(balance - selectedCoupon.points_cost).toLocaleString('pt-BR')} pts
                    </span>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setSelectedCoupon(null)}
                    className="flex-1 h-11 rounded-xl border border-[hsl(var(--portal-border))] font-medium text-sm hover:bg-[hsl(var(--portal-muted))] transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleRedeem}
                    disabled={redeem.isPending}
                    className="flex-1 h-11 rounded-xl bg-[hsl(var(--portal-primary))] text-white font-semibold text-sm hover:brightness-110 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                  >
                    {redeem.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmar'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PortalLayout>
  );
}
