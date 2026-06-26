// Helper to render WhatsApp message templates with dynamic variables.
// Variables use {{var}} syntax. Unknown vars are kept as-is.

export type TemplateVars = {
  cliente?: string;
  produto?: string;
  quantidade?: number | string;
  total?: number | string;
  pagamento?: string;
  vencimento?: string;
};

export const AVAILABLE_VARIABLES: { key: keyof TemplateVars; label: string; example: string }[] = [
  { key: 'cliente', label: 'Nome do cliente', example: 'João Silva' },
  { key: 'produto', label: 'Nome do produto', example: 'Água 20L' },
  { key: 'quantidade', label: 'Quantidade', example: '2' },
  { key: 'total', label: 'Valor total', example: 'R$ 30,00' },
  { key: 'pagamento', label: 'Forma de pagamento', example: 'Pix' },
  { key: 'vencimento', label: 'Data de vencimento', example: '25/04/2026' },
];

function formatBRL(value: number | string | undefined): string {
  if (value === undefined || value === null || value === '') return '';
  const n = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(n)) return String(value);
  return `R$ ${n.toFixed(2).replace('.', ',')}`;
}

export function renderTemplate(body: string, vars: TemplateVars): string {
  const normalized: Record<string, string> = {
    cliente: vars.cliente ?? '',
    produto: vars.produto ?? '',
    quantidade: vars.quantidade !== undefined ? String(vars.quantidade) : '',
    total: typeof vars.total === 'number' ? formatBRL(vars.total) : (vars.total ?? ''),
    pagamento: vars.pagamento ?? '',
    vencimento: vars.vencimento ?? '',
  };

  return body.replace(/\{\{\s*([a-zA-Z_]+)\s*\}\}/g, (match, key: string) => {
    const k = key.toLowerCase();
    return normalized[k] !== undefined ? normalized[k] : match;
  });
}
