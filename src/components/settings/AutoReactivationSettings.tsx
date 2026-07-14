import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Play, Droplet, Flame } from "lucide-react";
import { WhatsAppTemplateSelect } from "@/components/whatsapp/WhatsAppTemplateSelect";

type Rule = {
  id: string;
  product_type: "water" | "gas";
  is_active: boolean;
  message_template: string;
  followup_message_template: string | null;
  tolerance_days: number;
  max_attempts: number;
  followup_interval_days: number;
  min_avg_days: number;
  max_avg_days: number;
  send_window_start: string;
  send_window_end: string;
  rate_limit_per_run: number;
  whatsapp_template_id: string | null;
  followup_whatsapp_template_id: string | null;
};

export function AutoReactivationSettings() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("auto_reactivation_rules" as any)
      .select("*")
      .order("product_type");
    if (error) toast.error("Erro ao carregar regras: " + error.message);
    else setRules((data || []) as any);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const save = async (r: Rule) => {
    setSaving(r.id);
    const { error } = await supabase
      .from("auto_reactivation_rules" as any)
      .update({
        is_active: r.is_active,
        message_template: r.message_template,
        followup_message_template: r.followup_message_template,
        tolerance_days: r.tolerance_days,
        max_attempts: r.max_attempts,
        followup_interval_days: r.followup_interval_days,
        min_avg_days: r.min_avg_days,
        max_avg_days: r.max_avg_days,
        send_window_start: r.send_window_start,
        send_window_end: r.send_window_end,
        rate_limit_per_run: r.rate_limit_per_run,
        whatsapp_template_id: r.whatsapp_template_id,
        followup_whatsapp_template_id: r.followup_whatsapp_template_id,
      })
      .eq("id", r.id);
    setSaving(null);
    if (error) toast.error("Erro: " + error.message);
    else toast.success("Regra salva");
  };

  const runNow = async () => {
    setRunning(true);
    const { data, error } = await supabase.functions.invoke("auto-reactivation-dispatcher");
    setRunning(false);
    if (error) toast.error("Falha: " + error.message);
    else toast.success(`Disparo executado. Enviados: ${(data as any)?.totalSent ?? 0}`);
  };

  const update = (id: string, patch: Partial<Rule>) =>
    setRules((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Reativação Automática (Frequência)</h3>
          <p className="text-sm text-muted-foreground">
            Dispara mensagens automaticamente quando o cliente passa do prazo médio de compra dele (avg_days + tolerância).
            Ao receber novo pedido, o ciclo zera e reinicia.
          </p>
        </div>
        <Button onClick={runNow} disabled={running} variant="outline" className="gap-2">
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          Executar agora
        </Button>
      </div>

      {rules.map((r) => (
        <Card key={r.id}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {r.product_type === "water" ? <Droplet className="h-5 w-5 text-blue-500" /> : <Flame className="h-5 w-5 text-orange-500" />}
                {r.product_type === "water" ? "Água" : "Gás"}
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor={`active-${r.id}`} className="text-sm">Ativo</Label>
                <Switch id={`active-${r.id}`} checked={r.is_active} onCheckedChange={(v) => update(r.id, { is_active: v })} />
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Mensagem inicial</Label>
              <Textarea
                value={r.message_template}
                onChange={(e) => update(r.id, { message_template: e.target.value })}
                rows={3}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Variáveis: <code>{"{{nome}}"}</code>, <code>{"{{primeiro_nome}}"}</code>, <code>{"{{dias_sem_comprar}}"}</code>
              </p>
              <Label className="mt-2 block">Template Meta (fallback fora da janela de 24h)</Label>
              <WhatsAppTemplateSelect
                value={r.whatsapp_template_id}
                onChange={(v) => update(r.id, { whatsapp_template_id: v })}
              />
            </div>
            <div>
              <Label>Mensagem de follow-up (após 1ª tentativa)</Label>
              <Textarea
                value={r.followup_message_template || ""}
                onChange={(e) => update(r.id, { followup_message_template: e.target.value })}
                rows={3}
              />
              <Label className="mt-2 block">Template Meta para follow-up (fallback fora da janela de 24h)</Label>
              <WhatsAppTemplateSelect
                value={r.followup_whatsapp_template_id}
                onChange={(v) => update(r.id, { followup_whatsapp_template_id: v })}
              />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <Label>Tolerância (dias)</Label>
                <Input type="number" min={0} value={r.tolerance_days}
                  onChange={(e) => update(r.id, { tolerance_days: Number(e.target.value) })} />
                <p className="text-xs text-muted-foreground mt-1">Dispara X dias após o avg_days</p>
              </div>
              <div>
                <Label>Máx. tentativas</Label>
                <Input type="number" min={1} max={10} value={r.max_attempts}
                  onChange={(e) => update(r.id, { max_attempts: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Intervalo follow-up (dias)</Label>
                <Input type="number" min={1} value={r.followup_interval_days}
                  onChange={(e) => update(r.id, { followup_interval_days: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Avg_days mínimo</Label>
                <Input type="number" min={1} value={r.min_avg_days}
                  onChange={(e) => update(r.id, { min_avg_days: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Avg_days máximo</Label>
                <Input type="number" min={1} value={r.max_avg_days}
                  onChange={(e) => update(r.id, { max_avg_days: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Limite por execução</Label>
                <Input type="number" min={1} value={r.rate_limit_per_run}
                  onChange={(e) => update(r.id, { rate_limit_per_run: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Janela início</Label>
                <Input type="time" value={r.send_window_start.slice(0, 5)}
                  onChange={(e) => update(r.id, { send_window_start: e.target.value })} />
              </div>
              <div>
                <Label>Janela fim</Label>
                <Input type="time" value={r.send_window_end.slice(0, 5)}
                  onChange={(e) => update(r.id, { send_window_end: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => save(r)} disabled={saving === r.id}>
                {saving === r.id && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Salvar
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}