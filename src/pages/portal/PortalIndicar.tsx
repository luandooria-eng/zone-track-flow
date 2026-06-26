import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePortalAuth } from '@/contexts/PortalAuthContext';
import { useCreateReferral, useCustomerReferrals } from '@/hooks/useLoyaltyReferrals';
import { normalizePhone, formatPhoneDisplay } from '@/lib/portalApi';
import { PortalLayout } from '@/components/portal/PortalLayout';
import { motion } from 'framer-motion';
import { Users2, Send, Loader2, CheckCircle2, Clock } from 'lucide-react';
import { toast } from 'sonner';

export default function PortalIndicar() {
  const { customer, isAuthenticated, isLoading } = usePortalAuth();
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const createReferral = useCreateReferral();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) navigate('/c/login');
  }, [isLoading, isAuthenticated, navigate]);

  const { data: referrals } = useCustomerReferrals(customer?.id);

  if (isLoading || !customer) return null;

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return `(${digits}`;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const handleSubmit = async () => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) { toast.error('Informe um telefone válido'); return; }

    const normalized = normalizePhone(phone);
    if (normalized === customer.phone) {
      toast.error('Você não pode indicar a si mesmo');
      return;
    }

    try {
      const code = await createReferral.mutateAsync({
        referrer_id: customer.id,
        referred_phone: normalized,
        bonus_referrer: 50,
        bonus_referred: 30,
      });
      toast.success(`Indicação enviada! Código: ${code}`);
      setPhone('');
    } catch {
      toast.error('Erro ao criar indicação');
    }
  };

  return (
    <PortalLayout>
      <div className="space-y-5">
        <div>
          <h2 className="text-lg font-bold">Indicar Amigo</h2>
          <p className="text-sm text-[hsl(var(--portal-muted-foreground))] mt-1">
            Indique amigos pelo telefone. Quando eles fizerem a primeira compra, vocês dois ganham pontos!
          </p>
        </div>

        {/* Bonus info */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[hsl(var(--portal-primary))/0.06] rounded-xl p-4 text-center border border-[hsl(var(--portal-primary))/0.15]">
            <p className="text-2xl font-bold text-[hsl(var(--portal-primary))]">+50</p>
            <p className="text-xs text-[hsl(var(--portal-muted-foreground))]">pts para você</p>
          </div>
          <div className="bg-[hsl(var(--portal-accent))/0.08] rounded-xl p-4 text-center border border-[hsl(var(--portal-accent))/0.2]">
            <p className="text-2xl font-bold text-[hsl(var(--portal-accent-foreground))]">+30</p>
            <p className="text-xs text-[hsl(var(--portal-muted-foreground))]">pts para seu amigo</p>
          </div>
        </div>

        {/* Form */}
        <div className="bg-[hsl(var(--portal-card))] rounded-xl border border-[hsl(var(--portal-border))] p-4">
          <label className="text-sm font-medium mb-2 block">Telefone do amigo</label>
          <div className="flex gap-2">
            <input
              type="tel"
              inputMode="numeric"
              placeholder="(00) 00000-0000"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              className="flex-1 h-11 px-4 rounded-xl border border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--portal-primary))] transition-shadow"
            />
            <button
              onClick={handleSubmit}
              disabled={createReferral.isPending || phone.replace(/\D/g, '').length < 10}
              className="h-11 px-4 rounded-xl bg-[hsl(var(--portal-primary))] text-white font-semibold flex items-center gap-2 hover:brightness-110 disabled:opacity-50 transition-all active:scale-[0.97]"
            >
              {createReferral.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4" /> Indicar</>}
            </button>
          </div>
        </div>

        {/* Referrals list */}
        {referrals && referrals.length > 0 && (
          <div>
            <h3 className="font-semibold text-sm mb-3">Suas indicações</h3>
            <div className="bg-[hsl(var(--portal-card))] rounded-xl border border-[hsl(var(--portal-border))] divide-y divide-[hsl(var(--portal-border))]">
              {referrals.map((r: any, i: number) => (
                <motion.div
                  key={r.id}
                  className="flex items-center justify-between px-4 py-3"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.05 * i }}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      r.status === 'completed' ? 'bg-[hsl(var(--portal-success))/0.1]' : 'bg-[hsl(var(--portal-muted))]'
                    }`}>
                      {r.status === 'completed' ? (
                        <CheckCircle2 className="h-4 w-4 text-[hsl(var(--portal-success))]" />
                      ) : (
                        <Clock className="h-4 w-4 text-[hsl(var(--portal-muted-foreground))]" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{formatPhoneDisplay(r.referred_phone)}</p>
                      <p className="text-[10px] text-[hsl(var(--portal-muted-foreground))]">Código: {r.referral_code}</p>
                    </div>
                  </div>
                  <span className={`text-xs font-medium ${
                    r.status === 'completed' ? 'text-[hsl(var(--portal-success))]' : 'text-[hsl(var(--portal-muted-foreground))]'
                  }`}>
                    {r.status === 'completed' ? 'Concluída' : 'Pendente'}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
