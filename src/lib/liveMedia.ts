export class AudioStreamPlayer {
  private context: AudioContext;
  private nextTime = 0;

  constructor() {
    this.context = new window.AudioContext({ sampleRate: 24000 });
  }

  async resume() {
    if (this.context.state === 'suspended') {
      await this.context.resume();
    }
  }

  playPiece(base64: string) {
    if (this.context.state === 'suspended') {
        this.context.resume().catch(e => console.warn("AudioContext resume failed:", e));
    }
    const binary = atob(base64);
    const length = binary.length / 2; // 16-bit PCM
    const buffer = this.context.createBuffer(1, length, 24000);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i++) {
      const low = binary.charCodeAt(i * 2);
      const high = binary.charCodeAt(i * 2 + 1);
      let sample = (high << 8) | low;
      if (sample > 32767) sample -= 65536;
      data[i] = sample / 32768;
    }

    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.context.destination);

    const time = Math.max(this.context.currentTime, this.nextTime);
    source.start(time);
    this.nextTime = time + buffer.duration;
  }

  stop() {
    this.nextTime = 0;
    if (this.context.state !== 'closed') {
      this.context.close();
    }
  }
}

export class AudioRecorder {
  private context: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private scriptNode: ScriptProcessorNode | null = null;
  private mediaSource: MediaStreamAudioSourceNode | null = null;

  async start(onData: (base64: string) => void, constraints: MediaTrackConstraints = {}) {
    if (this.stream) {
        // If already started, we might just want to update the listener if it's a new one,
        // but for now let's just avoid re-initializing everything.
        return;
    }
    
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          ...constraints
        } 
      });
      this.context = new window.AudioContext({ sampleRate: 16000 });
      this.mediaSource = this.context.createMediaStreamSource(this.stream);
      
      this.scriptNode = this.context.createScriptProcessor(4096, 1, 1);
      this.scriptNode.onaudioprocess = (e) => {
        const pcmData = e.inputBuffer.getChannelData(0);
        const output = new Int16Array(pcmData.length);
        for (let i = 0; i < pcmData.length; i++) {
          const s = Math.max(-1, Math.min(1, pcmData[i]));
          output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        
        const buffer = new ArrayBuffer(output.length * 2);
        const view = new DataView(buffer);
        for (let i = 0; i < output.length; i++) {
          view.setInt16(i * 2, output[i], true); // little-endian
        }
        
        let binary = '';
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);
        onData(base64);
      };

      this.mediaSource.connect(this.scriptNode);
      this.scriptNode.connect(this.context.destination);
    } catch (err) {
      console.error("AudioRecorder.start failed", err);
      this.stream = null;
      throw err;
    }
  }

  stop() {
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    if (this.scriptNode) {
      this.scriptNode.disconnect();
      this.scriptNode = null;
    }
    if (this.mediaSource) {
      this.mediaSource.disconnect();
      this.mediaSource = null;
    }
    if (this.context && this.context.state !== 'closed') {
      this.context.close();
      this.context = null;
    }
  }

  isActive() {
    return !!this.stream && this.stream.active;
  }

  getStream() {
    return this.stream;
  }
}
