/**
 * ActiveCallsRoom Durable Object
 * Manages real-time active call state per user/workspace
 * Handles WebSocket connections for instant updates
 */

export interface ActiveCall {
  id: string;
  vapi_call_id: string;
  customer_number: string | null;
  caller_name: string | null;
  carrier_name: string | null;
  line_type: string | null;
  status: string;
  started_at: number;
  updated_at: number;
}

interface WebSocketMessage {
  type: 'init' | 'update' | 'add' | 'remove' | 'ping' | 'pong';
  calls?: ActiveCall[];
  call?: ActiveCall;
  callId?: string;
}

export class ActiveCallsRoom {
  private state: DurableObjectState;
  private env: any;
  private activeCalls: Map<string, ActiveCall> = new Map();
  private initialized: boolean = false;

  constructor(state: DurableObjectState, env: any) {
    this.state = state;
    this.env = env;
    
    // Restore hibernated WebSockets and reload state
    this.state.getWebSockets().forEach(ws => {
      // WebSockets are automatically restored by the runtime
      console.log('[ActiveCallsRoom] Restored hibernated WebSocket');
    });
  }

  /**
   * Initialize state from D1 database
   */
  private async initialize(userId: string): Promise<void> {
    if (this.initialized) return;

    try {
      // Load active calls from D1 for this user
      const { results } = await this.env.DB.prepare(
        `SELECT id, vapi_call_id, customer_number, caller_name, carrier_name, 
                line_type, status, started_at, updated_at
         FROM active_calls WHERE user_id = ?
         ORDER BY started_at DESC`
      ).bind(userId).all();

      // Populate in-memory state
      for (const call of results as ActiveCall[]) {
        this.activeCalls.set(call.vapi_call_id, call);
      }

      this.initialized = true;
      console.log(`[ActiveCallsRoom] Initialized with ${this.activeCalls.size} calls for user ${userId}`);
    } catch (error) {
      console.error('[ActiveCallsRoom] Error initializing from D1:', error);
    }
  }

  /**
   * Handle incoming HTTP requests (WebSocket upgrades and API calls)
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Handle WebSocket upgrade
    if (request.headers.get('Upgrade') === 'websocket') {
      return this.handleWebSocket(request, url);
    }

    // Handle internal API calls from worker
    if (url.pathname === '/internal/update-call') {
      return this.handleUpdateCall(request);
    }

    if (url.pathname === '/internal/remove-call') {
      return this.handleRemoveCall(request);
    }

    if (url.pathname === '/internal/get-calls') {
      return this.handleGetCalls(request);
    }

    return new Response('Not found', { status: 404 });
  }

  /**
   * Handle WebSocket connection
   */
  private async handleWebSocket(request: Request, url: URL): Promise<Response> {
    const userId = url.searchParams.get('userId');
    if (!userId) {
      return new Response('Missing userId', { status: 400 });
    }

    // Initialize state from D1 if needed
    await this.initialize(userId);

    // Create WebSocket pair
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Accept the WebSocket with hibernation API and store userId as attachment
    this.state.acceptWebSocket(server, ['active-calls']);
    
    // Store user info in WebSocket attachment (persists through hibernation)
    server.serializeAttachment({ userId });

    // Send initial state
    const initMessage: WebSocketMessage = {
      type: 'init',
      calls: Array.from(this.activeCalls.values())
    };

    server.send(JSON.stringify(initMessage));

    const totalSessions = this.state.getWebSockets().length;
    console.log(`[ActiveCallsRoom] WebSocket connected for user ${userId}, total sessions: ${totalSessions}`);

    return new Response(null, { status: 101, webSocket: client });
  }

  /**
   * Handle WebSocket messages
   */
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    try {
      const data = JSON.parse(message as string) as WebSocketMessage;

      // Handle ping/pong for keep-alive
      if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
      }
    } catch (error) {
      console.error('[ActiveCallsRoom] Error handling WebSocket message:', error);
    }
  }

  /**
   * Handle WebSocket close
   */
  async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    const attachment = ws.deserializeAttachment() as { userId: string } | null;
    const remaining = this.state.getWebSockets().length;
    console.log(`[ActiveCallsRoom] WebSocket closed for user ${attachment?.userId}, code: ${code}, remaining: ${remaining}`);
  }

  /**
   * Handle WebSocket error
   */
  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    const attachment = ws.deserializeAttachment() as { userId: string } | null;
    console.error(`[ActiveCallsRoom] WebSocket error for user ${attachment?.userId}:`, error);
  }

  /**
   * Broadcast message to all connected WebSockets
   */
  private broadcast(message: WebSocketMessage): void {
    const messageStr = JSON.stringify(message);
    
    // Use hibernation API to get all connected WebSockets
    const webSockets = this.state.getWebSockets();
    const sessionCount = webSockets.length;
    
    console.log(`[ActiveCallsRoom] Broadcasting ${message.type} to ${sessionCount} session(s)`);
    
    if (sessionCount === 0) {
      console.log('[ActiveCallsRoom] No WebSocket sessions connected to receive broadcast');
      return;
    }
    
    for (const ws of webSockets) {
      try {
        ws.send(messageStr);
        console.log('[ActiveCallsRoom] Message sent to WebSocket client');
      } catch (error) {
        console.error('[ActiveCallsRoom] Error broadcasting to WebSocket:', error);
        // WebSocket will be cleaned up by the runtime
      }
    }
  }

  /**
   * Handle call update (add or update)
   */
  private async handleUpdateCall(request: Request): Promise<Response> {
    try {
      const call = await request.json() as ActiveCall;
      
      const isNew = !this.activeCalls.has(call.vapi_call_id);
      this.activeCalls.set(call.vapi_call_id, call);

      // Broadcast to all connected clients
      const message: WebSocketMessage = {
        type: isNew ? 'add' : 'update',
        call
      };
      this.broadcast(message);

      console.log(`[ActiveCallsRoom] Call ${isNew ? 'added' : 'updated'}: ${call.vapi_call_id}, status: ${call.status}`);

      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('[ActiveCallsRoom] Error updating call:', error);
      return new Response(JSON.stringify({ error: 'Failed to update call' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Handle call removal
   */
  private async handleRemoveCall(request: Request): Promise<Response> {
    try {
      const { callId } = await request.json() as { callId: string };
      
      if (this.activeCalls.has(callId)) {
        this.activeCalls.delete(callId);

        // Broadcast removal to all clients
        const message: WebSocketMessage = {
          type: 'remove',
          callId
        };
        this.broadcast(message);

        console.log(`[ActiveCallsRoom] Call removed: ${callId}`);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('[ActiveCallsRoom] Error removing call:', error);
      return new Response(JSON.stringify({ error: 'Failed to remove call' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Handle get calls request (for fallback/REST API)
   */
  private async handleGetCalls(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      const userId = url.searchParams.get('userId');

      if (userId && !this.initialized) {
        await this.initialize(userId);
      }

      return new Response(JSON.stringify(Array.from(this.activeCalls.values())), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('[ActiveCallsRoom] Error getting calls:', error);
      return new Response(JSON.stringify({ error: 'Failed to get calls' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
}

