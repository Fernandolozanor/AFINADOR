/**
 * AudioProcessor - Motor de procesamiento de audio y detección de tono (Pitch Detection)
 * Conexión forzada con GainNode(0) -> destination para garantizar flujo de datos en móviles (iOS/Android)
 */

class AudioProcessor {
  constructor() {
    this.audioCtx = null;
    this.mediaStream = null;
    this.sourceNode = null;
    this.analyserNode = null;
    this.silenceGain = null;
    
    // Nodos de filtrado
    this.highpassFilter = null;
    this.lowpassFilter = null;
    this.isFilterEnabled = false; // Directo por defecto para máxima fidelidad en móviles

    // Buffer para análisis de frecuencia
    this.bufferSize = 2048;
    this.buffer = new Float32Array(this.bufferSize);
    this.byteBuffer = new Uint8Array(this.bufferSize);

    // Umbral de Noise Gate (RMS) ultra sensible
    this.noiseThreshold = 0.002; 

    this.isRunning = false;

    // Notaciones musicales
    this.notesAmerican = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    this.notesEuropean = ["Do", "Do#", "Re", "Re#", "Mi", "Fa", "Fa#", "Sol", "Sol#", "La", "La#", "Si"];
    this.a4Frequency = 440.0;
  }

  /**
   * Inicia el contexto de audio y solicita acceso al micrófono
   */
  async start() {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!this.audioCtx || this.audioCtx.state === 'closed') {
        this.audioCtx = new AudioContextClass();
      }

      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }

      // Solicitud de micrófono compatible con todos los teléfonos
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Tu navegador no soporta captura de micrófono.");
      }

      try {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false
          }
        });
      } catch (e) {
        // Fallback básico para cualquier móvil
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: true
        });
      }

      // Crear nodos
      this.sourceNode = this.audioCtx.createMediaStreamSource(this.mediaStream);
      this.analyserNode = this.audioCtx.createAnalyser();
      this.analyserNode.fftSize = this.bufferSize;
      this.analyserNode.smoothingTimeConstant = 0.2;

      // NODO CLAVE: GainNode con valor 0 conectado a destination.
      // Sin esto, Safari y Chrome móvil NO procesan el grafo de audio y devuelven 0s.
      this.silenceGain = this.audioCtx.createGain();
      this.silenceGain.gain.value = 0;

      // Filtros opcionales
      this.highpassFilter = this.audioCtx.createBiquadFilter();
      this.highpassFilter.type = 'highpass';
      this.highpassFilter.frequency.value = 65;

      this.lowpassFilter = this.audioCtx.createBiquadFilter();
      this.lowpassFilter.type = 'lowpass';
      this.lowpassFilter.frequency.value = 1100;

      this.setupRouting();

      // Asegurar que el contexto está activo
      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }

      this.isRunning = true;
      return true;
    } catch (err) {
      console.error("Error al iniciar audio:", err);
      this.isRunning = false;
      throw err;
    }
  }

  /**
   * Conecta los nodos de audio asegurando ruta hasta destination (silenciado)
   */
  setupRouting() {
    if (!this.sourceNode || !this.analyserNode || !this.silenceGain || !this.audioCtx) return;

    try {
      this.sourceNode.disconnect();
      this.analyserNode.disconnect();
      if (this.highpassFilter) this.highpassFilter.disconnect();
      if (this.lowpassFilter) this.lowpassFilter.disconnect();
      this.silenceGain.disconnect();
    } catch (e) {}

    if (this.isFilterEnabled && this.highpassFilter && this.lowpassFilter) {
      // Source -> Highpass -> Lowpass -> Analyser -> Silence -> Destination
      this.sourceNode.connect(this.highpassFilter);
      this.highpassFilter.connect(this.lowpassFilter);
      this.lowpassFilter.connect(this.analyserNode);
    } else {
      // Directo: Source -> Analyser -> Silence -> Destination
      this.sourceNode.connect(this.analyserNode);
    }

    this.analyserNode.connect(this.silenceGain);
    this.silenceGain.connect(this.audioCtx.destination);
  }

  setFilterEnabled(enabled) {
    this.isFilterEnabled = enabled;
    this.setupRouting();
  }

  stop() {
    if (!this.isRunning) return;

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }

    this.isRunning = false;
  }

  resumeContext() {
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
  }

  getRMS(buffer) {
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      sum += buffer[i] * buffer[i];
    }
    return Math.sqrt(sum / buffer.length);
  }

  /**
   * Lee los datos de audio con soporte dual (Float32Array y Byte fallback)
   */
  detectPitch() {
    if (!this.isRunning || !this.analyserNode) {
      return null;
    }

    this.resumeContext();

    // Obtener datos del micro con compatibilidad total
    if (typeof this.analyserNode.getFloatTimeDomainData === 'function') {
      this.analyserNode.getFloatTimeDomainData(this.buffer);
    } else {
      this.analyserNode.getByteTimeDomainData(this.byteBuffer);
      for (let i = 0; i < this.bufferSize; i++) {
        this.buffer[i] = (this.byteBuffer[i] - 128) / 128;
      }
    }

    const rms = this.getRMS(this.buffer);
    const volumePercent = Math.min(100, Math.round((rms / 0.05) * 100));

    // Si el volumen es muy bajo, reportamos el nivel pero no calculamos tono errático
    if (rms < this.noiseThreshold) {
      return {
        hasSignal: false,
        rms: rms,
        volumePercent: volumePercent,
        buffer: this.buffer
      };
    }

    const sampleRate = (this.audioCtx && this.audioCtx.sampleRate) ? this.audioCtx.sampleRate : 44100;

    // Algoritmo YIN con interpolación parabólica
    let frequency = this.yinPitchDetection(this.buffer, sampleRate);

    // Fallback a autocorrelación
    if (!frequency || frequency < 60 || frequency > 1200) {
      frequency = this.autoCorrelationPitch(this.buffer, sampleRate);
    }

    if (!frequency || frequency < 60 || frequency > 1200) {
      return {
        hasSignal: false,
        rms: rms,
        volumePercent: volumePercent,
        buffer: this.buffer
      };
    }

    const noteInfo = this.frequencyToNote(frequency);

    return {
      hasSignal: true,
      rms: rms,
      volumePercent: volumePercent,
      frequency: frequency,
      buffer: this.buffer,
      ...noteInfo
    };
  }

  yinPitchDetection(buffer, sampleRate) {
    const halfBufferSize = Math.floor(buffer.length / 2);
    const yinBuffer = new Float32Array(halfBufferSize);

    for (let tau = 0; tau < halfBufferSize; tau++) {
      let sum = 0;
      for (let i = 0; i < halfBufferSize; i++) {
        const delta = buffer[i] - buffer[i + tau];
        sum += delta * delta;
      }
      yinBuffer[tau] = sum;
    }

    yinBuffer[0] = 1;
    let runningSum = 0;
    for (let tau = 1; tau < halfBufferSize; tau++) {
      runningSum += yinBuffer[tau];
      yinBuffer[tau] = (yinBuffer[tau] * tau) / (runningSum || 1);
    }

    const threshold = 0.20;
    let tauEstimate = -1;

    for (let tau = 2; tau < halfBufferSize; tau++) {
      if (yinBuffer[tau] < threshold) {
        while (tau + 1 < halfBufferSize && yinBuffer[tau + 1] < yinBuffer[tau]) {
          tau++;
        }
        tauEstimate = tau;
        break;
      }
    }

    if (tauEstimate === -1) {
      let minVal = 1000;
      let minTau = -1;
      for (let tau = 2; tau < halfBufferSize; tau++) {
        if (yinBuffer[tau] < minVal) {
          minVal = yinBuffer[tau];
          minTau = tau;
        }
      }
      if (minVal < 0.65) {
        tauEstimate = minTau;
      } else {
        return null;
      }
    }

    let betterTau;
    const x0 = tauEstimate < 1 ? tauEstimate : tauEstimate - 1;
    const x2 = tauEstimate + 1 < halfBufferSize ? tauEstimate + 1 : tauEstimate;

    if (x0 === tauEstimate) {
      betterTau = (yinBuffer[tauEstimate] <= yinBuffer[x2]) ? tauEstimate : x2;
    } else if (x2 === tauEstimate) {
      betterTau = (yinBuffer[tauEstimate] <= yinBuffer[x0]) ? tauEstimate : x0;
    } else {
      const s0 = yinBuffer[x0];
      const s1 = yinBuffer[tauEstimate];
      const s2 = yinBuffer[x2];
      const denom = 2 * (2 * s1 - s2 - s0);
      betterTau = denom !== 0 ? tauEstimate + (s2 - s0) / denom : tauEstimate;
    }

    return sampleRate / betterTau;
  }

  autoCorrelationPitch(buffer, sampleRate) {
    const minSamples = Math.floor(sampleRate / 1200);
    const maxSamples = Math.floor(sampleRate / 60);
    
    let bestOffset = -1;
    let maxCorrelation = 0;

    for (let offset = minSamples; offset <= maxSamples; offset++) {
      let correlation = 0;
      for (let i = 0; i < maxSamples; i++) {
        correlation += buffer[i] * buffer[i + offset];
      }
      if (correlation > maxCorrelation) {
        maxCorrelation = correlation;
        bestOffset = offset;
      }
    }

    if (maxCorrelation > 0.005 && bestOffset !== -1) {
      return sampleRate / bestOffset;
    }
    return null;
  }

  frequencyToNote(frequency) {
    const midiNumber = 69 + 12 * Math.log2(frequency / this.a4Frequency);
    const roundedMidi = Math.round(midiNumber);
    const cents = Math.round((midiNumber - roundedMidi) * 100);

    const noteIndex = ((roundedMidi % 12) + 12) % 12;
    const octave = Math.floor(roundedMidi / 12) - 1;

    const noteAmerican = this.notesAmerican[noteIndex];
    const noteEuropean = this.notesEuropean[noteIndex];
    const targetFrequency = this.a4Frequency * Math.pow(2, (roundedMidi - 69) / 12);

    return {
      midi: roundedMidi,
      noteIndex: noteIndex,
      noteAmerican: noteAmerican,
      noteEuropean: noteEuropean,
      octave: octave,
      cents: cents,
      targetFrequency: targetFrequency
    };
  }
}

window.AudioProcessor = AudioProcessor;
