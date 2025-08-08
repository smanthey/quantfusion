import { TradingDashboard } from "@/components/trading-dashboard";
import { SimpleStatus } from "@/components/simple-status";

export default function Dashboard() {
  // Temporarily show simple status to test rendering
  try {
    return <TradingDashboard />;
  } catch (error) {
    console.error('Dashboard error:', error);
    return <SimpleStatus />;
  }
}