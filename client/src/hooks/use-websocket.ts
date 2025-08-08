import { useEffect, useState, useRef } from 'react';

export interface WebSocketData {
  type: 'market_data' | 'trade' | 'position' | 'alert' | 'regime';
  data: any;
  timestamp: number;
}

export function useWebSocket(url: string) {
  const [data, setData] = useState<WebSocketData | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ws = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = () => {
    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      console.log(`Attempting WebSocket connection to: ${wsUrl}`);
      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        console.log('✅ WebSocket connected successfully');
        setIsConnected(true);
        setError(null);
        reconnectAttempts.current = 0;
        
        // Send a ping to verify connection
        if (ws.current?.readyState === WebSocket.OPEN) {
          ws.current.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
        }
      };

      ws.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          // Handle pong responses
          if (message.type === 'pong') {
            console.log('📡 WebSocket ping/pong successful');
            return;
          }
          
          // Update data with timestamp for freshness checking
          setData({ ...message, receivedAt: Date.now() });
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err, event.data);
        }
      };

      ws.current.onclose = (event) => {
        console.log('🔌 WebSocket disconnected:', event.code, event.reason);
        setIsConnected(false);

        // Don't reconnect if it was a clean close
        if (event.code === 1000) {
          console.log('WebSocket closed cleanly, not reconnecting');
          return;
        }

        // Attempt to reconnect with exponential backoff
        if (reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current += 1;
          const delay = Math.min(Math.pow(2, reconnectAttempts.current) * 1000, 30000); // Max 30s delay
          console.log(`🔄 Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current}/${maxReconnectAttempts})`);
          
          setTimeout(() => {
            if (reconnectAttempts.current <= maxReconnectAttempts) {
              connect();
            }
          }, delay);
        } else {
          setError('Max reconnection attempts reached. Please refresh the page.');
          console.error('❌ Max WebSocket reconnection attempts reached');
        }
      };

      ws.current.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        setError('WebSocket connection error');
      };
    } catch (err) {
      console.error('❌ Failed to create WebSocket connection:', err);
      setError('Failed to create WebSocket connection');
    }
  };

  useEffect(() => {
    connect();

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [url]);

  const sendMessage = (message: any) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
    }
  };

  return {
    data,
    isConnected,
    error,
    sendMessage
  };
}