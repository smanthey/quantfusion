import { EventEmitter } from 'events';

// Advanced Order Type Definitions
export interface BaseOrder {
  id: string;
  symbol: string;
  type?: string;
  side: 'buy' | 'sell';
  quantity: number;
  status: 'pending' | 'partial' | 'filled' | 'cancelled' | 'rejected';
  createdAt: number;
  updatedAt: number;
}

export interface MarketOrder extends BaseOrder {
  type: 'market';
  timeInForce: 'IOC' | 'FOK'; // Immediate or Cancel, Fill or Kill
}

export interface LimitOrder extends BaseOrder {
  type: 'limit';
  price: number;
  timeInForce: 'GTC' | 'GTD' | 'IOC' | 'FOK';
  expireTime?: number;
}

export interface StopOrder extends BaseOrder {
  type: 'stop' | 'stop_limit';
  stopPrice: number;
  limitPrice?: number; // Only for stop_limit
  timeInForce: 'GTC' | 'GTD';
}

export interface IcebergOrder extends BaseOrder {
  type: 'iceberg';
  visibleQuantity: number;
  totalQuantity: number;
  price: number;
  executedQuantity: number;
}

export interface TWAPOrder extends BaseOrder {
  type: 'twap';
  duration: number; // Duration in minutes
  intervalMinutes: number;
  startTime?: number;
  endTime?: number;
  executedQuantity: number;
  slices: TWAPSlice[];
}

export interface VWAPOrder extends BaseOrder {
  type: 'vwap';
  participationRate: number; // 0.1 = 10%
  startTime?: number;
  endTime?: number;
  executedQuantity: number;
  volumeProfile: VolumeProfile[];
}

export interface POVOrder extends BaseOrder {
  type: 'pov';
  participationRate: number;
  maxParticipationRate?: number;
  executedQuantity: number;
}

export interface ISOrder extends BaseOrder {
  type: 'implementation_shortfall';
  startPrice: number;
  riskAversion: number; // Higher = trade faster
  marketImpactModel: MarketImpactModel;
  executedQuantity: number;
}

export interface TWAPSlice {
  id: string;
  quantity: number;
  executionTime: number;
  status: 'pending' | 'executed';
  executedPrice?: number;
  executedQuantity?: number;
}

export interface VolumeProfile {
  timeSlot: string; // '09:30', '10:00', etc.
  expectedVolumePercent: number;
}

export interface MarketImpactModel {
  permanentImpact: number;
  temporaryImpact: number;
  volatility: number;
}

export interface ExecutionResult {
  orderId: string;
  executedQuantity: number;
  executedPrice: number;
  commission: number;
  timestamp: number;
  venue?: string;
}

// Execution Algorithms
export class TWAPExecutor extends EventEmitter {
  private orders: Map<string, TWAPOrder> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();

  async submitOrder(order: TWAPOrder): Promise<string> {
    // Validate order
    if (order.quantity <= 0 || order.duration <= 0) {
      throw new Error('Invalid TWAP order parameters');
    }

    // Calculate slices
    const numSlices = Math.ceil(order.duration / order.intervalMinutes);
    const sliceQuantity = order.quantity / numSlices;
    
    order.slices = [];
    const startTime = order.startTime || Date.now();
    
    for (let i = 0; i < numSlices; i++) {
      order.slices.push({
        id: `${order.id}_slice_${i}`,
        quantity: i === numSlices - 1 ? 
          order.quantity - (sliceQuantity * (numSlices - 1)) : // Last slice gets remainder
          sliceQuantity,
        executionTime: startTime + (i * order.intervalMinutes * 60 * 1000),
        status: 'pending'
      });
    }

    this.orders.set(order.id, order);
    this.scheduleExecution(order);
    
    this.emit('orderSubmitted', { orderId: order.id, order });
    return order.id;
  }

  private scheduleExecution(order: TWAPOrder): void {
    const executeSlice = async (slice: TWAPSlice) => {
      try {
        const result = await this.executeSlice(order, slice);
        
        slice.status = 'executed';
        slice.executedPrice = result.executedPrice;
        slice.executedQuantity = result.executedQuantity;
        
        order.executedQuantity += result.executedQuantity;
        order.updatedAt = Date.now();
        
        if (order.executedQuantity >= order.quantity) {
          order.status = 'filled';
        }
        
        this.emit('sliceExecuted', { orderId: order.id, slice, result });
        
        // Check if order is complete
        if (order.slices.every(s => s.status === 'executed')) {
          this.emit('orderCompleted', { orderId: order.id, order });
          this.timers.delete(order.id);
        }
        
      } catch (error) {
        this.emit('executionError', { orderId: order.id, slice, error });
      }
    };

    // Schedule each slice
    order.slices.forEach((slice, index) => {
      const delay = slice.executionTime - Date.now();
      
      if (delay > 0) {
        const timer = setTimeout(() => executeSlice(slice), delay);
        this.timers.set(`${order.id}_${index}`, timer);
      } else {
        // Execute immediately if time has passed
        executeSlice(slice);
      }
    });
  }

