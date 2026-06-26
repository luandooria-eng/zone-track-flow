import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { PortalAuthProvider } from "@/contexts/PortalAuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Layout } from "@/components/layout/Layout";

// Pages
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Customers from "./pages/Customers";
import Sales from "./pages/Sales";
import Pipeline from "./pages/Pipeline";
import Settings from "./pages/Settings";
import Stock from "./pages/Stock";
import Credit from "./pages/Credit";
import Overview from "./pages/Overview";
import Audit from "./pages/Audit";
import UsersPage from "./pages/Users";
import CustomerMap from "./pages/CustomerMap";
import Forecast from "./pages/Forecast";
import Integrations from "./pages/Integrations";
import DailyGrid from "./pages/DailyGrid";
import DailyGridSheet from "./pages/DailyGridSheet";
import Finance from "./pages/Finance";
import AccountsPayable from "./pages/AccountsPayable";
import CashFlow from "./pages/CashFlow";
import Vendors from "./pages/Vendors";
import RecurringRules from "./pages/RecurringRules";
import DRE from "./pages/DRE";
import Returnables from "./pages/Returnables";
import PeakHours from "./pages/PeakHours";
import LoyaltyDashboard from "./pages/loyalty/LoyaltyDashboard";
import LoyaltyRegisterSale from "./pages/loyalty/LoyaltyRegisterSale";
import LoyaltyScoringRules from "./pages/loyalty/LoyaltyScoringRules";
import LoyaltyCoupons from "./pages/loyalty/LoyaltyCoupons";
import LoyaltyVouchers from "./pages/loyalty/LoyaltyVouchers";
import LoyaltyExtract from "./pages/loyalty/LoyaltyExtract";
import LoyaltyReferrals from "./pages/loyalty/LoyaltyReferrals";
import LoyaltyReports from "./pages/loyalty/LoyaltyReports";
import LoyaltyGamification from "./pages/loyalty/LoyaltyGamification";
import LoyaltyCampaigns from "./pages/loyalty/LoyaltyCampaigns";
import LoyaltyOperatorPanel from "./pages/loyalty/LoyaltyOperatorPanel";
import WhatsAppInbox from "./pages/WhatsAppInbox";
import CRMFunnel from "./pages/CRMFunnel";
import CRMMetrics from "./pages/CRMMetrics";
import AutoReactivation from "./pages/AutoReactivation";
import AutoMessages from "./pages/AutoMessages";
import CRMCampaigns from "./pages/CRMCampaigns";
import CRMCampaignNew from "./pages/CRMCampaignNew";
import CRMCampaignDetail from "./pages/CRMCampaignDetail";
import NotFound from "./pages/NotFound";

// Portal pages (client-facing)
import PortalLogin from "./pages/portal/PortalLogin";
import PortalHome from "./pages/portal/PortalHome";
import PortalExtrato from "./pages/portal/PortalExtrato";
import PortalCatalogo from "./pages/portal/PortalCatalogo";
import PortalVouchers from "./pages/portal/PortalVouchers";
import PortalIndicar from "./pages/portal/PortalIndicar";

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

            {/* Portal routes (client-facing, phone OTP auth) */}
            <Route path="/c/login" element={<PortalAuthProvider><PortalLogin /></PortalAuthProvider>} />
            <Route path="/c" element={<PortalAuthProvider><PortalHome /></PortalAuthProvider>} />
            <Route path="/c/extrato" element={<PortalAuthProvider><PortalExtrato /></PortalAuthProvider>} />
            <Route path="/c/catalogo" element={<PortalAuthProvider><PortalCatalogo /></PortalAuthProvider>} />
            <Route path="/c/vouchers" element={<PortalAuthProvider><PortalVouchers /></PortalAuthProvider>} />
            <Route path="/c/indicar" element={<PortalAuthProvider><PortalIndicar /></PortalAuthProvider>} />

            {/* Legacy portal redirects */}
            <Route path="/portal/login" element={<PortalAuthProvider><PortalLogin /></PortalAuthProvider>} />
            <Route path="/portal" element={<PortalAuthProvider><PortalHome /></PortalAuthProvider>} />
            
            {/* Protected routes */}
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/customers" element={<Customers />} />
                      <Route path="/customers/map" element={<CustomerMap />} />
                      <Route path="/sales" element={<Sales />} />
                      <Route path="/daily-grid" element={<DailyGrid />} />
                      <Route path="/daily-grid/:date" element={<DailyGridSheet />} />
                      <Route path="/pipeline" element={<Pipeline />} />
                      <Route path="/stock" element={<Stock />} />
                      <Route path="/stock/returnables" element={<Returnables />} />
                      <Route path="/credit" element={<Credit />} />
                      <Route path="/finance" element={<Finance />} />
                      <Route path="/finance/payables" element={<AccountsPayable />} />
                      <Route path="/finance/cash" element={<CashFlow />} />
                      <Route path="/finance/vendors" element={<Vendors />} />
                      <Route path="/finance/recurring" element={<RecurringRules />} />
                      <Route path="/finance/dre" element={<DRE />} />
                      <Route path="/overview" element={<Overview />} />
                      <Route path="/peak-hours" element={<PeakHours />} />
                      <Route path="/loyalty" element={<LoyaltyDashboard />} />
                      <Route path="/loyalty/sale" element={<LoyaltyRegisterSale />} />
                      <Route path="/loyalty/rules" element={<LoyaltyScoringRules />} />
                      <Route path="/loyalty/coupons" element={<LoyaltyCoupons />} />
                      <Route path="/loyalty/vouchers" element={<LoyaltyVouchers />} />
                      <Route path="/loyalty/extract" element={<LoyaltyExtract />} />
                      <Route path="/loyalty/referrals" element={<LoyaltyReferrals />} />
                      <Route path="/loyalty/gamification" element={<LoyaltyGamification />} />
                      <Route path="/loyalty/campaigns" element={<LoyaltyCampaigns />} />
                      <Route path="/loyalty/reports" element={<LoyaltyReports />} />
                      <Route path="/loyalty/operators" element={<LoyaltyOperatorPanel />} />
                      <Route path="/whatsapp" element={<WhatsAppInbox />} />
                      <Route path="/crm" element={<CRMFunnel />} />
                      <Route path="/crm/metricas" element={<CRMMetrics />} />
                      <Route path="/crm/reativacao" element={<AutoReactivation />} />
                      <Route path="/crm/mensagens" element={<AutoMessages />} />
                      <Route path="/crm/campanhas" element={<CRMCampaigns />} />
                      <Route path="/crm/campanhas/nova" element={<CRMCampaignNew />} />
                      <Route path="/crm/campanhas/:id" element={<CRMCampaignDetail />} />
                      <Route path="/forecast" element={<Forecast />} />
                      <Route path="/integrations" element={<Integrations />} />
                      <Route path="/settings" element={<Settings />} />
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
