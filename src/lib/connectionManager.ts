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
      let sessionAi = this.ai;

      // Modern Authorization Keys (AQ.Ab...) require obtaining an ephemeral token via CreateAuthToken
      // before connecting to the Live WebSocket.
      if (this.rawApiKey.startsWith('AQ.')) {
        try {
          console.log("[ConnectionManager] Obtaining ephemeral auth token via CreateAuthToken...");
          const tokenResp: any = await this.ai.authTokens.create({});
          if (tokenResp && tokenResp.name) {
            console.log("[ConnectionManager] Ephemeral token received:", tokenResp.name);
            sessionAi = new GoogleGenAI({
              apiKey: tokenResp.name,
              httpOptions: { apiVersion: 'v1alpha' }
            });
          }
        } catch (tokenErr: any) {
          console.warn("[ConnectionManager] Failed to create auth token:", tokenErr);
          let msg = tokenErr?.message || String(tokenErr);
          try {
            const parsed = JSON.parse(msg);
            if (parsed?.error?.message) msg = parsed.error.message;
          } catch {}
          if (msg.includes("API key not valid") || msg.includes("denied access") || msg.includes("PERMISSION_DENIED")) {
            this.updateState('failed', `Google Auth Error: ${msg}`);
            return;
          }
        }
      }

      this.currentSession = await sessionAi.live.connect({
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

    // Check for auth token errors from Google Live API
    if (lower.includes("missing or malformed auth token") || lower.includes("createauthtoken") || lower.includes("expected oauth 2") || lower.includes("invalid authentication credentials")) {
      console.error("[ConnectionManager] Auth token error from Google API:", rawMsg);
      this.updateState(
        'failed',
        "Google Live API Auth Error: Ephemeral token required. Please check your GEMINI_API_KEY."
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