  private async executeSlice(order: TWAPOrder, slice: TWAPSlice): Promise<ExecutionResult> {
    // Mock execution - in production, this would interface with exchange API
    const currentPrice = await this.getCurrentPrice(order.symbol);
    const executedPrice = this.addSlippage(currentPrice, slice.quantity, order.side);
    
    return {
      orderId: order.id,
      executedQuantity: slice.quantity,
      executedPrice,
      commission: slice.quantity * executedPrice * 0.001, // 0.1% commission
      timestamp: Date.now(),
      venue: 'BINANCE'
    };
  }

  cancelOrder(orderId: string): boolean {
    const order = this.orders.get(orderId);
    if (!order || order.status === 'filled') return false;

    order.status = 'cancelled';
    
    // Cancel pending timers
    order.slices.forEach((slice, index) => {
      if (slice.status === 'pending') {
        const timer = this.timers.get(`${orderId}_${index}`);
        if (timer) clearTimeout(timer);
      }
    });

    this.emit('orderCancelled', { orderId, order });
    return true;
  }

  private async getCurrentPrice(symbol: string): Promise<number> {
    // Mock implementation - replace with real market data
    const basePrice = symbol === 'BTCUSDT' ? 43000 : 2500;
    return basePrice * (1 + (Math.random() - 0.5) * 0.01); // ±0.5% random variation
  }

  private addSlippage(price: number, quantity: number, side: 'buy' | 'sell'): number {
    // Simple slippage model - larger orders have more slippage
    const slippageBps = Math.min(10, quantity / 1000); // Up to 10 bps
    const slippageMultiplier = side === 'buy' ? (1 + slippageBps / 10000) : (1 - slippageBps / 10000);
    
    return price * slippageMultiplier;
  }

  getOrder(orderId: string): TWAPOrder | undefined {
    return this.orders.get(orderId);
  }

  getAllOrders(): TWAPOrder[] {
    return Array.from(this.orders.values());
  }
}

export class VWAPExecutor extends EventEmitter {
  private orders: Map<string, VWAPOrder> = new Map();
  private defaultVolumeProfile: VolumeProfile[] = [
    { timeSlot: '09:30', expectedVolumePercent: 0.15 },
    { timeSlot: '10:00', expectedVolumePercent: 0.12 },
    { timeSlot: '11:00', expectedVolumePercent: 0.08 },
    { timeSlot: '12:00', expectedVolumePercent: 0.06 },
    { timeSlot: '13:00', expectedVolumePercent: 0.05 },
    { timeSlot: '14:00', expectedVolumePercent: 0.07 },
    { timeSlot: '15:00', expectedVolumePercent: 0.10 },
    { timeSlot: '15:30', expectedVolumePercent: 0.37 } // Market close surge
  ];

  async submitOrder(order: VWAPOrder): Promise<string> {
    if (!order.volumeProfile || order.volumeProfile.length === 0) {
      order.volumeProfile = this.defaultVolumeProfile;
    }

    this.orders.set(order.id, order);
    this.startVWAPExecution(order);
    
    this.emit('orderSubmitted', { orderId: order.id, order });
    return order.id;
  }

  private startVWAPExecution(order: VWAPOrder): void {
    const executionInterval = setInterval(async () => {
      try {
        if (order.status === 'filled' || order.status === 'cancelled') {
          clearInterval(executionInterval);
          return;
        }

        const currentTime = new Date();
        const timeSlot = `${currentTime.getHours()}:${currentTime.getMinutes().toString().padStart(2, '0')}`;
        
        const volumeProfile = this.findNearestVolumeProfile(order.volumeProfile, timeSlot);
        const currentVolume = await this.getCurrentVolume(order.symbol);
        
        const targetQuantity = Math.min(
          currentVolume * order.participationRate * volumeProfile.expectedVolumePercent,
          order.quantity - order.executedQuantity
        );

        if (targetQuantity > 0) {
          const result = await this.executeVWAPSlice(order, targetQuantity);
          
          order.executedQuantity += result.executedQuantity;
          order.updatedAt = Date.now();
          
          if (order.executedQuantity >= order.quantity) {
            order.status = 'filled';
            this.emit('orderCompleted', { orderId: order.id, order });
          }
          
          this.emit('sliceExecuted', { orderId: order.id, result });
        }
        
      } catch (error) {
        this.emit('executionError', { orderId: order.id, error });
      }
    }, 30000); // Execute every 30 seconds
  }

