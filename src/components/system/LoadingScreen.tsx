import React, { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type LoadingScreenProps = {
  title?: string;
  description?: string;
  timeoutMs?: number;
  showLoginButton?: boolean;
};

export function LoadingScreen({
  title = "Carregando…",
  description = "Aguarde um instante.",
  timeoutMs = 8000,
  showLoginButton = true,
}: LoadingScreenProps) {
  const [isStuck, setIsStuck] = useState(false);

  const timeoutLabel = useMemo(() => {
    const seconds = Math.max(1, Math.round(timeoutMs / 1000));
    return `${seconds}s`;
  }, [timeoutMs]);

  useEffect(() => {
    const t = window.setTimeout(() => setIsStuck(true), timeoutMs);
    return () => window.clearTimeout(t);
  }, [timeoutMs]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md space-y-4">
        <div className="flex flex-col items-center justify-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <div className="text-center">
            <h1 className="text-base font-semibold text-foreground">{title}</h1>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>

        {isStuck && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Demorando mais que o normal</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Se passar de {timeoutLabel}, pode ter ocorrido uma falha de conexão ou sessão.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button onClick={() => window.location.reload()} className="w-full sm:w-auto">
                  Recarregar
                </Button>
                {showLoginButton && (
                  <Button
                    variant="outline"
                    onClick={() => (window.location.href = "/auth")}
                    className="w-full sm:w-auto"
                  >
                    Ir para Login
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
