import { useState } from 'react';
import {
  useLoyaltyLevels, useUpsertLevel,
  useLoyaltyBadges, useUpsertBadge,
  useLoyaltyMissions, useUpsertMission,
} from '@/hooks/useLoyaltyGamification';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Trophy, Star, Target, Plus, Pencil } from 'lucide-react';

export default function LoyaltyGamification() {
  const { data: levels, isLoading: loadingLevels } = useLoyaltyLevels();
  const { data: badges, isLoading: loadingBadges } = useLoyaltyBadges();
  const { data: missions, isLoading: loadingMissions } = useLoyaltyMissions();
  const upsertLevel = useUpsertLevel();
  const upsertBadge = useUpsertBadge();
  const upsertMission = useUpsertMission();

  const [levelDialog, setLevelDialog] = useState<any>(null);
  const [badgeDialog, setBadgeDialog] = useState<any>(null);
  const [missionDialog, setMissionDialog] = useState<any>(null);

  const handleSaveLevel = async () => {
    if (!levelDialog) return;
    try {
      await upsertLevel.mutateAsync(levelDialog);
      toast.success('Nível salvo!');
      setLevelDialog(null);
    } catch { toast.error('Erro ao salvar nível'); }
  };

  const handleSaveBadge = async () => {
    if (!badgeDialog) return;
    try {
      await upsertBadge.mutateAsync(badgeDialog);
      toast.success('Badge salvo!');
      setBadgeDialog(null);
    } catch { toast.error('Erro ao salvar badge'); }
  };

  const handleSaveMission = async () => {
    if (!missionDialog) return;
    try {
      await upsertMission.mutateAsync(missionDialog);
      toast.success('Missão salva!');
      setMissionDialog(null);
    } catch { toast.error('Erro ao salvar missão'); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Trophy className="h-6 w-6 text-primary" /> Gamificação
        </h1>
        <p className="text-sm text-muted-foreground">Níveis, badges e missões do programa de fidelidade</p>
      </div>

      <Tabs defaultValue="levels">
        <TabsList>
          <TabsTrigger value="levels"><Star className="h-4 w-4 mr-1" /> Níveis</TabsTrigger>
          <TabsTrigger value="badges"><Trophy className="h-4 w-4 mr-1" /> Badges</TabsTrigger>
          <TabsTrigger value="missions"><Target className="h-4 w-4 mr-1" /> Missões</TabsTrigger>
        </TabsList>

        {/* ── Levels ── */}
        <TabsContent value="levels">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Níveis do Programa</CardTitle>
              <Button size="sm" onClick={() => setLevelDialog({ name: '', min_points: 0, icon: '⭐', color: '#CD7F32', benefits: '', sort_order: (levels?.length || 0) + 1, is_active: true })}>
                <Plus className="h-4 w-4 mr-1" /> Novo Nível
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ícone</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Pontos Mín.</TableHead>
                    <TableHead>Benefícios</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingLevels ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando…</TableCell></TableRow>
                  ) : !levels?.length ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum nível cadastrado</TableCell></TableRow>
                  ) : levels.map((l: any) => (
                    <TableRow key={l.id}>
                      <TableCell className="text-2xl">{l.icon}</TableCell>
                      <TableCell className="font-medium">{l.name}</TableCell>
                      <TableCell>{l.min_points.toLocaleString('pt-BR')}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{l.benefits}</TableCell>
                      <TableCell><Badge variant={l.is_active ? 'default' : 'secondary'}>{l.is_active ? 'Ativo' : 'Inativo'}</Badge></TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" onClick={() => setLevelDialog(l)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Badges ── */}
        <TabsContent value="badges">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Badges / Conquistas</CardTitle>
              <Button size="sm" onClick={() => setBadgeDialog({ name: '', description: '', icon: '🏆', condition_type: 'manual', condition_value: 0, is_active: true })}>
                <Plus className="h-4 w-4 mr-1" /> Novo Badge
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ícone</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingBadges ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando…</TableCell></TableRow>
                  ) : !badges?.length ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum badge cadastrado</TableCell></TableRow>
                  ) : badges.map((b: any) => (
                    <TableRow key={b.id}>
                      <TableCell className="text-2xl">{b.icon}</TableCell>
                      <TableCell className="font-medium">{b.name}</TableCell>
                      <TableCell className="text-sm">
                        {b.condition_type === 'manual' ? 'Manual' : b.condition_type === 'total_points' ? 'Total de Pontos' : b.condition_type === 'purchase_count' ? 'Nº Compras' : b.condition_type === 'referral_count' ? 'Indicações' : b.condition_type}
                      </TableCell>
                      <TableCell>{b.condition_value}</TableCell>
                      <TableCell><Badge variant={b.is_active ? 'default' : 'secondary'}>{b.is_active ? 'Ativo' : 'Inativo'}</Badge></TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" onClick={() => setBadgeDialog(b)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Missions ── */}
        <TabsContent value="missions">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Missões</CardTitle>
              <Button size="sm" onClick={() => setMissionDialog({ title: '', description: '', mission_type: 'purchase_count', target_value: 5, reward_points: 100, reward_badge_id: null, starts_at: new Date().toISOString().slice(0, 16), ends_at: '', is_active: true })}>
                <Plus className="h-4 w-4 mr-1" /> Nova Missão
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Título</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Meta</TableHead>
                    <TableHead>Recompensa</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingMissions ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando…</TableCell></TableRow>
                  ) : !missions?.length ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhuma missão cadastrada</TableCell></TableRow>
                  ) : missions.map((m: any) => {
                    const now = new Date();
                    const active = m.is_active && new Date(m.starts_at) <= now && new Date(m.ends_at) >= now;
                    return (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium">{m.title}</TableCell>
                        <TableCell className="text-sm">
                          {m.mission_type === 'purchase_count' ? 'Nº Compras' : m.mission_type === 'spend_value' ? 'Valor Gasto' : m.mission_type === 'referral_count' ? 'Indicações' : m.mission_type}
                        </TableCell>
                        <TableCell>{m.target_value}</TableCell>
                        <TableCell>
                          <span className="text-primary font-medium">+{m.reward_points} pts</span>
                          {m.reward_badge && <span className="ml-1">{(m.reward_badge as any).icon}</span>}
                        </TableCell>
                        <TableCell className="text-xs">
                          {format(new Date(m.starts_at), 'dd/MM')} — {format(new Date(m.ends_at), 'dd/MM/yy')}
                        </TableCell>
                        <TableCell><Badge variant={active ? 'default' : 'secondary'}>{active ? 'Ativa' : 'Inativa'}</Badge></TableCell>
                        <TableCell>
                          <Button size="icon" variant="ghost" onClick={() => setMissionDialog({ ...m, starts_at: m.starts_at.slice(0, 16), ends_at: m.ends_at.slice(0, 16) })}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Level Dialog ── */}
      <Dialog open={!!levelDialog} onOpenChange={() => setLevelDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{levelDialog?.id ? 'Editar Nível' : 'Novo Nível'}</DialogTitle></DialogHeader>
          {levelDialog && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Nome</Label><Input value={levelDialog.name} onChange={e => setLevelDialog({ ...levelDialog, name: e.target.value })} /></div>
                <div><Label>Ícone</Label><Input value={levelDialog.icon} onChange={e => setLevelDialog({ ...levelDialog, icon: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Pontos Mínimos</Label><Input type="number" value={levelDialog.min_points} onChange={e => setLevelDialog({ ...levelDialog, min_points: Number(e.target.value) })} /></div>
                <div><Label>Cor</Label><Input type="color" value={levelDialog.color} onChange={e => setLevelDialog({ ...levelDialog, color: e.target.value })} /></div>
              </div>
              <div><Label>Benefícios</Label><Input value={levelDialog.benefits || ''} onChange={e => setLevelDialog({ ...levelDialog, benefits: e.target.value })} /></div>
              <div className="flex items-center gap-2">
                <Switch checked={levelDialog.is_active} onCheckedChange={v => setLevelDialog({ ...levelDialog, is_active: v })} />
                <Label>Ativo</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setLevelDialog(null)}>Cancelar</Button>
            <Button onClick={handleSaveLevel} disabled={upsertLevel.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Badge Dialog ── */}
      <Dialog open={!!badgeDialog} onOpenChange={() => setBadgeDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{badgeDialog?.id ? 'Editar Badge' : 'Novo Badge'}</DialogTitle></DialogHeader>
          {badgeDialog && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Nome</Label><Input value={badgeDialog.name} onChange={e => setBadgeDialog({ ...badgeDialog, name: e.target.value })} /></div>
                <div><Label>Ícone</Label><Input value={badgeDialog.icon} onChange={e => setBadgeDialog({ ...badgeDialog, icon: e.target.value })} /></div>
              </div>
              <div><Label>Descrição</Label><Input value={badgeDialog.description || ''} onChange={e => setBadgeDialog({ ...badgeDialog, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Tipo de Condição</Label>
                  <Select value={badgeDialog.condition_type} onValueChange={v => setBadgeDialog({ ...badgeDialog, condition_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Manual</SelectItem>
                      <SelectItem value="total_points">Total de Pontos</SelectItem>
                      <SelectItem value="purchase_count">Nº de Compras</SelectItem>
                      <SelectItem value="referral_count">Nº de Indicações</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Valor da Condição</Label><Input type="number" value={badgeDialog.condition_value} onChange={e => setBadgeDialog({ ...badgeDialog, condition_value: Number(e.target.value) })} /></div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={badgeDialog.is_active} onCheckedChange={v => setBadgeDialog({ ...badgeDialog, is_active: v })} />
                <Label>Ativo</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setBadgeDialog(null)}>Cancelar</Button>
            <Button onClick={handleSaveBadge} disabled={upsertBadge.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Mission Dialog ── */}
      <Dialog open={!!missionDialog} onOpenChange={() => setMissionDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{missionDialog?.id ? 'Editar Missão' : 'Nova Missão'}</DialogTitle></DialogHeader>
          {missionDialog && (
            <div className="space-y-3">
              <div><Label>Título</Label><Input value={missionDialog.title} onChange={e => setMissionDialog({ ...missionDialog, title: e.target.value })} /></div>
              <div><Label>Descrição</Label><Input value={missionDialog.description || ''} onChange={e => setMissionDialog({ ...missionDialog, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Tipo</Label>
                  <Select value={missionDialog.mission_type} onValueChange={v => setMissionDialog({ ...missionDialog, mission_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="purchase_count">Nº de Compras</SelectItem>
                      <SelectItem value="spend_value">Valor Gasto</SelectItem>
                      <SelectItem value="referral_count">Indicações</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Meta</Label><Input type="number" value={missionDialog.target_value} onChange={e => setMissionDialog({ ...missionDialog, target_value: Number(e.target.value) })} /></div>
              </div>
              <div><Label>Recompensa (pontos)</Label><Input type="number" value={missionDialog.reward_points} onChange={e => setMissionDialog({ ...missionDialog, reward_points: Number(e.target.value) })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Início</Label><Input type="datetime-local" value={missionDialog.starts_at} onChange={e => setMissionDialog({ ...missionDialog, starts_at: e.target.value })} /></div>
                <div><Label>Fim</Label><Input type="datetime-local" value={missionDialog.ends_at} onChange={e => setMissionDialog({ ...missionDialog, ends_at: e.target.value })} /></div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={missionDialog.is_active} onCheckedChange={v => setMissionDialog({ ...missionDialog, is_active: v })} />
                <Label>Ativa</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setMissionDialog(null)}>Cancelar</Button>
            <Button onClick={handleSaveMission} disabled={upsertMission.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
