import { Request, Response, NextFunction } from 'express';
import { log } from '../utils/logger';

// HTTPS enforcement middleware for production
export function enforceHTTPS(req: Request, res: Response, next: NextFunction) {
  // Skip in development
  if (process.env.NODE_ENV !== 'production') {
    return next();
  }

  // Check if request is secure
  const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
  
  if (!isSecure) {
    const httpsUrl = `https://${req.headers.host}${req.url}`;
    log.warn('Redirecting HTTP to HTTPS', { original: req.url, redirect: httpsUrl });
    return res.redirect(301, httpsUrl);
  }

  next();
}

// Security headers middleware
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Strict Transport Security (HSTS) - only in production
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  // Content Security Policy
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';");
  
  next();
}

// Rate limiting helper
export class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests: number = 100, windowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  check(identifier: string): boolean {
    const now = Date.now();
    const userRequests = this.requests.get(identifier) || [];
    
    // Filter out old requests
    const recentRequests = userRequests.filter(time => now - time < this.windowMs);
    
    if (recentRequests.length >= this.maxRequests) {
      return false;
    }
    
    recentRequests.push(now);
    this.requests.set(identifier, recentRequests);
    return true;
  }

  cleanup() {
    const now = Date.now();
    for (const [identifier, times] of Array.from(this.requests.entries())) {
      const recent = times.filter((time: number) => now - time < this.windowMs);
      if (recent.length === 0) {
        this.requests.delete(identifier);
      } else {
        this.requests.set(identifier, recent);
      }
    }
  }
}

// Rate limiting middleware
export function createRateLimiter(maxRequests: number = 100, windowMs: number = 60000) {
  const limiter = new RateLimiter(maxRequests, windowMs);
  
  // Cleanup old entries every minute
  setInterval(() => limiter.cleanup(), 60000);
  
  return (req: Request, res: Response, next: NextFunction) => {
    const identifier = req.ip || req.socket.remoteAddress || 'unknown';
    
    if (!limiter.check(identifier)) {
      log.warn('Rate limit exceeded', { ip: identifier, path: req.path });
      return res.status(429).json({ message: 'Too many requests, please try again later' });
    }
    
    next();
  };
}
