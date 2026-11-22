import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authenticateCaller } from "../_shared/auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Only signed-in staff may spend AI credits (the public anon key is not enough).
    const auth = await authenticateCaller(req, {
      corsHeaders,
      allowedRoles: ["admin", "manager", "operator", "finance", "deliverer"],
      allowScheduler: false,
    });
    if (auth.response) return auth.response;

    const body = await req.json();
    // Bound user-controlled text that is interpolated into the prompt.
    const clip = (v: unknown, max: number) => String(v ?? "").slice(0, max);
    const customerName = clip(body.customerName, 120);
    const customerHistory = clip(body.customerHistory, 4000);
    const products = Array.isArray(body.products)
      ? body.products.slice(0, 50).map((p: { name?: unknown; price?: unknown }) => ({
          name: clip(p?.name, 80),
          price: Number(p?.price) || 0,
        }))
      : [];
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      throw new Error("AI service not configured");
    }

    console.log("Generating suggestions for customer:", customerName);

    const systemPrompt = `Você é um assistente de vendas inteligente para uma distribuidora de Gás e Água.
Analise o histórico de compras do cliente e sugira produtos e quantidades para o próximo pedido.

Considere:
- Padrões de consumo (frequência, quantidades habituais)
- Horário e dia da semana
- Produtos complementares frequentemente comprados juntos
- Sazonalidade (mais água em dias quentes, mais gás em dias frios)

Responda APENAS em JSON válido no formato:
{
  "suggestions": [
    {
      "product": "nome do produto",
      "quantity": número,
      "confidence": número de 0 a 1,
      "reason": "razão breve da sugestão"
    }
  ],
  "insights": "uma frase com insight sobre o cliente"
}`;

    const userPrompt = `Cliente: ${customerName}

Histórico de compras recentes:
${customerHistory || "Nenhum histórico disponível"}

Produtos disponíveis:
${products.map((p: { name: string; price: number }) => `- ${p.name} (R$ ${p.price})`).join('\n') || "Gás P13, Gás P45, Água Mineral 20L"}

Gere sugestões inteligentes para este cliente.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ 
          error: "Muitas requisições. Aguarde um momento e tente novamente." 
        }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      if (response.status === 402) {
        return new Response(JSON.stringify({ 
          error: "Créditos de IA esgotados. Entre em contato com o administrador." 
        }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    console.log("AI response:", content);

    // Parse JSON from response
    let suggestions;
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        suggestions = JSON.parse(jsonMatch[0]);
      } else {
        suggestions = JSON.parse(content);
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      suggestions = {
        suggestions: [],
        insights: "Não foi possível gerar sugestões no momento."
      };
    }

    return new Response(JSON.stringify(suggestions), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in ai-suggestions function:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Erro ao gerar sugestões" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
