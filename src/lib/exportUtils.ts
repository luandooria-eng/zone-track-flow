// Export utilities for Finance reports
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface ExportOptions {
  filename: string;
  title: string;
  period: string;
  filters?: string[];
}

export interface DRELine {
  label: string;
  value: number;
  isTotal?: boolean;
  isSubtotal?: boolean;
  indent?: number;
}

export interface TransactionExportRow {
  data: string;
  tipo: string;
  valor: string;
  metodo: string;
  origem: string;
  descricao: string;
}

export interface ApBillExportRow {
  vencimento: string;
  fornecedor: string;
  categoria: string;
  valor: string;
  status: string;
  pago_em: string;
}

// Format currency for display
export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

// Generate CSV content
export function generateCSV(
  headers: string[],
  rows: Record<string, string | number | null | undefined>[],
  keys: string[]
): string {
  const headerLine = headers.join(';');
  const dataLines = rows.map(row =>
    keys.map(key => {
      const value = row[key];
      const strValue = value === null || value === undefined ? '' : String(value);
      // Escape quotes and wrap in quotes if contains semicolon
      if (strValue.includes(';') || strValue.includes('"')) {
        return `"${strValue.replace(/"/g, '""')}"`;
      }
      return strValue;
    }).join(';')
  );
  return [headerLine, ...dataLines].join('\n');
}

// Download file helper
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob(['\ufeff' + content], { type: mimeType + ';charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Export DRE to CSV
export function exportDREToCSV(lines: DRELine[], options: ExportOptions): void {
  const header = `DRE - Demonstrativo de Resultado\nPeríodo: ${options.period}\nEmitido em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}\n\n`;
  
  const content = lines.map(line => {
    const indent = '  '.repeat(line.indent || 0);
    const prefix = line.isTotal ? '=== ' : line.isSubtotal ? '--- ' : '';
    return `${prefix}${indent}${line.label};${formatCurrency(line.value)}`;
  }).join('\n');

  downloadFile(header + 'Descrição;Valor\n' + content, `${options.filename}.csv`, 'text/csv');
}

// Export transactions to CSV
export function exportTransactionsToCSV(
  rows: TransactionExportRow[],
  options: ExportOptions
): void {
  const header = `Movimentações de Caixa\nPeríodo: ${options.period}\nEmitido em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}\n\n`;
  
  const csv = generateCSV(
    ['Data', 'Tipo', 'Valor', 'Método', 'Origem', 'Descrição'],
    rows as unknown as Record<string, string | number | null | undefined>[],
    ['data', 'tipo', 'valor', 'metodo', 'origem', 'descricao']
  );

  downloadFile(header + csv, `${options.filename}.csv`, 'text/csv');
}

// Export AP Bills to CSV
export function exportApBillsToCSV(
  rows: ApBillExportRow[],
  options: ExportOptions
): void {
  const header = `Contas a Pagar\nPeríodo: ${options.period}\nEmitido em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}\n\n`;
  
  const csv = generateCSV(
    ['Vencimento', 'Fornecedor', 'Categoria', 'Valor', 'Status', 'Pago em'],
    rows as unknown as Record<string, string | number | null | undefined>[],
    ['vencimento', 'fornecedor', 'categoria', 'valor', 'status', 'pago_em']
  );

  downloadFile(header + csv, `${options.filename}.csv`, 'text/csv');
}

// Generate HTML for PDF (simple HTML to print)
export function generatePDFContent(
  title: string,
  period: string,
  tableHtml: string,
  filters?: string[]
): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; font-size: 12px; }
        h1 { font-size: 18px; margin-bottom: 5px; }
        .meta { color: #666; margin-bottom: 20px; font-size: 11px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f5f5f5; font-weight: 600; }
        .total { font-weight: bold; background-color: #e8f4e8; }
        .subtotal { font-weight: 600; background-color: #f0f0f0; }
        .indent-1 { padding-left: 20px; }
        .indent-2 { padding-left: 40px; }
        .positive { color: #16a34a; }
        .negative { color: #dc2626; }
        .footer { margin-top: 30px; font-size: 10px; color: #888; }
      </style>
    </head>
    <body>
      <h1>${title}</h1>
      <div class="meta">
        <div>Período: ${period}</div>
        ${filters?.length ? `<div>Filtros: ${filters.join(', ')}</div>` : ''}
        <div>Emitido em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</div>
      </div>
      ${tableHtml}
      <div class="footer">
        Relatório gerado automaticamente pelo sistema financeiro.
      </div>
    </body>
    </html>
  `;
}

// Print PDF (opens print dialog)
export function printPDF(htmlContent: string): void {
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  }
}

// Generate DRE table HTML for PDF
export function generateDRETableHtml(lines: DRELine[]): string {
  const rows = lines.map(line => {
    const indentClass = line.indent ? `indent-${line.indent}` : '';
    const rowClass = line.isTotal ? 'total' : line.isSubtotal ? 'subtotal' : '';
    const valueClass = line.value >= 0 ? 'positive' : 'negative';
    
    return `<tr class="${rowClass}">
      <td class="${indentClass}">${line.label}</td>
      <td class="${valueClass}">${formatCurrency(line.value)}</td>
    </tr>`;
  }).join('');

  return `<table>
    <thead><tr><th>Descrição</th><th style="width: 150px;">Valor</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}
