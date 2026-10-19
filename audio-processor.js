/**
 * AudioProcessor - Motor de procesamiento de audio y detección de tono ultra rápido
 * Optimizado para instrumentos de cuerda (guitarra) con YIN acelerado por rango.
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
    this.isFilterEnabled = false;

    // Buffer de 2048 muestras
    this.bufferSize = 2048;
    this.buffer = new Float32Array(this.bufferSize);
    this.byteBuffer = new Uint8Array(this.bufferSize);

    // Umbral de Noise Gate
    this.noiseThreshold = 0.003;

    // Suavizado de frecuencia
    this.lastDetectedFreq = null;
    this.lastPitchTime = 0;

    this.isRunning = false;

    // Notaciones musicales
    this.notesAmerican = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    this.notesEuropean = ["Do", "Do#", "Re", "Re#", "Mi", "Fa", "Fa#", "Sol", "Sol#", "La", "La#", "Si"];
    this.a4Frequency = 440.0;
  }

  async start() {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!this.audioCtx || this.audioCtx.state === 'closed') {
        this.audioCtx = new AudioContextClass({ latencyHint: 'interactive' });
      }

      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
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
        this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      this.sourceNode = this.audioCtx.createMediaStreamSource(this.mediaStream);
      this.analyserNode = this.audioCtx.createAnalyser();
      this.analyserNode.fftSize = this.bufferSize;
      this.analyserNode.smoothingTimeConstant = 0.1;

      // Nodo de silencio para obligar al navegador a bombear datos del micro sin producir eco
      this.silenceGain = this.audioCtx.createGain();
      this.silenceGain.gain.value = 0;

      this.highpassFilter = this.audioCtx.createBiquadFilter();
      this.highpassFilter.type = 'highpass';
      this.highpassFilter.frequency.value = 65;

      this.lowpassFilter = this.audioCtx.createBiquadFilter();
      this.lowpassFilter.type = 'lowpass';
      this.lowpassFilter.frequency.value = 1000;

      this.setupRouting();

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
      this.sourceNode.connect(this.highpassFilter);
      this.highpassFilter.connect(this.lowpassFilter);
      this.lowpassFilter.connect(this.analyserNode);
    } else {
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

    this.lastDetectedFreq = null;
    this.isRunning = false;
  }

  resumeContext() {
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
  }

  getRMS(buffer) {
    let sum = 0;
    const len = buffer.length;
    for (let i = 0; i < len; i += 2) {
      sum += buffer[i] * buffer[i];
    }
    return Math.sqrt((sum * 2) / len);
  }

  /**
   * Detección de tono de alto rendimiento en tiempo real
   */
  detectPitch() {
    if (!this.isRunning || !this.analyserNode) {
      return null;
    }

    this.resumeContext();

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

    if (rms < this.noiseThreshold) {
      this.lastDetectedFreq = null;
      return {
        hasSignal: false,
        rms: rms,
        volumePercent: volumePercent,
        buffer: this.buffer
      };
    }

    const sampleRate = (this.audioCtx && this.audioCtx.sampleRate) ? this.audioCtx.sampleRate : 44100;

    // YIN acelerado por rango para guitarras (65 Hz a 900 Hz)
    let rawFrequency = this.fastYinGuitar(this.buffer, sampleRate);

    if (!rawFrequency || rawFrequency < 60 || rawFrequency > 950) {
      return {
        hasSignal: false,
        rms: rms,
        volumePercent: volumePercent,
        buffer: this.buffer
      };
    }

    // Suavizado adaptativo de frecuencia para evitar temblores
    let frequency = rawFrequency;
    if (this.lastDetectedFreq) {
      const semitoneRatio = Math.abs(Math.log2(rawFrequency / this.lastDetectedFreq));
      if (semitoneRatio < 0.15) { // Si es la misma nota o ligera variación
        frequency = this.lastDetectedFreq * 0.65 + rawFrequency * 0.35;
      }
    }
    this.lastDetectedFreq = frequency;

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

  /**
   * Algoritmo YIN optimizado: 20x más rápido al acotar el rango de tau a notas de guitarra
   */
  fastYinGuitar(buffer, sampleRate) {
    // Frecuencias: 65 Hz (Drop C/D) a 850 Hz (agudos de guitarra)
    const minTau = Math.max(2, Math.floor(sampleRate / 850));
    const maxTau = Math.min(Math.floor(buffer.length / 2), Math.floor(sampleRate / 65));
    const windowSize = 900; // Ventana suficiente para precisión de fase sin sobrecargar CPU

    const yin = new Float32Array(maxTau + 1);

    // 1. Diferencia cuadrática acumulada
    for (let tau = minTau; tau <= maxTau; tau++) {
      let sum = 0;
      for (let i = 0; i < windowSize; i += 2) {
        const delta = buffer[i] - buffer[i + tau];
        sum += delta * delta;
      }
      yin[tau] = sum * 2;
    }

    // 2. Normalización CMNDF en el rango evaluado
    let runningSum = 0;
    for (let tau = minTau; tau <= maxTau; tau++) {
      runningSum += yin[tau];
      yin[tau] = (yin[tau] * tau) / (runningSum || 1);
    }

    // 3. Selección del dip significativo (umbral tolerante de guitarra)
    const threshold = 0.20;
    let tauEstimate = -1;

    for (let tau = minTau; tau < maxTau; tau++) {
      if (yin[tau] < threshold) {
        while (tau + 1 < maxTau && yin[tau + 1] < yin[tau]) {
          tau++;
        }
        tauEstimate = tau;
        break;
      }
    }

    // Fallback al mínimo global si no superó el umbral
    if (tauEstimate === -1) {
      let minVal = 1000;
      let minTau = -1;
      for (let tau = minTau; tau < maxTau; tau++) {
        if (yin[tau] < minVal) {
          minVal = yin[tau];
          minTau = tau;
        }
      }
      if (minVal < 0.55 && minTau !== -1) {
        tauEstimate = minTau;
      } else {
        return null;
      }
    }

    // 4. Interpolación parabólica sub-muestra
    const x0 = tauEstimate < minTau ? minTau : tauEstimate - 1;
    const x2 = tauEstimate + 1 > maxTau ? maxTau : tauEstimate + 1;
    const s0 = yin[x0];
    const s1 = yin[tauEstimate];
    const s2 = yin[x2];
    const denom = 2 * (2 * s1 - s2 - s0);
    const betterTau = denom !== 0 ? tauEstimate + (s2 - s0) / denom : tauEstimate;

    return sampleRate / betterTau;
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
