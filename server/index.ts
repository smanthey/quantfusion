import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { TradingEngine } from './services/trading-engine';
import { MultiAssetEngine } from './services/multi-asset-engine';
import { ABTestingService } from './services/ab-testing';
import { ForexTradingEngine } from './services/forex-trading-engine';
import { ProfitableTradingEngine } from './services/profitable-trading-engine';
import { ResearchTradingMaster } from './services/research-trading-master';
import { setGlobalForexEngine } from './routes/multi-asset';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  const host = "0.0.0.0"; // Ensure this is set if it was intended to be used in startServer

  // Initialize engines - INSTITUTIONAL MULTI-ASSET QUANT SYSTEM
  async function startServer() {
    try {
      console.log('🚀 Starting Institutional Multi-Asset Quant Trading System');
      console.log('💱 CRYPTO: Cycle + Multi-Factor Alpha + Volatility + Pairs Trading');
      console.log('💱 FOREX: Carry Trade + PPP + Momentum + Trend + Risk Parity');
      
      // Note: Trading engine will be started via /api/trading/start endpoint or auto-started below
      console.log('📊 Trading system ready - will auto-start in 5 seconds...');

      // Use the HTTP server from registerRoutes that includes WebSocket support
      server.listen(port, host, () => {
        console.log(`🌐 Server running on http://${host}:${port}`);
        console.log(`🔌 WebSocket server running on ws://${host}:${port}/ws`);
        
        // Auto-start trading after 5 seconds (allow server to fully initialize)
        setTimeout(async () => {
          try {
            console.log('🤖 AUTO-STARTING INSTITUTIONAL TRADING SYSTEM...');
            const response = await fetch(`http://localhost:${port}/api/trading/start`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' }
            });
            if (response.ok) {
              console.log('✅ TRADING SYSTEM AUTO-STARTED - EXECUTING CRYPTO + FOREX TRADES');
            } else {
              console.log('⚠️ Failed to auto-start trading, use dashboard to start manually');
            }
          } catch (error) {
            console.log('⚠️ Auto-start error, use dashboard to start manually:', error);
          }
        }, 5000);
      });

      return server;
    } catch (error) {
      console.error('❌ Server startup failed:', error);
      process.exit(1);
    }
  }

  // Start server
  startServer();
})();