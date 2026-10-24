export class Microphone {
  constructor({ mediaDevices = navigator.mediaDevices, AudioContext = window.AudioContext, onEnded = () => {} } = {}) {
    this.mediaDevices = mediaDevices; this.Context = AudioContext; this.onEnded = onEnded;
    this.generation = 0; this.active = false; this.starting = false;
  }
  async start(deviceId = '') {
    if (this.active || this.starting) return;
    this.stop(); const generation = this.generation; this.starting = true;
    try {
      if (!this.mediaDevices?.getUserMedia) throw new Error('Mikrofon-API nicht verfügbar. Bitte die Desktop-App neu starten.');
      const stream = await this.mediaDevices.getUserMedia({audio: {echoCancellation:false, noiseSuppression:false, autoGainControl:false, ...(deviceId ? {deviceId:{exact:deviceId}} : {})}, video:false});
      if (generation !== this.generation) { stream.getTracks().forEach(t => t.stop()); return; }
      // Analysis never plays sound. A silent sink avoids dependence on the OS speaker clock.
      this.stream = stream; this.context = new this.Context({sinkId:{type:'none'}});
      this.source = this.context.createMediaStreamSource(stream); this.analyser = this.context.createAnalyser();
      this.analyser.fftSize = 2048; this.analyser.smoothingTimeConstant = 0;
      this.source.connect(this.analyser); // No connection to speakers: no feedback or playback.
      this.samples = new Float32Array(this.analyser.fftSize);
      this.ended = () => { this.stop(); this.onEnded(); };
      stream.getAudioTracks().forEach(t => t.addEventListener('ended', this.ended));
      await this.context.resume();
      if (generation !== this.generation) return;
      this.active = true; this.starting = false;
    } catch (error) { if (generation !== this.generation) return; this.stop(); throw error; }
  }
  level() {
    if (!this.active) return 0;
    this.analyser.getFloatTimeDomainData(this.samples);
    return Math.sqrt(this.samples.reduce((sum,v) => sum + v*v,0)/this.samples.length)*100;
  }
  stop() {
    this.generation++; this.active = false; this.starting = false;
    this.stream?.getTracks().forEach(t => { t.removeEventListener('ended',this.ended); t.stop(); });
    try { this.source?.disconnect(); } catch {}
    try { this.analyser?.disconnect(); } catch {}
    try { this.context?.close().catch(() => {}); } catch {}
    this.stream = this.source = this.analyser = this.context = null;
  }
}
export function microphoneError(error) {
  const messages = {
    NotAllowedError: 'Mikrofonzugriff verweigert. macOS: Systemeinstellungen → Datenschutz & Sicherheit → Mikrofon → RinPNGTube aktivieren, dann App neu starten. Windows: Einstellungen → Datenschutz & Sicherheit → Mikrofon → Desktop-Apps zulassen.',
    NotFoundError: 'Kein Mikrofon gefunden. Bitte ein Eingabegerät anschließen.',
    OverconstrainedError: 'Das gewählte Mikrofon ist nicht mehr verfügbar. Bitte ein anderes Gerät auswählen.',
    NotReadableError: 'Mikrofon nicht lesbar oder belegt. Geräteverbindung und andere Audio-Apps prüfen.',
  };
  return messages[error?.name] || `Mikrofonfehler: ${error?.message || 'Unbekannter Fehler'}`;
}
