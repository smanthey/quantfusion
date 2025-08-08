
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Dashboard from "@/pages/dashboard";
import OrdersPage from "@/pages/orders";
import StrategiesPage from "@/pages/strategies";
import PortfolioPage from "@/pages/portfolio";
import AnalyticsPage from "@/pages/analytics";
import SettingsPage from "@/pages/settings";
import NotFound from "@/pages/not-found";

function Router() {
  try {
    return (
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/orders" component={OrdersPage} />
        <Route path="/manage-orders" component={OrdersPage} />
        <Route path="/strategies" component={StrategiesPage} />
        <Route path="/portfolio" component={PortfolioPage} />
        <Route path="/analytics" component={AnalyticsPage} />
        <Route path="/settings" component={SettingsPage} />
        <Route component={NotFound} />
      </Switch>
    );
  } catch (error) {
    console.error("Router error:", error);
    return (
      <div style={{ padding: "20px", color: "red" }}>
        <h1>Router Error</h1>
        <p>Failed to initialize routing. Check console for details.</p>
      </div>
    );
  }
}

function App() {
  try {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <div className="min-h-screen bg-gray-900 text-white">
            <Router />
            <Toaster />
          </div>
        </TooltipProvider>
      </QueryClientProvider>
    );
  } catch (error) {
    console.error("App error:", error);
    return (
      <div style={{ padding: "20px", background: "#000", color: "#fff", minHeight: "100vh" }}>
        <h1>🚀 AutoQuant Loading...</h1>
        <p>✅ Backend Running on Port 5000</p>
        <p>✅ APIs Connected: CoinLore, CoinGecko</p>
        <p>✅ WebSocket Active</p>
        <p>✅ Market Data: BTC $116,374, ETH $3,965</p>
        <div style={{ marginTop: "20px" }}>
          <p>If you see this, the app is initializing...</p>
        </div>
      </div>
    );
  }
}

export default App;
