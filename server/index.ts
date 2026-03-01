import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log as viteLog } from "./vite";
import { log } from './utils/logger';
import { enforceHTTPS, securityHeaders, createRateLimiter } from './middleware/security';
import { TradingEngine } from './services/trading-engine';
import { MultiAssetEngine } from './services/multi-asset-engine';
import { ABTestingService } from './services/ab-testing';
import { ForexTradingEngine } from './services/forex-trading-engine';
import { ProfitableTradingEngine } from './services/profitable-trading-engine';
import { ResearchTradingMaster } from './services/research-trading-master';
import { setGlobalForexEngine } from './routes/multi-asset';

const app = express();

// Security: CORS configuration
const allowedOrigins = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(',')
  : ['http://localhost:5000', 'http://0.0.0.0:5000'];

const corsOriginDelegate = (
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void
) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    // In production, strictly enforce allowed origins
    if (process.env.NODE_ENV === 'production') {
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        log.warn('CORS blocked request from unauthorized origin', { origin });
        callback(new Error('Not allowed by CORS'));
      }
    } else {
      // In development, allow all origins
      callback(null, true);
    }
};

app.use(cors({
  origin: corsOriginDelegate,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Security: Enforce HTTPS in production
app.use(enforceHTTPS);

// Security: Add security headers
app.use(securityHeaders);

// Security: Rate limiting for API routes
app.use('/api', createRateLimiter(100, 60000)); // 100 requests per minute

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

      viteLog(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    log.error('Server error', { status, message, stack: err.stack });
    res.status(status).json({ message });
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
      log.info('🚀 Starting Institutional Multi-Asset Quant Trading System');
      log.info('💱 CRYPTO: Cycle + Multi-Factor Alpha + Volatility + Pairs Trading');
      log.info('💱 FOREX: Carry Trade + PPP + Momentum + Trend + Risk Parity');
      
      // Note: Trading engine will be started via /api/trading/start endpoint or auto-started below
      log.info('📊 Trading system ready - will auto-start in 5 seconds...');
      
      // Log security configuration
      const mode = process.env.NODE_ENV || 'development';
      log.info(`Security: Running in ${mode} mode`, {
        cors: mode === 'production' ? allowedOrigins : 'all origins allowed',
        https: mode === 'production' ? 'enforced' : 'not enforced',
        rateLimit: '100 req/min per IP'
      });

      // Use the HTTP server from registerRoutes that includes WebSocket support
      server.listen(port, host, () => {
        log.info(`🌐 Server running on http://${host}:${port}`);
        log.info(`🔌 WebSocket server running on ws://${host}:${port}/ws`);
        
        // ⏸️  AUTO-START DISABLED: Use dashboard to manually start trading
        // This prevents creating trades before database cleanup
        log.info('⏸️  Auto-start DISABLED - Use dashboard button to start trading manually');
      });

      return server;
    } catch (error) {
      log.error('❌ Server startup failed', { error });
      process.exit(1);
    }
  }

  // Start server
  startServer();
})();
