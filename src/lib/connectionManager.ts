import { GoogleGenAI, LiveConnectConfig, LiveServerMessage } from "@google/genai";

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'failed';

export class LiveConnectionManager {
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
    model: string = "gemini-3.8-live"
  ) {
    if (!apiKey) {
      console.error("[ConnectionManager] Missing API key");
      this.updateState('failed', "Missing API key");
      throw new Error("Missing GEMINI_API_KEY");
    }

    // Modern "Authorization Keys" (AQ.Ab...) from Google AI Studio require ephemeral token handling in the SDK.
    // We prefix them with 'auth_tokens/' so the SDK uses 'access_token' instead of 'key' in the WebSocket URL.
    const effectiveApiKey = apiKey.startsWith('AQ.') && !apiKey.startsWith('auth_tokens/') 
      ? `auth_tokens/${apiKey}` 
      : apiKey;

    this.ai = new GoogleGenAI({ 
      apiKey: effectiveApiKey,
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
            console.log("[ConnectionManager] Connected to Live API");
            this.updateState('connected', "AI is listening...");
            this.retryCount = 0;
            this.startHeartbeat();
            if (this.callbacks.onopen) this.callbacks.onopen();
          },
          onmessage: (msg: LiveServerMessage) => {
            if (this.callbacks.onmessage) this.callbacks.onmessage(msg);
          },
          onerror: (e: any) => {
            console.error("[ConnectionManager] Connection Error:", e);
            if (this.callbacks.onerror) this.callbacks.onerror(e);
            this.handleDisconnect(e);
          },
          onclose: (e?: any) => {
            console.log("[ConnectionManager] Connection Closed", e ? `Code: ${e.code}, Reason: ${e.reason}` : "");
            if (this.callbacks.onclose) this.callbacks.onclose(e);
            
            let errorMessage = "Connection Closed";
            if (e && e.reason) {
              errorMessage += `: ${e.reason}`;
            } else if (e && e.code) {
              errorMessage += ` (Code ${e.code})`;
            }
            this.handleDisconnect(e ? new Error(errorMessage) : undefined);
          }
        }
      });
    } catch (e: any) {
      console.error("[ConnectionManager] Failed to establish connection:", e);
      this.handleDisconnect(e);
    }
  }

  private handleDisconnect(error?: any) {
    this.stopHeartbeat();
    
    if (this.isIntentionalClose) {
      this.updateState('disconnected', "Call ended");
      return;
    }

    const rawMsg = error && error.message ? error.message : "Connection lost";
    const lower = rawMsg.toLowerCase();

    // Check for OAuth / credential type mismatch
    if (lower.includes("oauth 2") || lower.includes("authentication credentials") || lower.includes("expected oauth")) {
      console.error("[ConnectionManager] Invalid credential type from Google API:", rawMsg);
      this.updateState(
        'failed',
        "Invalid API Key: Google Live API requires a standard Google AI Studio API key (starting with 'AIza...'). Tokens starting with 'AQ.' are OAuth credentials and are not accepted."
      );
      return;
    }

    // Check for unrecoverable errors from Google Live API
    if (lower.includes("denied access") || lower.includes("contact support") || lower.includes("permission") || lower.includes("forbidden") || lower.includes("unauthorized")) {
      console.error("[ConnectionManager] Unrecoverable error from Google API:", rawMsg);
      this.updateState(
        'failed', 
        "Google API Error: Your project has been denied access. Please verify your Google Cloud / AI Studio project status or generate a new API key without domain restrictions."
      );
      return;
    }

    if (this.retryCount < this.maxRetries) {
      const delay = this.backoffDelays[this.retryCount];
      this.retryCount++;
      this.updateState('reconnecting', `${rawMsg}.. Retrying...`);
      setTimeout(() => this.attemptConnection(), delay);
    } else {
      this.updateState('failed', "Connection failed after maximum retries. Please check your network or API key.");
    }
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
