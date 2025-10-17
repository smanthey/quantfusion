/**
 * Sentiment Analyzer - Analyzes news and social media sentiment
 * Features:
 * - Multi-source sentiment aggregation (News, Twitter, Reddit, Crypto forums)
 * - NLP-based sentiment scoring
 * - Real-time sentiment tracking
 * - Historical sentiment correlation with price movements
 * - Sentiment momentum and trend detection
 */

interface SentimentData {
  source: string;
  symbol: string;
  sentiment: number; // -1 to 1 (negative to positive)
  confidence: number;
  volume: number; // number of mentions
  timestamp: number;
  keywords: string[];
}

interface AggregateSentiment {
  symbol: string;
  overall: number; // -1 to 1
  confidence: number;
  trend: 'improving' | 'declining' | 'stable';
  sources: {
    news: number;
    social: number;
    forums: number;
  };
  momentum: number; // rate of change
  volumeWeighted: number; // sentiment weighted by mention volume
  timestamp: number;
}

export class SentimentAnalyzer {
  private sentimentHistory: Map<string, SentimentData[]> = new Map();
  private keywords: Map<string, string[]> = new Map();
  private sentimentWeights = {
    news: 0.4,
    social: 0.35,
    forums: 0.25
  };

  constructor() {
    this.initializeKeywords();
  }

  private initializeKeywords() {
    // Positive keywords
    this.keywords.set('positive', [
      'bullish', 'moon', 'pump', 'rally', 'breakout', 'surge', 'adoption',
      'institutional', 'partnership', 'integration', 'upgrade', 'launch',
      'milestone', 'ath', 'growth', 'strong', 'buy', 'accumulate'
    ]);

    // Negative keywords
    this.keywords.set('negative', [
      'bearish', 'dump', 'crash', 'collapse', 'scam', 'hack', 'regulation',
      'ban', 'lawsuit', 'concern', 'fear', 'sell', 'decline', 'drop',
      'plunge', 'resistance', 'correction', 'liquidation'
    ]);

    // Neutral/context keywords
    this.keywords.set('neutral', [
      'analysis', 'review', 'update', 'news', 'announcement', 'report',
      'data', 'chart', 'price', 'volume', 'market', 'trading'
    ]);
  }

  /**
   * Analyze text sentiment using NLP-like approach
   */
  private analyzeSentiment(text: string): { score: number; confidence: number } {
    const words = text.toLowerCase().split(/\s+/);
    const positiveWords = this.keywords.get('positive')!;
    const negativeWords = this.keywords.get('negative')!;
    
    let positiveCount = 0;
    let negativeCount = 0;
    let intensifiers = 0;
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      
      // Check for intensifiers
      if (['very', 'extremely', 'highly', 'strongly'].includes(word)) {
        intensifiers++;
        continue;
      }
      
      // Count sentiment words
      if (positiveWords.some(pw => word.includes(pw))) {
        positiveCount += (1 + intensifiers * 0.5);
      }
      if (negativeWords.some(nw => word.includes(nw))) {
        negativeCount += (1 + intensifiers * 0.5);
      }
      
      intensifiers = 0; // Reset after use
    }
    
    const total = positiveCount + negativeCount;
    const score = total > 0 
      ? (positiveCount - negativeCount) / total 
      : 0;
    
    const confidence = Math.min(total / 10, 1); // More words = higher confidence
    
