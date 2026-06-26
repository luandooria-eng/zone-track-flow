import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLoyaltyCoupons, useRedeemCoupon } from '@/hooks/useLoyaltyData';
import { useCustomerReferrals, useCreateReferral } from '@/hooks/useLoyaltyReferrals';
import { useCustomerLevel, useCustomerBadges, useCustomerMissions, useLoyaltyMissions } from '@/hooks/useLoyaltyGamification';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Star, Gift, Ticket, Share2, Copy, Users2, Trophy, Target, LogOut } from 'lucide-react';
import { format } from 'date-fns';

export default function ClientPortal() {
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [redeemedCode, setRedeemedCode] = useState<string | null>(null);
  const [referralPhone, setReferralPhone] = useState('');

  // Check auth and load customer
  useEffect(() => {
    const loadCustomer = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/portal/login'); return; }

      const { data } = await supabase
        .from('customers')
        .select('*')
        .eq('email', user.email!)
        .maybeSingle();

      if (!data) {
        toast.error('Cadastro de cliente não encontrado.');
        await supabase.auth.signOut();
        navigate('/portal/login');
        return;
      }

      setCustomer(data);
      setIsLoading(false);
    };
    loadCustomer();
  }, [navigate]);

  const customerId = customer?.id;
  const balance = customer?.points_balance ?? 0;

  const { data: coupons } = useLoyaltyCoupons();
  const redeem = useRedeemCoupon();
  const createReferral = useCreateReferral();
  const { data: referrals } = useCustomerReferrals(customerId);
  const { current: currentLevel, next: nextLevel, progress: levelProgress } = useCustomerLevel(balance);
  const { data: badgeAwards } = useCustomerBadges(customerId);
  const { data: missionProgress } = useCustomerMissions(customerId);
  const { data: allMissions } = useLoyaltyMissions();

  const { data: ledger } = useQuery({
    queryKey: ['loyalty-client-ledger', customerId],
    enabled: !!customerId,
    queryFn: async () => {
      const { data } = await supabase
        .from('loyalty_ledger')
        .select('*')
        .eq('customer_id', customerId!)
        .order('created_at', { ascending: false })
        .limit(50);
      return data || [];
    },
  });

  const { data: vouchers } = useQuery({
    queryKey: ['loyalty-client-vouchers', customerId],
    enabled: !!customerId,
    queryFn: async () => {
      const { data } = await supabase
        .from('loyalty_vouchers')
        .select('*, coupon:loyalty_coupons(title)')
        .eq('customer_id', customerId!)
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/portal/login');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-4">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!customer) return null;

  const handleRedeem = async (coupon: any) => {
    if (balance < coupon.points_cost) { toast.error('Saldo insuficiente'); return; }
    try {
      const result = await redeem.mutateAsync({ customer_id: customerId!, coupon_id: coupon.id, points_cost: coupon.points_cost });
      setRedeemedCode(result.code);
      toast.success('Cupom resgatado!');
    } catch { toast.error('Erro ao resgatar'); }
  };

  const copyCode = (code: string) => { navigator.clipboard.writeText(code); toast.success('Código copiado!'); };

  const now = new Date();
  const activeMissions = (allMissions || []).filter((m: any) => m.is_active && new Date(m.starts_at) <= now && new Date(m.ends_at) >= now);
  const progressMap = new Map((missionProgress || []).map((p: any) => [p.mission_id, p]));

  return (
    <div className="min-h-screen bg-background">
      {/* Header with level */}
      <div className="bg-primary text-primary-foreground px-4 py-6">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between">
            <p className="text-sm opacity-80">Olá, {customer.name}!</p>
            <div className="flex items-center gap-2">
              {currentLevel && (
                <Badge className="text-xs" style={{ backgroundColor: (currentLevel as any).color, color: '#222' }}>
                  {(currentLevel as any).icon} {(currentLevel as any).name}
                </Badge>
              )}
              <button onClick={handleSignOut} className="opacity-70 hover:opacity-100 transition-opacity" title="Sair">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-2">
            <Star className="h-8 w-8" />
            <div>
              <p className="text-3xl font-bold">{balance.toLocaleString('pt-BR')}</p>
              <p className="text-xs opacity-80">pontos disponíveis</p>
            </div>
          </div>
          {nextLevel && (
            <div className="mt-3">
              <div className="flex justify-between text-xs opacity-80 mb-1">
                <span>{(currentLevel as any)?.name}</span>
                <span>{(nextLevel as any).name} — {(nextLevel as any).min_points} pts</span>
              </div>
              <Progress value={levelProgress} className="h-2 bg-primary-foreground/20" />
            </div>
          )}
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-6">
        {/* Redeemed voucher */}
        {redeemedCode && (
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            <Card className="border-primary">
              <CardContent className="p-6 text-center">
                <Ticket className="h-10 w-10 mx-auto text-primary mb-2" />
                <p className="text-lg font-bold text-foreground">Voucher Gerado!</p>
                <p className="text-2xl font-mono font-bold text-primary mt-2">{redeemedCode}</p>
                <div className="flex gap-2 justify-center mt-4">
                  <Button size="sm" variant="outline" onClick={() => copyCode(redeemedCode)}><Copy className="h-4 w-4 mr-1" />Copiar</Button>
                  <Button size="sm" variant="outline" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`Meu voucher: ${redeemedCode}`)}`)}><Share2 className="h-4 w-4 mr-1" />WhatsApp</Button>
                </div>
                <Button size="sm" variant="ghost" className="mt-2" onClick={() => setRedeemedCode(null)}>Fechar</Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Badges */}
        {badgeAwards && badgeAwards.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Trophy className="h-4 w-4" />Minhas Conquistas</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {badgeAwards.map((a: any) => (
                  <div key={a.id} className="flex flex-col items-center gap-1 p-2 rounded-lg bg-muted min-w-[70px]">
                    <span className="text-2xl">{(a.badge as any)?.icon}</span>
                    <span className="text-[10px] font-medium text-center">{(a.badge as any)?.name}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Missions */}
        {activeMissions.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Target className="h-4 w-4" />Missões Ativas</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {activeMissions.map((m: any) => {
                const prog = progressMap.get(m.id);
                const current = (prog as any)?.current_value || 0;
                const pct = Math.min(100, (current / m.target_value) * 100);
                const completed = !!(prog as any)?.completed_at;
                return (
                  <div key={m.id} className="p-3 rounded-lg bg-muted">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium">{m.title}</p>
                      {completed ? (
                        <Badge variant="default">✅ Concluída</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">{current}/{m.target_value}</span>
                      )}
                    </div>
                    {m.description && <p className="text-xs text-muted-foreground mb-2">{m.description}</p>}
                    <Progress value={pct} className="h-2" />
                    <p className="text-xs text-primary mt-1 font-medium">Recompensa: +{m.reward_points} pts {m.reward_badge && `+ ${(m.reward_badge as any).icon}`}</p>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Coupons catalog */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Gift className="h-4 w-4" />Resgatar Cupom</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {!coupons?.filter((c: any) => c.is_active).length ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum cupom disponível no momento</p>
            ) : coupons.filter((c: any) => c.is_active).map((c: any) => (
              <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-muted">
                <div>
                  <p className="text-sm font-medium">{c.title}</p>
                  {c.description && <p className="text-xs text-muted-foreground">{c.description}</p>}
                  <Badge className="mt-1">{c.points_cost} pts</Badge>
                </div>
                <Button size="sm" disabled={balance < c.points_cost || redeem.isPending} onClick={() => handleRedeem(c)}>Resgatar</Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Vouchers */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Ticket className="h-4 w-4" />Meus Vouchers</CardTitle></CardHeader>
          <CardContent>
            {!vouchers?.length ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum voucher ainda</p>
            ) : vouchers.map((v: any) => (
              <div key={v.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="text-sm font-medium font-mono">{v.code}</p>
                  <p className="text-xs text-muted-foreground">{(v as any).coupon?.title}</p>
                </div>
                <Badge variant={v.status === 'active' ? 'default' : v.status === 'validated' ? 'secondary' : 'destructive'}>
                  {v.status === 'active' ? 'Ativo' : v.status === 'validated' ? 'Validado' : 'Estornado'}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Referral */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Users2 className="h-4 w-4" />Indicar Amigo</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">Indique um amigo pelo telefone. Quando ele fizer a primeira compra, vocês dois ganham pontos!</p>
            <div className="flex gap-2">
              <Input placeholder="Telefone do amigo" value={referralPhone} onChange={(e) => setReferralPhone(e.target.value)} />
              <Button
                disabled={!referralPhone.trim() || createReferral.isPending}
                onClick={async () => {
                  try {
                    const code = await createReferral.mutateAsync({ referrer_id: customerId!, referred_phone: referralPhone.trim(), bonus_referrer: 50, bonus_referred: 30 });
                    toast.success(`Indicação criada! Código: ${code}`);
                    setReferralPhone('');
                  } catch { toast.error('Erro ao criar indicação'); }
                }}
              >Indicar</Button>
            </div>
            {referrals && referrals.length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Suas indicações:</p>
                {referrals.map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
                    <div>
                      <p className="text-sm">{r.referred_phone}</p>
                      <p className="text-xs text-muted-foreground">Código: {r.referral_code}</p>
                    </div>
                    <Badge variant={r.status === 'completed' ? 'default' : 'outline'}>
                      {r.status === 'completed' ? 'Concluída' : 'Pendente'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Extract */}
        <Card>
          <CardHeader><CardTitle className="text-base">Extrato</CardTitle></CardHeader>
          <CardContent>
            {!ledger?.length ? (
              <p className="text-sm text-muted-foreground text-center py-4">Sem movimentações</p>
            ) : ledger.slice(0, 20).map((e: any) => (
              <div key={e.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="text-xs text-muted-foreground">{format(new Date(e.created_at), 'dd/MM/yyyy HH:mm')}</p>
                  <p className="text-sm">{e.description || e.origin}</p>
                </div>
                <Badge variant={e.type === 'credit' ? 'default' : 'destructive'}>
                  {e.type === 'credit' ? '+' : '-'}{e.points}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
