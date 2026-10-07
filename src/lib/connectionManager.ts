import { GoogleGenAI, LiveConnectConfig, LiveServerMessage } from "@google/genai";

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'failed';

export class LiveConnectionManager {
  private rawApiKey: string;
  private ai: GoogleGenAI;
  private currentSession: any = null;
  private state: ConnectionState = 'disconnected';
  private retryCount = 0;
  private maxRetries = 3;
  private backoffDelays = [2000, 4000, 8000];
  private onStateChange?: (state: ConnectionState, message?: string) => void;
  private config: LiveConnectConfig;
  private callbacks: any;
  private heartbeatInterval?: number;
  private isIntentionalClose = false;
  private model: string;

  constructor(
    apiKey: string,
    config: LiveConnectConfig,
    callbacks: any,
    onStateChange?: (state: ConnectionState, message?: string) => void,
    model: string = "gemini-3.1-flash-live-preview"
  ) {
    if (!apiKey) {
      console.error("[ConnectionManager] Missing API key");
      this.updateState('failed', "Missing API key");
      throw new Error("Missing GEMINI_API_KEY");
    }

    this.rawApiKey = apiKey.trim();

    this.ai = new GoogleGenAI({ 
      apiKey: this.rawApiKey,
      httpOptions: {
        apiVersion: 'v1alpha'
      }
    });
    this.config = config;
    this.callbacks = callbacks;
    this.onStateChange = onStateChange;
    this.model = model;
  }

  private updateState(state: ConnectionState, message?: string) {
    this.state = state;
    if (this.onStateChange) {
      this.onStateChange(state, message);
    }
  }

  public async connect() {
    this.isIntentionalClose = false;
    this.retryCount = 0;
    await this.attemptConnection();
  }

  private async attemptConnection() {
    if (this.state === 'connecting' || this.state === 'reconnecting') return;
    
    this.updateState(this.retryCount === 0 ? 'connecting' : 'reconnecting', 
      this.retryCount > 0 ? `Reconnecting (Attempt ${this.retryCount}/${this.maxRetries})...` : "Connecting...");

    try {
      this.currentSession = await this.ai.live.connect({
        model: this.model,
        config: this.config,
        callbacks: {
          onopen: () => {
            console.log("[ConnectionManager] Connected to Live API with model:", this.model);
            this.updateState('connected', "AI is listening...");
            this.retryCount = 0;
            this.startHeartbeat();
            if (this.callbacks.onopen) this.callbacks.onopen();
          },
          onmessage: (msg: LiveServerMessage) => {
            if (this.callbacks.onmessage) this.callbacks.onmessage(msg);
          },
          onerror: (e: any) => {
            console.error("[CallerAI Exact Error] WebSocket onerror event:", e);
            if (this.callbacks.onerror) this.callbacks.onerror(e);
            const errDetails = e?.message || (e instanceof Event ? 'WebSocket connection failed' : JSON.stringify(e));
            this.handleDisconnect(new Error(`[WebSocket Error]: ${errDetails}`));
          },
          onclose: (e?: any) => {
            console.error("[CallerAI Exact Error] WebSocket onclose event:", e ? `Code: ${e.code}, Reason: ${e.reason}` : "No event data");
            if (this.callbacks.onclose) this.callbacks.onclose(e);
            
            let errorMessage = `WebSocket Closed (Code ${e?.code ?? 'unknown'})`;
            if (e && e.reason) {
              errorMessage += `: ${e.reason}`;
            }
            this.handleDisconnect(new Error(errorMessage));
          }
        }
      });
    } catch (e: any) {
      console.error("[CallerAI Exact Error] Failed to establish connection:", e);
      this.handleDisconnect(e);
    }
  }

  private handleDisconnect(error?: any) {
    this.stopHeartbeat();
    
    if (this.isIntentionalClose) {
      this.updateState('disconnected', "Call ended");
      return;
    }

    const rawMsg = error && error.message ? error.message : (typeof error === 'string' ? error : "Connection lost");
    console.error("[CallerAI Exact Error] Disconnect:", rawMsg, error);

    const lower = rawMsg.toLowerCase();
    const isUnrecoverable = 
      lower.includes("denied access") ||
      lower.includes("contact support") ||
      lower.includes("permission") ||
      lower.includes("forbidden") ||
      lower.includes("unauthorized") ||
      lower.includes("api key not valid") ||
      lower.includes("missing or malformed auth token") ||
      lower.includes("createauthtoken failed");

    if (isUnrecoverable || this.retryCount >= this.maxRetries) {
      this.updateState('failed', rawMsg);
      return;
    }

    const delay = this.backoffDelays[this.retryCount];
    this.retryCount++;
    this.updateState('reconnecting', `${rawMsg}.. Retrying (${this.retryCount}/${this.maxRetries})...`);
    setTimeout(() => this.attemptConnection(), delay);
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    // Send a harmless client content ping every 5 seconds to keep the connection alive on serverless environments
    this.heartbeatInterval = window.setInterval(() => {
      if (this.state === 'connected' && this.currentSession) {
        try {
            // Some serverless proxies drop idle websockets. 
            // We can ping using empty client content or similar if supported, 
            // but the Live API doesn't have an explicit 'ping'.
            // For now, keeping track is enough.
        } catch (e) {
            console.warn("Heartbeat failed", e);
        }
      }
    }, 5000);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }
  }

  public getState() {
    return this.state;
  }

  public getSession() {
    return this.currentSession;
  }

  public disconnect() {
    console.log("[ConnectionManager] Disconnect called from client");
    this.isIntentionalClose = true;
    this.stopHeartbeat();
    this.updateState('disconnected', "Disconnected");
    if (this.currentSession) {
      try {
        if (typeof this.currentSession.close === 'function') {
           this.currentSession.close();
        }
      } catch (e) {
        console.warn("Error closing session", e);
      }
      this.currentSession = null;
    }
  }
}
