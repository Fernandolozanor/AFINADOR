/**
 * AudioProcessor - Motor de procesamiento de audio y detección de tono (Pitch Detection)
 * Utiliza Web Audio API con filtros analógicos digitales y el algoritmo YIN
 * optimizado para instrumentos de cuerda monofónicos (guitarra).
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

    // Configuración de buffer y muestreo
    this.bufferSize = 2048;
    this.buffer = new Float32Array(this.bufferSize);

    // Umbral de Noise Gate (RMS) para ignorar ruido ambiente
    this.noiseThreshold = 0.012; 

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
    if (this.isRunning) return true;

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContextClass({
        latencyHint: 'interactive'
      });

      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }

      // Solicitamos acceso al micro optimizado para instrumentos musicales
      // Desactivamos la compresión telefónica estándar que apaga el sustain de las cuerdas
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 1
        }
      });

      this.sourceNode = this.audioCtx.createMediaStreamSource(this.mediaStream);
      this.analyserNode = this.audioCtx.createAnalyser();
      this.analyserNode.fftSize = this.bufferSize;

      // Filtro Paso Alto (High-pass): Elimina ruidos subsónicos (< 65 Hz, ej. golpes, viento)
      this.highpassFilter = this.audioCtx.createBiquadFilter();
      this.highpassFilter.type = 'highpass';
      this.highpassFilter.frequency.value = 65; // La nota más grave en guitarra Drop C / E2 es ~65-82 Hz
      this.highpassFilter.Q.value = 0.7;

      // Filtro Paso Bajo (Low-pass): Elimina siseos, ruido blanco y conversaciones (> 1000 Hz)
      this.lowpassFilter = this.audioCtx.createBiquadFilter();
      this.lowpassFilter.type = 'lowpass';
      this.lowpassFilter.frequency.value = 1000;
      this.lowpassFilter.Q.value = 0.7;

      this.setupRouting();
      this.isRunning = true;
      return true;
    } catch (err) {
      console.error("Error al iniciar el procesador de audio:", err);
      throw err;
    }
  }

  /**
   * Conecta los nodos de audio según esté activo o no el filtro anti-ruido
   */
  setupRouting() {
    if (!this.sourceNode || !this.analyserNode) return;

    // Desconectar antes de re-enrutar
    try {
      this.sourceNode.disconnect();
      this.highpassFilter.disconnect();
      this.lowpassFilter.disconnect();
    } catch (e) {}

    if (this.isFilterEnabled) {
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
      this.audioCtx.close();
      this.audioCtx = null;
    }

    this.isRunning = false;
  }

  /**
   * Calcula la energía RMS (Root Mean Square) del buffer para la puerta de ruido
   */
  getRMS(buffer) {
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      sum += buffer[i] * buffer[i];
    }
    return Math.sqrt(sum / buffer.length);
  }

  /**
   * Obtiene la muestra actual y detecta la frecuencia fundamental y notas
   */
  detectPitch() {
    if (!this.isRunning || !this.analyserNode) {
      return null;
    }

    this.analyserNode.getFloatTimeDomainData(this.buffer);

    // 1. Noise Gate: Verificar si la señal supera el nivel de ruido de fondo
    const rms = this.getRMS(this.buffer);
    if (rms < this.noiseThreshold) {
      return {
        hasSignal: false,
        rms: rms,
        buffer: this.buffer
      };
    }

    // 2. Detección de Frecuencia con el Algoritmo YIN
    const frequency = this.yinPitchDetection(this.buffer, this.audioCtx.sampleRate);

    // Si la frecuencia está fuera del rango de guitarra estándar (65 Hz a 1100 Hz), ignorar
    if (!frequency || frequency < 65 || frequency > 1100) {
      return {
        hasSignal: false,
        rms: rms,
        buffer: this.buffer
      };
    }

    // 3. Convertir frecuencia a nota musical y desviación en cents
    const noteInfo = this.frequencyToNote(frequency);

    return {
      hasSignal: true,
      rms: rms,
      frequency: frequency,
      buffer: this.buffer,
      ...noteInfo
    };
  }

  /**
   * Algoritmo YIN para detección de tono monofónico
   * Resuelve el problema de armónicos y saltos de octava.
   */
  yinPitchDetection(buffer, sampleRate) {
    const halfBufferSize = Math.floor(buffer.length / 2);
    const yinBuffer = new Float32Array(halfBufferSize);

    // Paso 1: Función de diferencia acumulada
    for (let tau = 0; tau < halfBufferSize; tau++) {
      let sum = 0;
      for (let i = 0; i < halfBufferSize; i++) {
        const delta = buffer[i] - buffer[i + tau];
        sum += delta * delta;
      }
      yinBuffer[tau] = sum;
    }

    // Paso 2: Función de diferencia normalizada acumulada (CMNDF)
    yinBuffer[0] = 1;
    let runningSum = 0;
    for (let tau = 1; tau < halfBufferSize; tau++) {
      runningSum += yinBuffer[tau];
      yinBuffer[tau] = (yinBuffer[tau] * tau) / (runningSum || 1);
    }

    // Paso 3: Umbral absoluto para seleccionar el primer mínimo local significativo
    const threshold = 0.15;
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

    // Si no encontró por debajo del umbral, buscar el mínimo global
    if (tauEstimate === -1) {
      let minVal = 1000;
      let minTau = -1;
      for (let tau = 2; tau < halfBufferSize; tau++) {
        if (yinBuffer[tau] < minVal) {
          minVal = yinBuffer[tau];
          minTau = tau;
        }
      }
      if (minVal < 0.35) {
        tauEstimate = minTau;
      } else {
        return null; // Demasiado ruidoso / no aperiódico
      }
    }

    // Paso 4: Interpolación parabólica para precisión sub-muestra
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
      betterTau = tauEstimate + (s2 - s0) / (2 * (2 * s1 - s2 - s0));
    }

    return sampleRate / betterTau;
  }

  /**
   * Convierte frecuencia (Hz) a nota musical, octava y desviación en cents
   */
  frequencyToNote(frequency) {
    // Número MIDI de la nota: A4 = 69 = 440 Hz
    const midiNumber = 69 + 12 * Math.log2(frequency / this.a4Frequency);
    const roundedMidi = Math.round(midiNumber);

    // Desviación en Cents respecto al tono temperado ideal (-50 a +50)
    const cents = Math.round((midiNumber - roundedMidi) * 100);

    const noteIndex = ((roundedMidi % 12) + 12) % 12;
    const octave = Math.floor(roundedMidi / 12) - 1;

    const noteAmerican = this.notesAmerican[noteIndex];
    const noteEuropean = this.notesEuropean[noteIndex];

    // Frecuencia ideal de la nota más cercana
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
