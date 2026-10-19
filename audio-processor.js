/**
 * AudioProcessor - Motor de audio de alta sensibilidad con preamplificador digital (+14 dB)
 * y detección de tono YIN acelerada para guitarra.
 */

class AudioProcessor {
  constructor() {
    this.audioCtx = null;
    this.mediaStream = null;
    this.sourceNode = null;
    this.preampGain = null; // Preamplificador digital
    this.analyserNode = null;
    this.silenceGain = null;
    
    // Nodos de filtrado
    this.highpassFilter = null;
    this.lowpassFilter = null;
    this.isFilterEnabled = false;

    // Multiplicador de ganancia digital (Boost x5.0 = +14 dB)
    this.boostLevel = 5.0;

    // Buffer de 2048 muestras
    this.bufferSize = 2048;
    this.buffer = new Float32Array(this.bufferSize);
    this.byteBuffer = new Uint8Array(this.bufferSize);

    // Umbral de Noise Gate (tras el boost x5, 0.006 equivale a 0.0012 bruto)
    this.noiseThreshold = 0.005;

    // Suavizado de frecuencia
    this.lastDetectedFreq = null;

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
            autoGainControl: true // Permitir ganancia del dispositivo si está disponible
          }
        });
      } catch (e) {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      this.sourceNode = this.audioCtx.createMediaStreamSource(this.mediaStream);

      // Preamplificador digital potente: Eleva la señal débil de micrófonos móviles
      this.preampGain = this.audioCtx.createGain();
      this.preampGain.gain.value = this.boostLevel;

      this.analyserNode = this.audioCtx.createAnalyser();
      this.analyserNode.fftSize = this.bufferSize;
      this.analyserNode.smoothingTimeConstant = 0.1;

      // Nodo de silencio para forzar flujo de datos sin acople
      this.silenceGain = this.audioCtx.createGain();
      this.silenceGain.gain.value = 0;

      // Filtros
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
    if (!this.sourceNode || !this.preampGain || !this.analyserNode || !this.silenceGain || !this.audioCtx) return;

    try {
      this.sourceNode.disconnect();
      this.preampGain.disconnect();
      this.analyserNode.disconnect();
      if (this.highpassFilter) this.highpassFilter.disconnect();
      if (this.lowpassFilter) this.lowpassFilter.disconnect();
      this.silenceGain.disconnect();
    } catch (e) {}

    // Micro -> Preamplificador digital (x5)
    this.sourceNode.connect(this.preampGain);

    if (this.isFilterEnabled && this.highpassFilter && this.lowpassFilter) {
      // Preamp -> Highpass -> Lowpass -> Analyser
      this.preampGain.connect(this.highpassFilter);
      this.highpassFilter.connect(this.lowpassFilter);
      this.lowpassFilter.connect(this.analyserNode);
    } else {
      // Preamp directo a Analyser
      this.preampGain.connect(this.analyserNode);
    }

    // Analyser -> SilenceGain (0) -> Destination
    this.analyserNode.connect(this.silenceGain);
    this.silenceGain.connect(this.audioCtx.destination);
  }

  setFilterEnabled(enabled) {
    this.isFilterEnabled = enabled;
    this.setupRouting();
  }

  setBoostLevel(level) {
    this.boostLevel = level;
    if (this.preampGain && this.audioCtx) {
      this.preampGain.gain.setTargetAtTime(level, this.audioCtx.currentTime, 0.05);
    }
  }

  /**
   * Sintetizador acústico de cuerda de guitarra con afinación exacta (para afinar de oído)
   */
  startGuitarTone(freq) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      this.audioCtx = new AudioContextClass();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }

    this.stopGuitarTone();

    try {
      const now = this.audioCtx.currentTime;

      // 1. Oscilador fundamental (triangular para timbre de madera)
      this.toneOsc1 = this.audioCtx.createOscillator();
      this.toneOsc1.type = 'triangle';
      this.toneOsc1.frequency.setValueAtTime(freq, now);

      // 2. Oscilador armónico (segundo armónico para el brillo de la cuerda)
      this.toneOsc2 = this.audioCtx.createOscillator();
      this.toneOsc2.type = 'sine';
      this.toneOsc2.frequency.setValueAtTime(freq * 2, now);

      // 3. Filtro acústico de resonancia de caja
      this.toneFilter = this.audioCtx.createBiquadFilter();
      this.toneFilter.type = 'lowpass';
      this.toneFilter.frequency.setValueAtTime(Math.min(freq * 5, 2400), now);
      this.toneFilter.frequency.exponentialRampToValueAtTime(Math.min(freq * 2.5, 1200), now + 0.35);

      // 4. Envolvente ADSR
      this.toneGain = this.audioCtx.createGain();
      this.toneGain.gain.setValueAtTime(0.001, now);
      this.toneGain.gain.exponentialRampToValueAtTime(0.32, now + 0.02);
      this.toneGain.gain.exponentialRampToValueAtTime(0.20, now + 0.28);

      const osc2Gain = this.audioCtx.createGain();
      osc2Gain.gain.value = 0.35;

      this.toneOsc1.connect(this.toneFilter);
      this.toneOsc2.connect(osc2Gain);
      osc2Gain.connect(this.toneFilter);

      this.toneFilter.connect(this.toneGain);
      this.toneGain.connect(this.audioCtx.destination);

      this.toneOsc1.start(now);
      this.toneOsc2.start(now);
      this.currentTonePlaying = true;
    } catch (e) {
      console.error("Error al sintetizar tono de cuerda:", e);
    }
  }

  stopGuitarTone() {
    if (!this.currentTonePlaying || !this.toneGain || !this.audioCtx) return;

    try {
      const now = this.audioCtx.currentTime;
      this.toneGain.gain.cancelScheduledValues(now);
      this.toneGain.gain.setValueAtTime(this.toneGain.gain.value, now);
      this.toneGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

      const osc1 = this.toneOsc1;
      const osc2 = this.toneOsc2;
      setTimeout(() => {
        try {
          if (osc1) osc1.stop();
          if (osc2) osc2.stop();
        } catch (e) {}
      }, 180);
    } catch (e) {}

    this.currentTonePlaying = false;
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
    // Nivel del vúmetro generoso y sensible (0% a 100%)
    const volumePercent = Math.min(100, Math.round((rms / 0.12) * 100));

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

    // YIN rápido optimizado para guitarra (65 Hz a 900 Hz)
    let rawFrequency = this.fastYinGuitar(this.buffer, sampleRate);

    if (!rawFrequency || rawFrequency < 60 || rawFrequency > 950) {
      return {
        hasSignal: false,
        rms: rms,
        volumePercent: volumePercent,
        buffer: this.buffer
      };
    }

    let frequency = rawFrequency;
    if (this.lastDetectedFreq) {
      const semitoneRatio = Math.abs(Math.log2(rawFrequency / this.lastDetectedFreq));
      if (semitoneRatio < 0.15) {
        frequency = this.lastDetectedFreq * 0.60 + rawFrequency * 0.40;
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

  fastYinGuitar(buffer, sampleRate) {
    const minTau = Math.max(2, Math.floor(sampleRate / 850));
    const maxTau = Math.min(Math.floor(buffer.length / 2), Math.floor(sampleRate / 65));
    const windowSize = 900;

    const yin = new Float32Array(maxTau + 1);

    for (let tau = minTau; tau <= maxTau; tau++) {
      let sum = 0;
      for (let i = 0; i < windowSize; i += 2) {
        const delta = buffer[i] - buffer[i + tau];
        sum += delta * delta;
      }
      yin[tau] = sum * 2;
    }

    let runningSum = 0;
    for (let tau = minTau; tau <= maxTau; tau++) {
      runningSum += yin[tau];
      yin[tau] = (yin[tau] * tau) / (runningSum || 1);
    }

    const threshold = 0.22;
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

    if (tauEstimate === -1) {
      let minVal = 1000;
      let minTau = -1;
      for (let tau = minTau; tau < maxTau; tau++) {
        if (yin[tau] < minVal) {
          minVal = yin[tau];
          minTau = tau;
        }
      }
      if (minVal < 0.58 && minTau !== -1) {
        tauEstimate = minTau;
      } else {
        return null;
      }
    }

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
