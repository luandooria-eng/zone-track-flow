import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Loader2, Droplets } from 'lucide-react';
import { LoadingScreen } from '@/components/system/LoadingScreen';

export default function Auth() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isLoading) {
    return (
      <LoadingScreen
        title="Carregando autenticação…"
        description="Validando sua sessão para entrar no sistema."
        timeoutMs={8000}
        showLoginButton={false}
      />
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-background p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
            <Droplets className="h-7 w-7 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">AquaGás</h1>
            <p className="text-sm text-muted-foreground">Sistema de Gestão</p>
          </div>
        </div>

        <Card className="shadow-lg">
          <Tabs defaultValue="login">
            <CardHeader className="pb-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Entrar</TabsTrigger>
                <TabsTrigger value="register">Cadastrar</TabsTrigger>
              </TabsList>
            </CardHeader>
            
            <CardContent>
              <TabsContent value="login" className="mt-0">
                <LoginForm 
                  isSubmitting={isSubmitting} 
                  setIsSubmitting={setIsSubmitting}
                  onSuccess={() => navigate('/')}
                />
              </TabsContent>
              
              <TabsContent value="register" className="mt-0">
                <RegisterForm 
                  isSubmitting={isSubmitting} 
                  setIsSubmitting={setIsSubmitting}
                  onSuccess={() => navigate('/')}
                />
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-6">
          © 2024 AquaGás. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
}

interface FormProps {
  isSubmitting: boolean;
  setIsSubmitting: (v: boolean) => void;
  onSuccess: () => void;
}

function LoginForm({ isSubmitting, setIsSubmitting, onSuccess }: FormProps) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSubmitting, setForgotSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const { error } = await signIn(email, password);
    
    if (error) {
      toast.error('Erro ao entrar', {
        description: error.message === 'Invalid login credentials' 
          ? 'Email ou senha incorretos' 
          : error.message,
      });
    } else {
      toast.success('Bem-vindo!');
      onSuccess();
    }
    
    setIsSubmitting(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) {
      toast.error('Informe seu email');
      return;
    }
    setForgotSubmitting(true);
    const { supabase } = await import('@/integrations/supabase/client');
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setForgotSubmitting(false);

    if (error) {
      toast.error('Erro ao enviar email', { description: error.message });
      return;
    }
    toast.success('Email enviado!', {
      description: 'Verifique sua caixa de entrada para redefinir a senha.',
    });
    setShowForgot(false);
    setForgotEmail('');
  };

  if (showForgot) {
    return (
      <form onSubmit={handleForgotPassword} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="forgot-email">Email da conta</Label>
          <Input
            id="forgot-email"
            type="email"
            placeholder="seu@email.com"
            value={forgotEmail}
            onChange={(e) => setForgotEmail(e.target.value)}
            required
            disabled={forgotSubmitting}
          />
          <p className="text-xs text-muted-foreground">
            Enviaremos um link para redefinir sua senha.
          </p>
        </div>

        <Button type="submit" className="w-full" disabled={forgotSubmitting}>
          {forgotSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Enviando...
            </>
          ) : (
            'Enviar link de recuperação'
          )}
        </Button>

        <button
          type="button"
          className="w-full text-sm text-primary hover:underline"
          onClick={() => setShowForgot(false)}
        >
          Voltar para login
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="login-email">Email</Label>
        <Input
          id="login-email"
          type="email"
          placeholder="seu@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={isSubmitting}
        />
      </div>
      
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="login-password">Senha</Label>
          <button
            type="button"
            className="text-xs text-primary hover:underline"
            onClick={() => setShowForgot(true)}
          >
            Esqueci minha senha
          </button>
        </div>
        <Input
          id="login-password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={isSubmitting}
          minLength={6}
        />
      </div>
      
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Entrando...
          </>
        ) : (
          'Entrar'
        )}
      </Button>
    </form>
  );
}

function RegisterForm({ isSubmitting, setIsSubmitting, onSuccess }: FormProps) {
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }
    
    setIsSubmitting(true);
    
    const { error } = await signUp(email, password, fullName);
    
    if (error) {
      toast.error('Erro ao cadastrar', {
        description: error.message,
      });
    } else {
      toast.success('Conta criada com sucesso!');
      onSuccess();
    }
    
    setIsSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="register-name">Nome completo</Label>
        <Input
          id="register-name"
          type="text"
          placeholder="Seu nome"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          disabled={isSubmitting}
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="register-email">Email</Label>
        <Input
          id="register-email"
          type="email"
          placeholder="seu@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={isSubmitting}
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="register-password">Senha</Label>
        <Input
          id="register-password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={isSubmitting}
          minLength={6}
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="register-confirm">Confirmar senha</Label>
        <Input
          id="register-confirm"
          type="password"
          placeholder="••••••••"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          disabled={isSubmitting}
          minLength={6}
        />
      </div>
      
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Cadastrando...
          </>
        ) : (
          'Criar conta'
        )}
      </Button>
    </form>
  );
}
