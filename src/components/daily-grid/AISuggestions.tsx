import { useState, useEffect } from 'react';
import { Sparkles, Loader2, RefreshCw, ThumbsUp, ThumbsDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { mockProducts } from '@/lib/mockData';

interface AISuggestionsProps {
  customerName: string;
  customerHistory?: string;
  onSelectSuggestion: (product: string, quantity: number) => void;
  disabled?: boolean;
}

interface Suggestion {
  product: string;
  quantity: number;
  confidence: number;
  reason: string;
}

interface SuggestionResponse {
  suggestions: Suggestion[];
  insights: string;
}

export function AISuggestions({ 
  customerName, 
  customerHistory,
  onSelectSuggestion,
  disabled 
}: AISuggestionsProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchSuggestions = async () => {
    if (!customerName) {
      toast({
        variant: 'destructive',
        title: 'Cliente não selecionado',
        description: 'Selecione um cliente para obter sugestões.',
      });
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('ai-suggestions', {
        body: {
          customerName,
          customerHistory: customerHistory || 'Novo cliente, sem histórico.',
          products: mockProducts.map(p => ({ name: p.name, price: p.price })),
        },
      });

      if (fnError) throw fnError;
      
      if (data.error) {
        setError(data.error);
        toast({
          variant: 'destructive',
          title: 'Erro ao gerar sugestões',
          description: data.error,
        });
      } else {
        setSuggestions(data);
      }
    } catch (err) {
      console.error('Error fetching suggestions:', err);
      setError('Não foi possível gerar sugestões.');
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível conectar ao serviço de IA.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && customerName && !suggestions) {
      fetchSuggestions();
    }
  }, [open, customerName]);

  const handleSelectSuggestion = (suggestion: Suggestion) => {
    onSelectSuggestion(suggestion.product, suggestion.quantity);
    setOpen(false);
    toast({
      title: 'Sugestão aplicada',
      description: `${suggestion.quantity}x ${suggestion.product}`,
    });
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'bg-success/10 text-success border-success/30';
    if (confidence >= 0.5) return 'bg-warning/10 text-warning-foreground border-warning/30';
    return 'bg-muted text-muted-foreground';
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          disabled={disabled || !customerName}
          title="Sugestões inteligentes (IA)"
        >
          <Sparkles className={cn(
            "h-4 w-4",
            customerName && "text-primary"
          )} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Sugestões IA
            </h4>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={fetchSuggestions}
              disabled={loading}
            >
              <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
            </Button>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="ml-2 text-sm text-muted-foreground">
                Analisando padrões...
              </span>
            </div>
          )}

          {error && !loading && (
            <div className="text-center py-4">
              <p className="text-sm text-destructive">{error}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={fetchSuggestions}
              >
                Tentar novamente
              </Button>
            </div>
          )}

          {suggestions && !loading && (
            <>
              {suggestions.insights && (
                <p className="text-xs text-muted-foreground italic border-l-2 border-primary/30 pl-2">
                  {suggestions.insights}
                </p>
              )}

              <div className="space-y-2">
                {suggestions.suggestions?.length > 0 ? (
                  suggestions.suggestions.map((suggestion, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors"
                      onClick={() => handleSelectSuggestion(suggestion)}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm">
                          {suggestion.quantity}x {suggestion.product}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn("text-xs", getConfidenceColor(suggestion.confidence))}
                        >
                          {Math.round(suggestion.confidence * 100)}%
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {suggestion.reason}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhuma sugestão disponível.
                  </p>
                )}
              </div>

              <div className="flex items-center justify-center gap-2 pt-2 border-t">
                <span className="text-xs text-muted-foreground">Foi útil?</span>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <ThumbsUp className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <ThumbsDown className="h-3 w-3" />
                </Button>
              </div>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
