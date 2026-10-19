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
   * Síntesis física Karplus-Strong: emula la física real de una cuerda de guitarra
   * punteada con púa y la resonancia de la caja de madera acústica.
   */
  getPluckBuffer(freq) {
    if (!this.pluckCache) this.pluckCache = new Map();
    const key = Math.round(freq * 10);
    if (this.pluckCache.has(key)) {
      return this.pluckCache.get(key);
    }

    const sampleRate = (this.audioCtx && this.audioCtx.sampleRate) ? this.audioCtx.sampleRate : 44100;
    const duration = 3.5; // Duración natural de la resonancia de una guitarra (3.5s)
    const numSamples = Math.floor(sampleRate * duration);
    const buffer = this.audioCtx.createBuffer(1, numSamples, sampleRate);
    const data = buffer.getChannelData(0);

    // Periodo fundamental en muestras con precisión decimal
    const period = sampleRate / freq;
    const intPeriod = Math.floor(period);
    const frac = period - intPeriod; // Interpolación fraccional para afinación exacta

    // Factor de amortiguación acústico: cuerdas graves tienen más sustain que las agudas
    // Cuerda 6 (82 Hz) ~ 0.9965, Cuerda 1 (330 Hz) ~ 0.992
    const decayFactor = Math.max(0.988, Math.min(0.997, 0.9972 - (freq / 1000) * 0.012));

    // 1. Excitación inicial: Ataque percusivo de púa (Pick Impulse)
    const impulseLength = Math.min(intPeriod, Math.floor(sampleRate * 0.007));
    for (let i = 0; i < impulseLength; i++) {
      // Ruido rosa con envolvente Hann: simula el raspado de la púa en el entorchado
      const env = 0.5 * (1 - Math.cos((2 * Math.PI * i) / impulseLength));
      data[i] = (Math.random() * 2 - 1) * env;
    }

    // 2. Bucle Karplus-Strong con filtro paso-bajo promediador de 2 puntos
    let prevSample = 0;
    for (let i = intPeriod; i < numSamples; i++) {
      const idxA = i - intPeriod;
      const idxB = idxA - 1;
      const valA = data[idxA];
      const valB = idxB >= 0 ? data[idxB] : 0;

      // Retardo con interpolación fraccional para afinar a 0.1 Hz exactos
      const delayed = valA * (1 - frac) + valB * frac;

      // Pérdida natural de la cuerda: las altas frecuencias mueren más rápido que los graves
      const filtered = 0.5 * (delayed + prevSample) * decayFactor;
      prevSample = delayed;

      data[i] = filtered;
    }

    // 3. Normalizar volumen y añadir calidez acústica
    let peak = 0;
    for (let i = 0; i < numSamples; i++) {
      const abs = Math.abs(data[i]);
      if (abs > peak) peak = abs;
    }
    if (peak > 0) {
      const targetGain = 0.85 / peak;
      for (let i = 0; i < numSamples; i++) {
        data[i] *= targetGain;
      }
    }

    this.pluckCache.set(key, buffer);
    return buffer;
  }

  /**
   * Reproduce una pulsación real de guitarra acústica (Pluck)
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
      const pluckBuffer = this.getPluckBuffer(freq);

      // Reproductor de buffer PCM de cuerda
      this.activePluckSource = this.audioCtx.createBufferSource();
      this.activePluckSource.buffer = pluckBuffer;

      // Filtro de resonancia de tapa armónica de guitarra (madera a ~110 Hz y ~220 Hz)
      const bodyFilter = this.audioCtx.createBiquadFilter();
      bodyFilter.type = 'peaking';
      bodyFilter.frequency.value = 160;
      bodyFilter.Q.value = 1.0;
      bodyFilter.gain.value = 3.5;

      // Control de volumen de salida
      this.pluckGain = this.audioCtx.createGain();
      this.pluckGain.gain.setValueAtTime(0.9, now);

      this.activePluckSource.connect(bodyFilter);
      bodyFilter.connect(this.pluckGain);
      this.pluckGain.connect(this.audioCtx.destination);

      this.activePluckSource.start(now);
      this.currentTonePlaying = true;

      // Si el usuario mantiene pulsado, re-puntear suavemente la cuerda cada 2.8s
      this.pluckLoopTimer = setInterval(() => {
        if (this.currentTonePlaying) {
          this.triggerGentleRepluck(freq);
        }
      }, 2800);
    } catch (e) {
      console.error("Error al reproducir pulsación de guitarra:", e);
    }
  }

  triggerGentleRepluck(freq) {
    if (!this.audioCtx || !this.currentTonePlaying) return;
    try {
      const now = this.audioCtx.currentTime;
      const buffer = this.getPluckBuffer(freq);
      const src = this.audioCtx.createBufferSource();
      src.buffer = buffer;

      const gain = this.audioCtx.createGain();
      gain.gain.setValueAtTime(0.75, now);

      src.connect(gain);
      gain.connect(this.audioCtx.destination);
      src.start(now);
    } catch (e) {}
  }

  stopGuitarTone() {
    if (this.pluckLoopTimer) {
      clearInterval(this.pluckLoopTimer);
      this.pluckLoopTimer = null;
    }

    if (!this.currentTonePlaying || !this.audioCtx) return;

    try {
      if (this.pluckGain) {
        const now = this.audioCtx.currentTime;
        this.pluckGain.gain.cancelScheduledValues(now);
        this.pluckGain.gain.setValueAtTime(this.pluckGain.gain.value, now);
        this.pluckGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15); // Palm mute suave
      }

      const src = this.activePluckSource;
      setTimeout(() => {
        try {
          if (src) src.stop();
        } catch (e) {}
      }, 160);
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
