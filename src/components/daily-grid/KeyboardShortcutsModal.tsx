import { Keyboard } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface KeyboardShortcutsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const shortcuts = [
  {
    category: 'Navegação',
    items: [
      { keys: ['↑', '↓', '←', '→'], description: 'Mover entre células' },
      { keys: ['Enter'], description: 'Mover para célula abaixo' },
      { keys: ['Tab'], description: 'Mover para próxima célula' },
      { keys: ['Shift', 'Tab'], description: 'Mover para célula anterior' },
      { keys: ['Home'], description: 'Ir para primeira coluna' },
      { keys: ['End'], description: 'Ir para última coluna' },
      { keys: ['Ctrl', 'Home'], description: 'Ir para primeira célula' },
      { keys: ['Ctrl', 'End'], description: 'Ir para última célula' },
    ],
  },
  {
    category: 'Edição',
    items: [
      { keys: ['F2'], description: 'Editar célula selecionada' },
      { keys: ['Escape'], description: 'Cancelar edição' },
      { keys: ['Delete'], description: 'Limpar célula' },
      { keys: ['Ctrl', 'Z'], description: 'Desfazer' },
      { keys: ['Ctrl', 'Y'], description: 'Refazer' },
      { keys: ['Ctrl', 'Shift', 'Z'], description: 'Refazer (alternativo)' },
    ],
  },
  {
    category: 'Seleção',
    items: [
      { keys: ['Ctrl', 'A'], description: 'Selecionar todas as linhas' },
      { keys: ['Shift', '↑/↓'], description: 'Estender seleção' },
      { keys: ['Ctrl', 'Click'], description: 'Adicionar/remover da seleção' },
      { keys: ['Escape'], description: 'Limpar seleção' },
    ],
  },
  {
    category: 'Clipboard',
    items: [
      { keys: ['Ctrl', 'C'], description: 'Copiar células selecionadas' },
      { keys: ['Ctrl', 'V'], description: 'Colar do clipboard' },
      { keys: ['Ctrl', 'X'], description: 'Recortar células selecionadas' },
    ],
  },
  {
    category: 'Ações',
    items: [
      { keys: ['Ctrl', 'S'], description: 'Salvar alterações' },
      { keys: ['Ctrl', 'Enter'], description: 'Salvar linhas selecionadas' },
      { keys: ['Insert'], description: 'Adicionar nova linha' },
      { keys: ['Ctrl', 'Delete'], description: 'Excluir linhas selecionadas' },
    ],
  },
];

export function KeyboardShortcutsModal({
  open,
  onOpenChange,
}: KeyboardShortcutsModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Atalhos de Teclado
          </DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-6">
          {shortcuts.map((section) => (
            <div key={section.category}>
              <h3 className="text-sm font-semibold text-foreground mb-3">
                {section.category}
              </h3>
              <div className="space-y-2">
                {section.items.map((shortcut, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between py-1.5 px-3 rounded-md bg-muted/50"
                  >
                    <span className="text-sm text-muted-foreground">
                      {shortcut.description}
                    </span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, keyIdx) => (
                        <span key={keyIdx} className="flex items-center gap-1">
                          <kbd className="px-2 py-1 text-xs font-semibold bg-background border rounded shadow-sm">
                            {key}
                          </kbd>
                          {keyIdx < shortcut.keys.length - 1 && (
                            <span className="text-muted-foreground">+</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
