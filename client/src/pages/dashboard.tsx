
import { EnhancedTradingDashboard } from "@/components/enhanced-trading-dashboard";

export default function Dashboard() {
  try {
    return <EnhancedTradingDashboard />;
  } catch (error) {
    console.error('Dashboard render error:', error);
    return (
      <div style={{ padding: "20px", background: "#000", color: "#fff", minHeight: "100vh" }}>
        <h1>🚀 AutoQuant Dashboard</h1>
        <div style={{ marginTop: "20px" }}>
          <p>❌ Dashboard Error</p>
          <p>Please refresh the page to reconnect to live market data.</p>
          <p style={{ color: "#666", fontSize: "14px", marginTop: "10px" }}>Error: {String(error)}</p>
        </div>
      </div>
    );
  }
}