  private findNearestVolumeProfile(profiles: VolumeProfile[], timeSlot: string): VolumeProfile {
    // Simple implementation - in production, use more sophisticated time matching
    return profiles.find(p => p.timeSlot <= timeSlot) || profiles[profiles.length - 1];
  }

  private async getCurrentVolume(symbol: string): Promise<number> {
    // Mock implementation - replace with real market data
    return Math.random() * 1000000 + 500000; // Random volume between 0.5M - 1.5M
  }

  private async executeVWAPSlice(order: VWAPOrder, quantity: number): Promise<ExecutionResult> {
    const currentPrice = await this.getCurrentPrice(order.symbol);
    const executedPrice = this.addSlippage(currentPrice, quantity, order.side);
    
    return {
      orderId: order.id,
      executedQuantity: quantity,
      executedPrice,
      commission: quantity * executedPrice * 0.001,
      timestamp: Date.now(),
      venue: 'BINANCE'
    };
  }

  private async getCurrentPrice(symbol: string): Promise<number> {
    const basePrice = symbol === 'BTCUSDT' ? 43000 : 2500;
    return basePrice * (1 + (Math.random() - 0.5) * 0.01);
  }

  private addSlippage(price: number, quantity: number, side: 'buy' | 'sell'): number {
    const slippageBps = Math.min(10, quantity / 1000);
    const slippageMultiplier = side === 'buy' ? (1 + slippageBps / 10000) : (1 - slippageBps / 10000);
    return price * slippageMultiplier;
  }
}

export class IcebergExecutor extends EventEmitter {
  private orders: Map<string, IcebergOrder> = new Map();

  async submitOrder(order: IcebergOrder): Promise<string> {
    if (order.visibleQuantity >= order.totalQuantity) {
      throw new Error('Visible quantity must be less than total quantity');
    }

    this.orders.set(order.id, order);
    this.executeNextSlice(order);
    
    this.emit('orderSubmitted', { orderId: order.id, order });
    return order.id;
  }

  private async executeNextSlice(order: IcebergOrder): Promise<void> {
    const remainingQuantity = order.totalQuantity - order.executedQuantity;
    if (remainingQuantity <= 0) {
      order.status = 'filled';
      this.emit('orderCompleted', { orderId: order.id, order });
      return;
    }

    const sliceQuantity = Math.min(order.visibleQuantity, remainingQuantity);
    
    try {
      // Submit visible slice to market
      const result = await this.executeSlice(order, sliceQuantity);
      
      order.executedQuantity += result.executedQuantity;
      order.updatedAt = Date.now();
      
      this.emit('sliceExecuted', { orderId: order.id, result });
      
      // Schedule next slice after a small delay to avoid detection
      setTimeout(() => this.executeNextSlice(order), Math.random() * 5000 + 1000); // 1-6 second delay
      
    } catch (error) {
      this.emit('executionError', { orderId: order.id, error });
    }
  }

  private async executeSlice(order: IcebergOrder, quantity: number): Promise<ExecutionResult> {
    // Mock implementation - in production, submit limit order to exchange
    const executedPrice = order.price;
    
    return {
      orderId: order.id,
      executedQuantity: quantity,
      executedPrice,
      commission: quantity * executedPrice * 0.001,
      timestamp: Date.now(),
      venue: 'BINANCE'
    };
  }
}

// Smart Order Router
export class SmartOrderRouter extends EventEmitter {
  private venues: Map<string, VenueInfo> = new Map();

  constructor() {
    super();
    this.initializeVenues();
  }

  private initializeVenues(): void {
    this.venues.set('BINANCE', {
      name: 'BINANCE',
      fees: { maker: -0.001, taker: 0.001 }, // Maker rebate, taker fee
      latency: 50, // milliseconds
      reliability: 0.999,
      marketShare: 0.6
    });
    
    this.venues.set('COINBASE', {
      name: 'COINBASE',
      fees: { maker: 0.0005, taker: 0.005 },
      latency: 75,
      reliability: 0.995,
      marketShare: 0.25
    });
    
    this.venues.set('KRAKEN', {
      name: 'KRAKEN',
      fees: { maker: 0.0016, taker: 0.0026 },
      latency: 100,
      reliability: 0.992,
      marketShare: 0.15
    });
  }

  async routeOrder(order: BaseOrder): Promise<string> {
    const bestVenue = await this.findBestVenue(order);
    
    this.emit('orderRouted', { 
      orderId: order.id, 
      venue: bestVenue.name,
      expectedSavings: bestVenue.expectedSavings 
    });
    
    return bestVenue.name;
  }