    return { score, confidence };
  }

  /**
   * Simulate fetching news sentiment
   */
  private async fetchNewsSentiment(symbol: string): Promise<SentimentData> {
    // Simulate news sentiment (in production, integrate with NewsAPI, Cryptopanic, etc.)
    const mockNews = [
      'Bitcoin shows strong bullish momentum as institutional adoption increases',
      'Ethereum upgrade launches successfully, market responds positively',
      'Crypto market faces regulatory concerns but fundamentals remain strong',
      'Major partnership announcement drives bullish sentiment',
      'Technical analysis suggests potential breakout for major cryptocurrencies'
    ];
    
    const newsText = mockNews[Math.floor(Math.random() * mockNews.length)];
    const sentiment = this.analyzeSentiment(newsText);
    
    return {
      source: 'news',
      symbol,
      sentiment: sentiment.score,
      confidence: sentiment.confidence,
      volume: Math.floor(Math.random() * 50) + 10,
      timestamp: Date.now(),
      keywords: this.extractKeywords(newsText)
    };
  }

  /**
   * Simulate fetching social media sentiment
   */
  private async fetchSocialSentiment(symbol: string): Promise<SentimentData> {
    // Simulate social sentiment (in production, integrate with Twitter API, Reddit API)
    const mockSocial = [
      'BTC to the moon! Bullish on this breakout pattern',
      'Seeing strong resistance at current levels, might see a correction',
      'Just bought more ETH, fundamentals looking strong',
      'Bearish short term but long term outlook remains positive',
      'Volume increasing, could signal a major move coming'
    ];
    
    const socialText = mockSocial[Math.floor(Math.random() * mockSocial.length)];
    const sentiment = this.analyzeSentiment(socialText);
    
    return {
      source: 'social',
      symbol,
      sentiment: sentiment.score,
      confidence: sentiment.confidence,
      volume: Math.floor(Math.random() * 200) + 50,
      timestamp: Date.now(),
      keywords: this.extractKeywords(socialText)
    };
  }

  /**
   * Simulate fetching forum sentiment
   */
  private async fetchForumSentiment(symbol: string): Promise<SentimentData> {
    // Simulate forum sentiment (in production, integrate with BitcoinTalk, Crypto Reddit, etc.)
    const mockForum = [
      'Technical analysis points to accumulation phase, bullish setup forming',
      'Market sentiment shifting, traders taking profits at resistance',
      'Strong fundamentals support long-term growth thesis',
      'Short-term volatility expected, long-term holders accumulating',
      'Institutional interest driving positive sentiment shift'
    ];
    
    const forumText = mockForum[Math.floor(Math.random() * mockForum.length)];
    const sentiment = this.analyzeSentiment(forumText);
    
    return {
      source: 'forum',
      symbol,
      sentiment: sentiment.score,
      confidence: sentiment.confidence,
      volume: Math.floor(Math.random() * 100) + 20,
      timestamp: Date.now(),
      keywords: this.extractKeywords(forumText)
    };
  }

  /**
   * Extract keywords from text
   */
  private extractKeywords(text: string): string[] {
    const words = text.toLowerCase().split(/\s+/);
    const allKeywords = [
      ...this.keywords.get('positive')!,
      ...this.keywords.get('negative')!,
      ...this.keywords.get('neutral')!
    ];
    
    return words.filter(word => 
      allKeywords.some(kw => word.includes(kw))
    ).slice(0, 5);
  }

  /**
   * Get aggregate sentiment from all sources
   */
  async getAggregateSentiment(symbol: string): Promise<AggregateSentiment> {
    try {
      // Fetch from all sources in parallel
      const [news, social, forum] = await Promise.all([
        this.fetchNewsSentiment(symbol),
        this.fetchSocialSentiment(symbol),
        this.fetchForumSentiment(symbol)
      ]);

      // Store in history
      const history = this.sentimentHistory.get(symbol) || [];
      history.push(news, social, forum);
      
      // Keep only recent data (last 1000 entries)
      if (history.length > 1000) {
        history.splice(0, history.length - 1000);
      }
      this.sentimentHistory.set(symbol, history);

      // Calculate weighted average sentiment
      const overall = (
        news.sentiment * this.sentimentWeights.news +
        social.sentiment * this.sentimentWeights.social +
        forum.sentiment * this.sentimentWeights.forums
      );

      // Calculate volume-weighted sentiment
      const totalVolume = news.volume + social.volume + forum.volume;
      const volumeWeighted = (
        news.sentiment * (news.volume / totalVolume) +
        social.sentiment * (social.volume / totalVolume) +
        forum.sentiment * (forum.volume / totalVolume)
      );

      // Calculate confidence (average of all sources)
      const confidence = (
        news.confidence * this.sentimentWeights.news +
        social.confidence * this.sentimentWeights.social +
        forum.confidence * this.sentimentWeights.forums
      );

      // Determine trend
      const trend = this.calculateSentimentTrend(symbol);
      
      // Calculate momentum (rate of change)
      const momentum = this.calculateSentimentMomentum(symbol);

      return {
        symbol,
        overall,
        confidence,
        trend,
        sources: {
          news: news.sentiment,
          social: social.sentiment,
          forums: forum.sentiment
        },
        momentum,
        volumeWeighted,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error(`Error getting aggregate sentiment for ${symbol}:`, error);
      // Return neutral sentiment on error
      return {
        symbol,
        overall: 0,
        confidence: 0,
        trend: 'stable',
        sources: { news: 0, social: 0, forums: 0 },
        momentum: 0,
        volumeWeighted: 0,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Calculate sentiment trend
   */
  private calculateSentimentTrend(symbol: string): 'improving' | 'declining' | 'stable' {
    const history = this.sentimentHistory.get(symbol) || [];
    if (history.length < 10) return 'stable';

    const recent = history.slice(-10);
    const older = history.slice(-20, -10);
    
    const recentAvg = recent.reduce((sum, s) => sum + s.sentiment, 0) / recent.length;
    const olderAvg = older.reduce((sum, s) => sum + s.sentiment, 0) / older.length;
    
    const change = recentAvg - olderAvg;
    
    if (change > 0.1) return 'improving';
    if (change < -0.1) return 'declining';
    return 'stable';
  }

  /**
   * Calculate sentiment momentum (rate of change)
   */
  private calculateSentimentMomentum(symbol: string): number {
    const history = this.sentimentHistory.get(symbol) || [];
    if (history.length < 20) return 0;

    const recent = history.slice(-10);
    const older = history.slice(-20, -10);
    
    const recentAvg = recent.reduce((sum, s) => sum + s.sentiment, 0) / recent.length;
    const olderAvg = older.reduce((sum, s) => sum + s.sentiment, 0) / older.length;
    
    return recentAvg - olderAvg;
  }

  /**
   * Get sentiment signal for trading
   */
  getSentimentSignal(sentiment: AggregateSentiment): {
    signal: 'buy' | 'sell' | 'neutral';
    strength: number;
  } {
    // Strong bullish sentiment
    if (sentiment.overall > 0.4 && sentiment.confidence > 0.6 && sentiment.trend === 'improving') {
      return { signal: 'buy', strength: sentiment.overall * sentiment.confidence };
    }
    
    // Strong bearish sentiment
    if (sentiment.overall < -0.4 && sentiment.confidence > 0.6 && sentiment.trend === 'declining') {
      return { signal: 'sell', strength: Math.abs(sentiment.overall) * sentiment.confidence };
    }
    
    // Neutral or uncertain
    return { signal: 'neutral', strength: 0 };
  }

  /**
   * Get sentiment history for analysis
   */
  getSentimentHistory(symbol: string, limit: number = 100): SentimentData[] {
    const history = this.sentimentHistory.get(symbol) || [];
    return history.slice(-limit);
  }

  /**
   * Clear old sentiment data
   */
  clearOldData(maxAge: number = 86400000): void { // 24 hours default
    const cutoff = Date.now() - maxAge;
    
    for (const [symbol, history] of this.sentimentHistory.entries()) {
      const filtered = history.filter(s => s.timestamp > cutoff);
      this.sentimentHistory.set(symbol, filtered);
    }
  }
}
