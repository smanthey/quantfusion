import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { TradingEngine } from './services/trading-engine';
import { MultiAssetEngine } from './services/multi-asset-engine';
import { ABTestingService } from './services/ab-testing';
import { ForexTradingEngine } from './services/forex-trading-engine';
import { ProfitableTradingEngine } from './services/profitable-trading-engine';
import { ResearchBasedTrading } from './services/research-based-trading';
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

  // Initialize engines (STOP ALL LOSING ENGINES)
  const researchTrading = new ResearchBasedTrading(); // ONLY profitable research-based trading
  
  async function startServer() {
    try {
      console.log('🚀 Starting AutoQuant server with RESEARCH-BASED PROFITABLE TRADING ONLY');

      // START ONLY RESEARCH-BASED PROFITABLE TRADING
      console.log('📊 Starting RESEARCH-BASED profitable trading engine...');
      await researchTrading.start();
      console.log('📊 RESEARCH-BASED Trading Engine started - 85% WIN RATE TARGET');

      // Use the HTTP server from registerRoutes that includes WebSocket support
      server.listen(port, host, () => {
        console.log(`🌐 Server running on http://${host}:${port}`);
        console.log(`🔌 WebSocket server running on ws://${host}:${port}/ws`);
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