  private async findBestVenue(order: BaseOrder): Promise<{ name: string; expectedSavings: number }> {
    const quotes = await this.getQuotes(order.symbol);
    let bestVenue = '';
    let bestNetPrice = 0;
    let bestSavings = 0;

    for (const [venueName, venue] of Array.from(this.venues.entries())) {
      const quote = quotes[venueName];
      if (!quote) continue;

      const price = order.side === 'buy' ? quote.ask : quote.bid;
      const fee = order.side === 'buy' ? venue.fees.taker : venue.fees.maker;
      const netPrice = price * (1 + fee);
      
      // Factor in latency and reliability
      const adjustedPrice = netPrice * (1 + venue.latency / 10000) * (2 - venue.reliability);
      
      if (bestVenue === '' || 
          (order.side === 'buy' && adjustedPrice < bestNetPrice) ||
          (order.side === 'sell' && adjustedPrice > bestNetPrice)) {
        bestVenue = venueName;
        bestNetPrice = adjustedPrice;
        bestSavings = Math.abs(adjustedPrice - netPrice);
      }
    }

    return { name: bestVenue, expectedSavings: bestSavings };
  }

  private async getQuotes(symbol: string): Promise<Record<string, { bid: number; ask: number }>> {
    // Mock implementation - in production, get real quotes from each venue
    const basePrice = symbol === 'BTCUSDT' ? 43000 : 2500;
    const quotes: Record<string, { bid: number; ask: number }> = {};
    
    for (const venueName of Array.from(this.venues.keys())) {
      const spread = Math.random() * 0.001 + 0.0005; // 0.05% - 0.15% spread
      quotes[venueName] = {
        bid: basePrice * (1 - spread/2 + (Math.random() - 0.5) * 0.001),
        ask: basePrice * (1 + spread/2 + (Math.random() - 0.5) * 0.001)
      };
    }
    
    return quotes;
  }
}

interface VenueInfo {
  name: string;
  fees: { maker: number; taker: number };
  latency: number; // milliseconds
  reliability: number; // 0-1
  marketShare: number;
}

// Order Manager - Central coordinator for all order types
export class AdvancedOrderManager extends EventEmitter {
  private twapExecutor: TWAPExecutor;
  private vwapExecutor: VWAPExecutor;
  private icebergExecutor: IcebergExecutor;
  private smartRouter: SmartOrderRouter;
  
  private allOrders: Map<string, BaseOrder> = new Map();

  constructor() {
    super();
    
    this.twapExecutor = new TWAPExecutor();
    this.vwapExecutor = new VWAPExecutor();
    this.icebergExecutor = new IcebergExecutor();
    this.smartRouter = new SmartOrderRouter();
    
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Forward events from executors
    [this.twapExecutor, this.vwapExecutor, this.icebergExecutor, this.smartRouter]
      .forEach(executor => {
        executor.on('orderSubmitted', (data) => this.emit('orderSubmitted', data));
        executor.on('sliceExecuted', (data) => this.emit('sliceExecuted', data));
        executor.on('orderCompleted', (data) => this.emit('orderCompleted', data));
        executor.on('executionError', (data) => this.emit('executionError', data));
      });
  }

  async submitOrder(order: BaseOrder): Promise<string> {
    this.allOrders.set(order.id, order);
    
    switch (order.type) {
      case 'twap':
        return this.twapExecutor.submitOrder(order as TWAPOrder);
      
      case 'vwap':
        return this.vwapExecutor.submitOrder(order as VWAPOrder);
      
      case 'iceberg':
        return this.icebergExecutor.submitOrder(order as IcebergOrder);
      
      default:
        // For other order types, use smart order routing
        const venue = await this.smartRouter.routeOrder(order);
        this.emit('orderSubmitted', { orderId: order.id, order, venue });
        return order.id;
    }
  }

  cancelOrder(orderId: string): boolean {
    const order = this.allOrders.get(orderId);
    if (!order) return false;

    switch (order.type) {
      case 'twap':
        return this.twapExecutor.cancelOrder(orderId);
      default:
        order.status = 'cancelled';
        this.emit('orderCancelled', { orderId, order });
        return true;
    }
  }

  getOrder(orderId: string): BaseOrder | undefined {
    return this.allOrders.get(orderId);
  }

  getAllOrders(): BaseOrder[] {
    return Array.from(this.allOrders.values());
  }

  getOrdersByStatus(status: BaseOrder['status']): BaseOrder[] {
    return Array.from(this.allOrders.values()).filter(order => order.status === status);
  }
}
