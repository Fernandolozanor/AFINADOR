/**
 * AudioProcessor - Motor de procesamiento de audio y detección de tono (Pitch Detection)
 * Utiliza Web Audio API con filtros Biquad, algoritmo YIN optimizado e indicador de nivel.
 */

class AudioProcessor {
  constructor() {
    this.audioCtx = null;
    this.mediaStream = null;
    this.sourceNode = null;
    this.analyserNode = null;
    
    // Nodos de filtrado para aislar el sonido de la guitarra del ruido ambiental
    this.highpassFilter = null;
    this.lowpassFilter = null;
    this.isFilterEnabled = true;

    // Buffer aumentado a 4096 para capturar perfectamente los graves a 48 kHz (cuerdas 6ª y 5ª)
    this.bufferSize = 4096;
    this.buffer = new Float32Array(this.bufferSize);

    // Umbral de Noise Gate (RMS) sensible para captar cuerdas suaves a distancia
    this.noiseThreshold = 0.003; 

    this.isRunning = false;

    // Notaciones musicales
    this.notesAmerican = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    this.notesEuropean = ["Do", "Do#", "Re", "Re#", "Mi", "Fa", "Fa#", "Sol", "Sol#", "La", "La#", "Si"];
    this.a4Frequency = 440.0;
  }

