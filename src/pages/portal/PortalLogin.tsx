import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePortalAuth } from '@/contexts/PortalAuthContext';
import { checkPhone, portalLogin, portalRegister, portalSetPassword, formatPhoneDisplay } from '@/lib/portalApi';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, ArrowRight, Loader2, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

type Step = 'phone' | 'login' | 'register' | 'set_password' | 'success';

export default function PortalLogin() {
  const navigate = useNavigate();
  const { isAuthenticated, login } = usePortalAuth();
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [customerName, setCustomerName] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) navigate('/c');
  }, [isAuthenticated, navigate]);

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return `(${digits}`;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const handlePhoneSubmit = async () => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) { toast.error('Informe um telefone válido'); return; }
    setLoading(true);
    try {
      const result = await checkPhone(phone);
      if (result.exists) {
        setCustomerName(result.customer_name);
        if (result.has_password) {
          setStep('login');
        } else {
          // Legacy customer without password
          setStep('set_password');
        }
      } else {
        setStep('register');
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao verificar telefone');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!password) { toast.error('Informe sua senha'); return; }
    setLoading(true);
    try {
      const result = await portalLogin(phone, password);
      if (result.success) {
        login(result.token, result.customer);
        setStep('success');
        setTimeout(() => navigate('/c'), 1500);
      }
    } catch (err: any) {
      if (err.message?.includes('needs_password')) {
        setStep('set_password');
      } else {
        toast.error(err.message || 'Erro ao entrar');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!name.trim()) { toast.error('Informe seu nome'); return; }
    if (!password || password.length < 4) { toast.error('Senha deve ter pelo menos 4 caracteres'); return; }
    if (password !== confirmPassword) { toast.error('Senhas não coincidem'); return; }
    setLoading(true);
    try {
      const result = await portalRegister(phone, password, name.trim());
      if (result.success) {
        login(result.token, result.customer);
        setStep('success');
        setTimeout(() => navigate('/c'), 1500);
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar conta');
    } finally {
      setLoading(false);
    }
  };

  const handleSetPassword = async () => {
    if (!password || password.length < 4) { toast.error('Senha deve ter pelo menos 4 caracteres'); return; }
    if (password !== confirmPassword) { toast.error('Senhas não coincidem'); return; }
    setLoading(true);
    try {
      const result = await portalSetPassword(phone, password);
      if (result.success) {
        login(result.token, result.customer);
        setStep('success');
        setTimeout(() => navigate('/c'), 1500);
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao definir senha');
    } finally {
      setLoading(false);
    }
  };

  const slideVariants = {
    enter: { y: 16, opacity: 0 },
    center: { y: 0, opacity: 1 },
    exit: { y: -16, opacity: 0 },
  };

  const PasswordInput = ({ value, onChange, placeholder, autoFocus }: { value: string; onChange: (v: string) => void; placeholder: string; autoFocus?: boolean }) => (
    <div className="relative">
      <input
        type={showPassword ? 'text' : 'password'}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-12 px-4 pr-12 rounded-xl border border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg))] text-lg focus:outline-none focus:ring-2 focus:ring-[hsl(var(--portal-primary))] transition-shadow"
        autoFocus={autoFocus}
      />
      <button
        type="button"
        onClick={() => setShowPassword(!showPassword)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(var(--portal-muted-foreground))] hover:text-[hsl(var(--portal-card-foreground))] transition-colors"
      >
        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
      </button>
    </div>
  );

  return (
    <div className="portal-theme min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <motion.div
          className="text-center mb-8"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[hsl(var(--portal-primary))] mb-4 shadow-lg">
            <Star className="h-8 w-8 text-[hsl(var(--portal-accent))]" />
          </div>
          <h1 className="text-2xl font-bold text-[hsl(var(--portal-card-foreground))]">Clube de Pontos</h1>
          <p className="text-sm text-[hsl(var(--portal-muted-foreground))] mt-1">
            Acumule pontos e resgate recompensas
          </p>
        </motion.div>

        {/* Card */}
        <div className="bg-[hsl(var(--portal-card))] rounded-2xl shadow-lg border border-[hsl(var(--portal-border))] overflow-hidden">
          <AnimatePresence mode="wait">
            {/* Step: Phone */}
            {step === 'phone' && (
              <motion.div key="phone" variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.22 }} className="p-6">
                <h2 className="text-lg font-semibold mb-1">Entrar no Clube</h2>
                <p className="text-sm text-[hsl(var(--portal-muted-foreground))] mb-5">
                  Digite seu telefone para continuar
                </p>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Telefone</label>
                    <input
                      type="tel"
                      inputMode="numeric"
                      placeholder="(00) 00000-0000"
                      value={phone}
                      onChange={(e) => setPhone(formatPhone(e.target.value))}
                      onKeyDown={(e) => e.key === 'Enter' && handlePhoneSubmit()}
                      className="w-full h-12 px-4 rounded-xl border border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg))] text-lg tracking-wider focus:outline-none focus:ring-2 focus:ring-[hsl(var(--portal-primary))] transition-shadow"
                      autoFocus
                    />
                  </div>
                  <button
                    onClick={handlePhoneSubmit}
                    disabled={loading || phone.replace(/\D/g, '').length < 10}
                    className="w-full h-12 rounded-xl bg-[hsl(var(--portal-primary))] text-white font-semibold flex items-center justify-center gap-2 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
                  >
                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><span>Continuar</span><ArrowRight className="h-4 w-4" /></>}
                  </button>
                </div>
              </motion.div>
            )}

            {/* Step: Login (existing customer) */}
            {step === 'login' && (
              <motion.div key="login" variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.22 }} className="p-6">
                {customerName && (
                  <p className="text-sm font-medium text-[hsl(var(--portal-primary))] mb-1">
                    Olá, {customerName}! 👋
                  </p>
                )}
                <h2 className="text-lg font-semibold mb-1">Digite sua senha</h2>
                <p className="text-sm text-[hsl(var(--portal-muted-foreground))] mb-5">
                  {formatPhoneDisplay(phone)}
                </p>
                <div className="space-y-4">
                  <PasswordInput
                    value={password}
                    onChange={setPassword}
                    placeholder="Sua senha"
                    autoFocus
                  />
                  <button
                    onClick={handleLogin}
                    disabled={loading || !password}
                    className="w-full h-12 rounded-xl bg-[hsl(var(--portal-primary))] text-white font-semibold flex items-center justify-center gap-2 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
                  >
                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Entrar'}
                  </button>
                  <button onClick={() => { setStep('phone'); setPassword(''); }} className="w-full text-sm text-[hsl(var(--portal-muted-foreground))] mt-1 hover:underline">
                    Trocar telefone
                  </button>
                </div>
              </motion.div>
            )}

            {/* Step: Register (new customer) */}
            {step === 'register' && (
              <motion.div key="register" variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.22 }} className="p-6">
                <h2 className="text-lg font-semibold mb-1">Criar conta 🎉</h2>
                <p className="text-sm text-[hsl(var(--portal-muted-foreground))] mb-5">
                  É sua primeira vez aqui. Preencha seus dados.
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Nome</label>
                    <input
                      type="text"
                      placeholder="Seu nome"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full h-12 px-4 rounded-xl border border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg))] text-lg focus:outline-none focus:ring-2 focus:ring-[hsl(var(--portal-primary))] transition-shadow"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Senha</label>
                    <PasswordInput value={password} onChange={setPassword} placeholder="Crie uma senha" />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Confirmar senha</label>
                    <PasswordInput value={confirmPassword} onChange={setConfirmPassword} placeholder="Repita a senha" />
                  </div>
                  <p className="text-xs text-[hsl(var(--portal-muted-foreground))]">
                    Ao continuar, você concorda com os termos do programa de fidelidade.
                  </p>
                  <button
                    onClick={handleRegister}
                    disabled={loading || !name.trim() || !password || !confirmPassword}
                    className="w-full h-12 rounded-xl bg-[hsl(var(--portal-primary))] text-white font-semibold flex items-center justify-center gap-2 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
                  >
                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Criar conta'}
                  </button>
                  <button onClick={() => { setStep('phone'); setPassword(''); setConfirmPassword(''); }} className="w-full text-sm text-[hsl(var(--portal-muted-foreground))] mt-1 hover:underline">
                    Trocar telefone
                  </button>
                </div>
              </motion.div>
            )}

            {/* Step: Set Password (legacy customer) */}
            {step === 'set_password' && (
              <motion.div key="set_password" variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.22 }} className="p-6">
                {customerName && (
                  <p className="text-sm font-medium text-[hsl(var(--portal-primary))] mb-1">
                    Olá, {customerName}! 👋
                  </p>
                )}
                <h2 className="text-lg font-semibold mb-1">Criar senha de acesso</h2>
                <p className="text-sm text-[hsl(var(--portal-muted-foreground))] mb-5">
                  Defina uma senha para acessar seu painel.
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Nova senha</label>
                    <PasswordInput value={password} onChange={setPassword} placeholder="Crie uma senha" autoFocus />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Confirmar senha</label>
                    <PasswordInput value={confirmPassword} onChange={setConfirmPassword} placeholder="Repita a senha" />
                  </div>
                  <button
                    onClick={handleSetPassword}
                    disabled={loading || !password || !confirmPassword}
                    className="w-full h-12 rounded-xl bg-[hsl(var(--portal-primary))] text-white font-semibold flex items-center justify-center gap-2 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
                  >
                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Definir senha e entrar'}
                  </button>
                  <button onClick={() => { setStep('phone'); setPassword(''); setConfirmPassword(''); }} className="w-full text-sm text-[hsl(var(--portal-muted-foreground))] mt-1 hover:underline">
                    Trocar telefone
                  </button>
                </div>
              </motion.div>
            )}

            {/* Step: Success */}
            {step === 'success' && (
              <motion.div key="success" variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.22 }} className="p-8 text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 15, delay: 0.1 }}
                >
                  <CheckCircle2 className="h-16 w-16 mx-auto text-[hsl(var(--portal-success))]" />
                </motion.div>
                <h2 className="text-xl font-bold mt-4">Bem-vindo!</h2>
                <p className="text-sm text-[hsl(var(--portal-muted-foreground))] mt-1">Entrando no seu painel...</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
