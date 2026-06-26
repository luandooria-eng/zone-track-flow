import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Star, Eye, EyeOff } from 'lucide-react';

export default function PortalAuth() {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          if (error.message.includes('Invalid login')) {
            toast.error('Email ou senha incorretos');
          } else if (error.message.includes('Email not confirmed')) {
            toast.error('Confirme seu email antes de entrar. Verifique sua caixa de entrada.');
          } else {
            toast.error(error.message);
          }
          return;
        }

        // Check if this user is linked to a customer
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { toast.error('Erro ao autenticar'); return; }

        const { data: customer } = await supabase
          .from('customers')
          .select('id')
          .eq('email', user.email!)
          .maybeSingle();

        if (!customer) {
          await supabase.auth.signOut();
          toast.error('Nenhum cadastro de cliente encontrado para este email. Fale com o estabelecimento.');
          return;
        }

        toast.success('Bem-vindo!');
        navigate('/portal');
      } else {
        // Sign up
        if (!name.trim()) { toast.error('Informe seu nome'); return; }

        // Check if customer exists with this email first
        const { data: existingCustomer } = await supabase
          .from('customers')
          .select('id')
          .eq('email', email)
          .maybeSingle();

        if (!existingCustomer) {
          toast.error('Nenhum cadastro encontrado com este email. Solicite ao estabelecimento que cadastre seu email.');
          return;
        }

        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name, is_portal_client: true } },
        });

        if (error) {
          if (error.message.includes('already registered')) {
            toast.error('Este email já possui uma conta. Faça login.');
          } else {
            toast.error(error.message);
          }
          return;
        }

        toast.success('Conta criada! Verifique seu email para confirmar o cadastro.');
        setIsLogin(true);
      }
    } catch {
      toast.error('Erro inesperado. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mb-3">
            <Star className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Portal de Fidelidade</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isLogin ? 'Acesse sua conta para ver seus pontos e resgatar prêmios' : 'Crie sua conta para acompanhar seus pontos'}
          </p>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">{isLogin ? 'Entrar' : 'Criar Conta'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    placeholder="Seu nome"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required={!isLogin}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Aguarde...' : isLogin ? 'Entrar' : 'Criar Conta'}
              </Button>
            </form>

            <div className="mt-4 text-center">
              <button
                type="button"
                className="text-sm text-primary hover:underline"
                onClick={() => setIsLogin(!isLogin)}
              >
                {isLogin ? 'Não tem conta? Criar agora' : 'Já tem conta? Entrar'}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