  /**
   * Inicia el contexto de audio y solicita acceso al micrófono con fallbacks robustos
   */
  async start() {
    if (this.isRunning) {
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }
      return true;
    }

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContextClass({
        latencyHint: 'interactive'
      });

      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }

      // Solicitud de micrófono con fallback: si el navegador móvil no soporta constraints avanzados,
      // cae de forma segura a { audio: true }
      try {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false
          }
        });
      } catch (constraintErr) {
        console.warn("Navegador no soporta constraints estrictos, usando fallback estándar:", constraintErr);
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: true
        });
      }

      this.sourceNode = this.audioCtx.createMediaStreamSource(this.mediaStream);
      this.analyserNode = this.audioCtx.createAnalyser();
      this.analyserNode.fftSize = this.bufferSize;
      this.analyserNode.smoothingTimeConstant = 0.1;

      // Filtro Paso Alto (High-pass): Elimina ruidos subsónicos (< 60 Hz)
      this.highpassFilter = this.audioCtx.createBiquadFilter();
      this.highpassFilter.type = 'highpass';
      this.highpassFilter.frequency.value = 60;
      this.highpassFilter.Q.value = 0.7;

      // Filtro Paso Bajo (Low-pass): Elimina siseos y conversaciones (> 1200 Hz)
      this.lowpassFilter = this.audioCtx.createBiquadFilter();
      this.lowpassFilter.type = 'lowpass';
      this.lowpassFilter.frequency.value = 1200;
      this.lowpassFilter.Q.value = 0.7;

      this.setupRouting();
      this.isRunning = true;
      return true;
    } catch (err) {
      console.error("Error al iniciar el procesador de audio:", err);
      this.isRunning = false;
      throw err;
    }
  }

  /**
   * Conecta los nodos de audio según esté activo o no el filtro anti-ruido
   */
  setupRouting() {
    if (!this.sourceNode || !this.analyserNode) return;

    try {
      this.sourceNode.disconnect();
      if (this.highpassFilter) this.highpassFilter.disconnect();
      if (this.lowpassFilter) this.lowpassFilter.disconnect();
    } catch (e) {}

    if (this.isFilterEnabled && this.highpassFilter && this.lowpassFilter) {
      // Micro -> Highpass -> Lowpass -> Analyser
      this.sourceNode.connect(this.highpassFilter);
      this.highpassFilter.connect(this.lowpassFilter);
      this.lowpassFilter.connect(this.analyserNode);
    } else {
      // Micro directo a Analyser
      this.sourceNode.connect(this.analyserNode);
    }
  }

  /**
   * Activa o desactiva el aislamiento de ruido
   */
  setFilterEnabled(enabled) {
    this.isFilterEnabled = enabled;
    this.setupRouting();
  }

  /**
   * Detiene el micrófono y libera recursos
   */
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

  /**
   * Reanuda el contexto si el navegador lo suspendió
   */
  async resumeContextIfNeeded() {
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      try {
        await this.audioCtx.resume();
      } catch (e) {}
    }
  }

  /**
   * Calcula la energía RMS (Root Mean Square)
   */
  getRMS(buffer) {
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      sum += buffer[i] * buffer[i];
    }
    return Math.sqrt(sum / buffer.length);
  }

  /**
   * Obtiene la muestra actual, nivel de volumen y detecta la nota
   */
  detectPitch() {
    if (!this.isRunning || !this.analyserNode) {
      return null;
    }

    this.resumeContextIfNeeded();

    this.analyserNode.getFloatTimeDomainData(this.buffer);

    // Calcular volumen RMS
    const rms = this.getRMS(this.buffer);
    
    // Nivel normalizado para el vúmetro visual (0 a 100%)
    const volumePercent = Math.min(100, Math.round((rms / 0.08) * 100));

    // Si está por debajo de la puerta de ruido, reportar el nivel pero no calcular nota errática
    if (rms < this.noiseThreshold) {
      return {
        hasSignal: false,
        rms: rms,
        volumePercent: volumePercent,
        buffer: this.buffer
      };
    }

    const sampleRate = this.audioCtx ? this.audioCtx.sampleRate : 44100;

    // Detección de Frecuencia con YIN mejorado
    let frequency = this.yinPitchDetection(this.buffer, sampleRate);

    // Si YIN no detectó, intentar con autocorrelación de respaldo
    if (!frequency || frequency < 60 || frequency > 1200) {
      frequency = this.autoCorrelationPitch(this.buffer, sampleRate);
    }

    // Si sigue fuera del rango de guitarra, retornar solo señal
    if (!frequency || frequency < 60 || frequency > 1200) {
      return {
        hasSignal: false,
        rms: rms,
        volumePercent: volumePercent,
        buffer: this.buffer
      };
    }

    // Convertir frecuencia a nota musical y desviación en cents
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
   * Algoritmo YIN para detección precisa de tono monofónico
   */
  yinPitchDetection(buffer, sampleRate) {
    const halfBufferSize = Math.floor(buffer.length / 2);
    const yinBuffer = new Float32Array(halfBufferSize);

    // 1. Diferencia cuadrática acumulada
    for (let tau = 0; tau < halfBufferSize; tau++) {
      let sum = 0;
      for (let i = 0; i < halfBufferSize; i++) {
        const delta = buffer[i] - buffer[i + tau];
        sum += delta * delta;
      }
      yinBuffer[tau] = sum;
    }

    // 2. Normalización CMNDF
    yinBuffer[0] = 1;
    let runningSum = 0;
    for (let tau = 1; tau < halfBufferSize; tau++) {
      runningSum += yinBuffer[tau];
      yinBuffer[tau] = (yinBuffer[tau] * tau) / (runningSum || 1);
    }

    // 3. Primer mínimo local significativo (umbral tolerante para micrófonos móviles)
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

    // Búsqueda de mínimo global si no superó el umbral estricto
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

    // 4. Interpolación parabólica
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
      const denominator = 2 * (2 * s1 - s2 - s0);
      if (denominator !== 0) {
        betterTau = tauEstimate + (s2 - s0) / denominator;
      } else {
        betterTau = tauEstimate;
      }
    }

    return sampleRate / betterTau;
  }

  /**
   * Autocorrelación normalizada de respaldo
   */
  autoCorrelationPitch(buffer, sampleRate) {
    const minSamples = Math.floor(sampleRate / 1200); // ~1200 Hz
    const maxSamples = Math.floor(sampleRate / 60);   // ~60 Hz
    
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

    if (maxCorrelation > 0.01 && bestOffset !== -1) {
      return sampleRate / bestOffset;
    }
    return null;
  }

  /**
   * Convierte frecuencia (Hz) a nota musical, octava y desviación en cents
   */
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
