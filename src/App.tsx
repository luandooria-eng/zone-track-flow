import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Layout } from "@/components/layout/Layout";

// Pages
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import WhatsAppInbox from "./pages/WhatsAppInbox";
import Settings from "./pages/Settings";
import Integrations from "./pages/Integrations";
import UsersPage from "./pages/Users";
import Audit from "./pages/Audit";
import CRMFunnel from "./pages/CRMFunnel";
import CRMMetrics from "./pages/CRMMetrics";
import AutoReactivation from "./pages/AutoReactivation";
import AutoMessages from "./pages/AutoMessages";
import CRMCampaigns from "./pages/CRMCampaigns";
import CRMCampaignNew from "./pages/CRMCampaignNew";
import CRMCampaignDetail from "./pages/CRMCampaignDetail";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Protected routes */}
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/whatsapp" element={<WhatsAppInbox />} />
                      <Route path="/crm" element={<CRMFunnel />} />
                      <Route path="/crm/metricas" element={<CRMMetrics />} />
                      <Route path="/crm/reativacao" element={<AutoReactivation />} />
                      <Route path="/crm/mensagens" element={<AutoMessages />} />
                      <Route path="/crm/campanhas" element={<CRMCampaigns />} />
                      <Route path="/crm/campanhas/nova" element={<CRMCampaignNew />} />
                      <Route path="/crm/campanhas/:id" element={<CRMCampaignDetail />} />
                      <Route path="/settings" element={<Settings />} />
                      <Route path="/integrations" element={<Integrations />} />
                      <Route path="/users" element={<UsersPage />} />
                      <Route path="/audit" element={<Audit />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </Layout>
                </ProtectedRoute>
              }
            />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
