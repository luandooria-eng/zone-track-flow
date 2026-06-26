# Campanhas de Conversão (Leads → Clientes)

Módulo de disparo em massa via WhatsApp com público misto (leads do CRM + clientes da base + lista importada via CSV), agendamento, A/B test de templates e tracking automático de conversão por pedido lançado.

## Escopo

### 1. Público-alvo (3 fontes combinadas em uma campanha)
- **Leads do CRM** sem `customer_id` vinculado (filtros: estágio, dias parado, com/sem resposta)
- **Clientes da base** com filtros (último pedido, bairro, ticket, top produto, opt-in WhatsApp)
- **Lista importada via CSV** (nome + telefone + variáveis opcionais)

Tela única de seleção: 3 abas (Leads / Clientes / Importar CSV) com checkbox. Contador "X destinatários selecionados" no topo. Deduplicação automática por telefone normalizado.

### 2. Agendamento
- Data + hora de início
- Rate limit configurável (padrão: 25 msg/min)
- Janela de envio (padrão: 09h–19h, pausa fora do horário)
- Status: draft → scheduled → sending → done / paused / cancelled

### 3. A/B Test de templates
- 2 a 3 variações de mensagem por campanha
- Distribuição igual (round-robin) entre destinatários
- Variáveis: `{{nome}}`, `{{primeiro_nome}}`, `{{ultimo_produto}}` + variáveis livres do CSV
- Métricas por variante: enviadas / respondidas / convertidas / taxa

### 4. Conversão = "pedido lançado em vendas diárias com nome e cadastro"
Após envio, o sistema vigia novos pedidos. Match por:
1. `customer_id` (se já era cliente ou virou cliente vinculado pelo telefone)
2. Telefone normalizado (via `phone_match_variants`) — pega lead que virou cliente novo
3. Janela de atribuição: 30 dias após envio (configurável)

Trigger DB em `orders` preenche `crm_campaign_recipients.converted_at` + `converted_order_id`.

## Estrutura técnica

### Tabelas novas
- **crm_campaigns**: nome, status, scheduled_at, started_at, finished_at, rate_limit_per_min, send_window_start/end, attribution_days, audience_summary (jsonb)
- **crm_campaign_templates**: campaign_id, label (A/B/C), body com variáveis, weight, contadores denormalizados (sent/response/conversion)
- **crm_campaign_recipients**: lista materializada (source: lead/customer/csv), name, phone, phone_normalized, template_id atribuído, variables (jsonb), status, sent_at, responded_at, converted_at, converted_order_id. UNIQUE(campaign_id, phone_normalized) para dedup.

### Edge function `crm-campaign-dispatcher`
- Roda via `pg_cron` a cada 1 min
- Busca campanhas `scheduled` com `scheduled_at <= now()` → marca `sending`
- Para cada `sending`: respeita janela + rate limit, processa N recipients `pending`
- Substitui variáveis, chama Z-API, grava em `whatsapp_messages` + `crm_activities` (`type='campaign_sent'`)
- Marca recipient `sent` / `failed`
- Quando todos processados → status `done`

### Triggers DB
1. **Resposta**: cruza `whatsapp_messages` inbound posterior ao `sent_at` por telefone → `responded_at`
2. **Conversão**: trigger em `orders` (insert/update para delivered) → busca recipients com mesmo telefone ou customer_id dentro da janela → `converted_at` + `converted_order_id`

### Função `get_campaign_metrics(campaign_id)`
Totais, por template (A/B), série diária, lista de convertidos, respondidos sem conversão, silenciosos.

### UI — nova página `/crm/campanhas`
- Lista de campanhas com status, contadores, taxa de conversão
- Botão "Nova campanha" → wizard de 4 passos:
  1. Nome + agendamento (data, hora, janela, rate limit)
  2. Audiência (3 abas: Leads / Clientes / Importar CSV, com filtros e checkbox)
  3. Mensagens (1–3 variantes A/B com preview e variáveis)
  4. Revisar e agendar (totais dedup, confirmar)
- Detalhe da campanha: gráficos envio/resposta/conversão, tabela de recipients com filtros, comparativo A/B

### Métricas adicionadas ao painel CRM Metrics
- Card "Campanhas ativas" + "Leads convertidos via campanha (30d)"
- Top 3 templates por taxa de conversão

## Pontos de atenção
- Z-API: rate limit conservador (25/min) para evitar banimento
- Opt-out: se cliente tem `whatsapp_opt_out=true`, pula automaticamente
- Idempotência: recipient processa uma única vez (lock por status)
- CSV: validação de telefone (mín 10 dígitos), preview antes de criar
- LGPD: log de quem disparou, quando, para quem

## Fases

**Fase 1 (esta entrega):** tabelas + edge function dispatcher + UI completa (wizard + detalhe) + tracking de conversão + cron job. End-to-end funcional.

**Fase 2 (futuro):** templates Meta/WABA aprovados, segmentação por ML, follow-up automático para silenciosos.
