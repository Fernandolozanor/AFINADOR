/**
 * Afinador Pro - Lógica de Interfaz y Afinaciones de Guitarra
 */

// Presets de Afinaciones de Guitarra con frecuencias exactas y notaciones
const GUITAR_TUNINGS = [
  {
    id: 'standard',
    name: 'Estándar',
    subtitle: 'E A D G B E',
    strings: [
      { num: 6, noteAm: 'E', noteEu: 'Mi', oct: 2, freq: 82.41 },
      { num: 5, noteAm: 'A', noteEu: 'La', oct: 2, freq: 110.00 },
      { num: 4, noteAm: 'D', noteEu: 'Re', oct: 3, freq: 146.83 },
      { num: 3, noteAm: 'G', noteEu: 'Sol', oct: 3, freq: 196.00 },
      { num: 2, noteAm: 'B', noteEu: 'Si', oct: 3, freq: 246.94 },
      { num: 1, noteAm: 'E', noteEu: 'Mi', oct: 4, freq: 329.63 }
    ]
  },
  {
    id: 'drop_d',
    name: 'Drop D',
    subtitle: 'D A D G B E',
    strings: [
      { num: 6, noteAm: 'D', noteEu: 'Re', oct: 2, freq: 73.42 },
      { num: 5, noteAm: 'A', noteEu: 'La', oct: 2, freq: 110.00 },
      { num: 4, noteAm: 'D', noteEu: 'Re', oct: 3, freq: 146.83 },
      { num: 3, noteAm: 'G', noteEu: 'Sol', oct: 3, freq: 196.00 },
      { num: 2, noteAm: 'B', noteEu: 'Si', oct: 3, freq: 246.94 },
      { num: 1, noteAm: 'E', noteEu: 'Mi', oct: 4, freq: 329.63 }
    ]
  },
  {
    id: 'dadgad',
    name: 'DADGAD',
    subtitle: 'D A D G A D',
    strings: [
      { num: 6, noteAm: 'D', noteEu: 'Re', oct: 2, freq: 73.42 },
      { num: 5, noteAm: 'A', noteEu: 'La', oct: 2, freq: 110.00 },
      { num: 4, noteAm: 'D', noteEu: 'Re', oct: 3, freq: 146.83 },
      { num: 3, noteAm: 'G', noteEu: 'Sol', oct: 3, freq: 196.00 },
      { num: 2, noteAm: 'A', noteEu: 'La', oct: 3, freq: 220.00 },
      { num: 1, noteAm: 'D', noteEu: 'Re', oct: 4, freq: 293.66 }
    ]
  },
  {
    id: 'open_d',
    name: 'Open D',
    subtitle: 'D A D F# A D',
    strings: [
      { num: 6, noteAm: 'D', noteEu: 'Re', oct: 2, freq: 73.42 },
      { num: 5, noteAm: 'A', noteEu: 'La', oct: 2, freq: 110.00 },
      { num: 4, noteAm: 'D', noteEu: 'Re', oct: 3, freq: 146.83 },
      { num: 3, noteAm: 'F#', noteEu: 'Fa#', oct: 3, freq: 185.00 },
      { num: 2, noteAm: 'A', noteEu: 'La', oct: 3, freq: 220.00 },
      { num: 1, noteAm: 'D', noteEu: 'Re', oct: 4, freq: 293.66 }
    ]
  },
  {
    id: 'open_g',
    name: 'Open G',
    subtitle: 'D G D G B D',
    strings: [
      { num: 6, noteAm: 'D', noteEu: 'Re', oct: 2, freq: 73.42 },
      { num: 5, noteAm: 'G', noteEu: 'Sol', oct: 2, freq: 98.00 },
      { num: 4, noteAm: 'D', noteEu: 'Re', oct: 3, freq: 146.83 },
      { num: 3, noteAm: 'G', noteEu: 'Sol', oct: 3, freq: 196.00 },
      { num: 2, noteAm: 'B', noteEu: 'Si', oct: 3, freq: 246.94 },
      { num: 1, noteAm: 'D', noteEu: 'Re', oct: 4, freq: 293.66 }
    ]
  },
  {
    id: 'half_step',
    name: 'Eb (1/2 Tono)',
    subtitle: 'Eb Ab Db Gb Bb Eb',
    strings: [
      { num: 6, noteAm: 'D#', noteEu: 'Mi♭', oct: 2, freq: 77.78 },
      { num: 5, noteAm: 'G#', noteEu: 'La♭', oct: 2, freq: 103.83 },
      { num: 4, noteAm: 'C#', noteEu: 'Re♭', oct: 3, freq: 138.59 },
      { num: 3, noteAm: 'F#', noteEu: 'Sol♭', oct: 3, freq: 185.00 },
      { num: 2, noteAm: 'A#', noteEu: 'Si♭', oct: 3, freq: 233.08 },
      { num: 1, noteAm: 'D#', noteEu: 'Mi♭', oct: 4, freq: 311.13 }
    ]
  },
  {
    id: 'drop_c',
    name: 'Drop C',
    subtitle: 'C G C F A D',
    strings: [
      { num: 6, noteAm: 'C', noteEu: 'Do', oct: 2, freq: 65.41 },
      { num: 5, noteAm: 'G', noteEu: 'Sol', oct: 2, freq: 98.00 },
      { num: 4, noteAm: 'C', noteEu: 'Do', oct: 3, freq: 130.81 },
      { num: 3, noteAm: 'F', noteEu: 'Fa', oct: 3, freq: 174.61 },
      { num: 2, noteAm: 'A', noteEu: 'La', oct: 3, freq: 220.00 },
      { num: 1, noteAm: 'D', noteEu: 'Re', oct: 4, freq: 293.66 }
    ]
  }
];

class GuitarTunerApp {
  constructor() {
    this.audioProcessor = new AudioProcessor();
    this.currentTuning = GUITAR_TUNINGS[0];
    this.selectedStringIndex = null; // null = Modo AUTO
    this.isAutoMode = true;

    // Estado de la aguja con suavizado (LERP)
    this.currentAngle = 0;
    this.targetAngle = 0;

    // Cache de Elementos DOM
    this.dom = {
      welcomeOverlay: document.getElementById('welcomeOverlay'),
      startAppBtn: document.getElementById('startAppBtn'),
      powerBtn: document.getElementById('powerBtn'),
      noiseFilterBtn: document.getElementById('noiseFilterBtn'),
      signalStatus: document.getElementById('signalStatus'),
      tuningsTrack: document.getElementById('tuningsTrack'),
      gaugeTicks: document.getElementById('gaugeTicks'),
      needleBody: document.getElementById('needleBody'),
      needleHead: document.getElementById('needleHead'),
      meterWrapper: document.querySelector('.meter-wrapper'),
      centsValue: document.getElementById('centsValue'),
      flatIndicator: document.getElementById('flatIndicator'),
      sharpIndicator: document.getElementById('sharpIndicator'),
      noteAmerican: document.getElementById('noteAmerican'),
      noteOctave: document.getElementById('noteOctave'),
      euNoteName: document.getElementById('euNoteName'),
      freqValue: document.getElementById('freqValue'),
      tuningFeedback: document.getElementById('tuningFeedback'),
      currentTuningName: document.getElementById('currentTuningName'),
      autoModeBtn: document.getElementById('autoModeBtn'),
      stringsRack: document.getElementById('stringsRack'),
      waveCanvas: document.getElementById('waveCanvas'),
      vuBar: document.getElementById('vuBar')
    };

    this.smoothedCents = 0;
    this.lockedStringIndex = null;
    this.stringHoldCounter = 0;

    // Canvas de fondo
    this.canvasCtx = this.dom.waveCanvas.getContext('2d');
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    this.lastInTuneVibrate = 0;

    this.init();
  }

  init() {
    this.renderTicks();
    this.renderTuningsBar();
    this.renderStringsRack();
    this.setupEventListeners();
    this.startRenderLoop();
  }

  resizeCanvas() {
    this.dom.waveCanvas.width = window.innerWidth;
    this.dom.waveCanvas.height = window.innerHeight;
  }

  /**
   * Genera las marcas graduadas del medidor (-50 a +50 cents)
   */
  renderTicks() {
    const ticksGroup = this.dom.gaugeTicks;
    ticksGroup.innerHTML = '';

    const cx = 160;
    const cy = 180;
    const rOuter = 125;
    const rInnerMinor = 117;
    const rInnerMajor = 112;

    // Ángulo de -60° a +60° para representar de -50 cents a +50 cents
    for (let c = -50; c <= 50; c += 5) {
      const angleDeg = (c / 50) * 60 - 90; // -90 es la vertical
      const angleRad = (angleDeg * Math.PI) / 180;

      const isMajor = c % 10 === 0;
      const isCenter = c === 0;
      const rInner = isMajor ? rInnerMajor : rInnerMinor;

      const x1 = cx + rOuter * Math.cos(angleRad);
      const y1 = cy + rOuter * Math.sin(angleRad);
      const x2 = cx + rInner * Math.cos(angleRad);
      const y2 = cy + rInner * Math.sin(angleRad);

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', x1);
      line.setAttribute('y1', y1);
      line.setAttribute('x2', x2);
      line.setAttribute('y2', y2);

      let className = 'gauge-tick';
      if (isMajor) className += ' major';
      if (isCenter) className += ' center-tick';
      line.setAttribute('class', className);

      ticksGroup.appendChild(line);
    }
  }

  /**
   * Renderiza la barra de afinaciones rápidas
   */
  renderTuningsBar() {
    const track = this.dom.tuningsTrack;
    track.innerHTML = '';

    GUITAR_TUNINGS.forEach((tuning, index) => {
      const chip = document.createElement('button');
      chip.className = `tuning-chip ${index === 0 ? 'active' : ''}`;
      chip.textContent = tuning.name;
      chip.addEventListener('click', () => {
        this.selectTuning(tuning);
      });
      track.appendChild(chip);
    });
  }

  selectTuning(tuning) {
    this.currentTuning = tuning;
    this.selectedStringIndex = null;
    this.isAutoMode = true;
    this.dom.autoModeBtn.classList.add('active');

    // Actualizar pills
    const chips = this.dom.tuningsTrack.querySelectorAll('.tuning-chip');
    chips.forEach(chip => {
      chip.classList.toggle('active', chip.textContent === tuning.name);
    });

    this.dom.currentTuningName.textContent = `${tuning.name} (${tuning.subtitle})`;
    this.renderStringsRack();
  }

  /**
   * Renderiza las 6 cuerdas interactivas
   */
  renderStringsRack() {
    const rack = this.dom.stringsRack;
    rack.innerHTML = '';

    this.currentTuning.strings.forEach((str, index) => {
      const card = document.createElement('div');
      card.className = 'string-card';
      card.dataset.index = index;

      card.innerHTML = `
        <span class="string-number">${str.num}ª</span>
        <span class="string-note-am">${str.noteAm}</span>
        <span class="string-note-eu">${str.noteEu}</span>
        <div class="string-gauge-line"></div>
      `;

      let holdTimer = null;
      let hasPlayedTone = false;
      let isPressing = false;

      const handlePressStart = (e) => {
        if (isPressing) return;
        isPressing = true;
        hasPlayedTone = false;

        if (holdTimer) {
          clearTimeout(holdTimer);
          holdTimer = null;
        }

        // Solo suena si se mantiene pulsado más de 380ms (afinación de oído)
        holdTimer = setTimeout(() => {
          if (!isPressing) return;
          hasPlayedTone = true;
          card.classList.add('playing-tone');
          this.audioProcessor.startGuitarTone(str.freq);

          if ('vibrate' in navigator) {
            try { navigator.vibrate(25); } catch (err) {}
          }
        }, 380);
      };

      const handlePressEnd = (e) => {
        if (!isPressing) return;
        isPressing = false;

        // Cancelar temporizador si se soltó antes del umbral de pulsación larga
        if (holdTimer) {
          clearTimeout(holdTimer);
          holdTimer = null;
        }

        if (hasPlayedTone) {
          // Detener el sonido de la cuerda
          hasPlayedTone = false;
          card.classList.remove('playing-tone');
          this.audioProcessor.stopGuitarTone();
        } else {
          // Pulsación corta / toque rápido: SELECCIONA LA CUERDA EN SILENCIO
          if (this.selectedStringIndex === index) {
            // Deseleccionar y volver a AUTO
            this.selectedStringIndex = null;
            this.isAutoMode = true;
            this.dom.autoModeBtn.classList.add('active');
            this.highlightString(null);
          } else {
            // Seleccionar esta cuerda manualmente
            this.selectedStringIndex = index;
            this.isAutoMode = false;
            this.dom.autoModeBtn.classList.remove('active');
            this.highlightString(index);
          }
        }
      };

      if (window.PointerEvent) {
        card.addEventListener('pointerdown', handlePressStart);
        card.addEventListener('pointerup', handlePressEnd);
        card.addEventListener('pointercancel', handlePressEnd);
        card.addEventListener('pointerleave', handlePressEnd);
      } else {
        card.addEventListener('touchstart', handlePressStart, { passive: true });
        card.addEventListener('touchend', handlePressEnd, { passive: true });
        card.addEventListener('touchcancel', handlePressEnd, { passive: true });
        card.addEventListener('mousedown', handlePressStart);
        card.addEventListener('mouseup', handlePressEnd);
        card.addEventListener('mouseleave', handlePressEnd);
      }

      rack.appendChild(card);
    });
  }

  highlightString(index, isInTune = false) {
    const cards = this.dom.stringsRack.querySelectorAll('.string-card');
    cards.forEach((card, idx) => {
      card.classList.remove('detected', 'in-tune');
      if (idx === index) {
        card.classList.add(isInTune ? 'in-tune' : 'detected');
      }
    });
  }

  setupEventListeners() {
    // Botón de Inicio en el Overlay
    this.dom.startAppBtn.addEventListener('click', async () => {
      await this.startListening();
      this.dom.welcomeOverlay.classList.add('hidden');
    });

    // Botón Power / Micrófono
    this.dom.powerBtn.addEventListener('click', async () => {
      if (this.audioProcessor.isRunning) {
        this.stopListening();
      } else {
        await this.startListening();
      }
    });

    // Filtro anti-ruido ambiental
    this.dom.noiseFilterBtn.addEventListener('click', () => {
      const newState = !this.audioProcessor.isFilterEnabled;
      this.audioProcessor.setFilterEnabled(newState);
      this.dom.noiseFilterBtn.classList.toggle('active', newState);
    });

    // Botón Modo AUTO
    this.dom.autoModeBtn.addEventListener('click', () => {
      this.isAutoMode = true;
      this.selectedStringIndex = null;
      this.dom.autoModeBtn.classList.add('active');
      this.highlightString(null);
    });

    // Selector de ganancia digital / Boost (+14 dB / +20 dB / 0 dB)
    this.boostModes = [
      { label: '+14dB', val: 5.0, active: true },
      { label: '+20dB', val: 10.0, active: true },
      { label: '0dB', val: 1.0, active: false }
    ];
    this.currentBoostIndex = 0;

    const micBoostBtn = document.getElementById('micBoostBtn');
    const boostLabel = document.getElementById('boostLabel');
    if (micBoostBtn && boostLabel) {
      micBoostBtn.addEventListener('click', () => {
        this.currentBoostIndex = (this.currentBoostIndex + 1) % this.boostModes.length;
        const mode = this.boostModes[this.currentBoostIndex];
        this.audioProcessor.setBoostLevel(mode.val);
        boostLabel.textContent = mode.label;
        micBoostBtn.classList.toggle('active', mode.active);
      });
    }

    // Al mantener pulsada la nota central grande, también suena su tono afinado
    const noteDisplay = document.querySelector('.note-display-overlay');
    if (noteDisplay) {
      let isOverlayPressing = false;
      const playOverlayTone = (e) => {
        if (isOverlayPressing) return;
        isOverlayPressing = true;
        let targetFreq = 110.0;
        if (this.lockedStringIndex !== null) {
          targetFreq = this.currentTuning.strings[this.lockedStringIndex].freq;
        } else if (this.selectedStringIndex !== null) {
          targetFreq = this.currentTuning.strings[this.selectedStringIndex].freq;
        }
        this.audioProcessor.startGuitarTone(targetFreq);
        if ('vibrate' in navigator) {
          try { navigator.vibrate(20); } catch (err) {}
        }
      };
      const stopOverlayTone = () => {
        if (!isOverlayPressing) return;
        isOverlayPressing = false;
        this.audioProcessor.stopGuitarTone();
      };

      noteDisplay.addEventListener('pointerdown', playOverlayTone);
      noteDisplay.addEventListener('pointerup', stopOverlayTone);
      noteDisplay.addEventListener('pointerleave', stopOverlayTone);
      noteDisplay.addEventListener('pointercancel', stopOverlayTone);
      noteDisplay.addEventListener('touchstart', playOverlayTone, { passive: true });
      noteDisplay.addEventListener('touchend', stopOverlayTone, { passive: true });
      noteDisplay.addEventListener('touchcancel', stopOverlayTone, { passive: true });
    }
  }

  async startListening() {
    try {
      this.dom.signalStatus.textContent = 'CONECTANDO...';
      await this.audioProcessor.start();
      this.dom.powerBtn.classList.add('active');
      this.dom.signalStatus.textContent = 'ESCUCHANDO';
      this.dom.signalStatus.classList.add('listening');
    } catch (err) {
      this.dom.signalStatus.textContent = 'ERROR DE MIC';
      alert('No se pudo acceder al micrófono. Por favor asegúrate de otorgar los permisos necesarios en tu navegador móvil.');
    }
  }

  stopListening() {
    this.audioProcessor.stop();
    this.dom.powerBtn.classList.remove('active');
    this.dom.signalStatus.textContent = 'DETENIDO';
    this.dom.signalStatus.classList.remove('listening');
    this.resetDisplay();
  }

  resetDisplay() {
    this.targetAngle = 0;
    this.smoothedCents = 0;
    this.lockedStringIndex = null;
    this.dom.noteAmerican.textContent = '-';
    this.dom.noteOctave.textContent = '';
    this.dom.euNoteName.textContent = '-';
    this.dom.freqValue.textContent = '00.0';
    this.dom.centsValue.textContent = '0';
    this.dom.flatIndicator.classList.remove('active');
    this.dom.sharpIndicator.classList.remove('active');
    this.dom.meterWrapper.className = 'meter-wrapper';
    this.dom.tuningFeedback.innerHTML = '<span class="status-badge">Toca una cuerda</span>';
    this.highlightString(null);
  }

  /**
   * Identifica qué cuerda del preset corresponde a la frecuencia detectada
   */
  findClosestString(freq) {
    if (!freq) return null;
    let closestIndex = -1;
    let minDifference = Infinity;

    this.currentTuning.strings.forEach((str, index) => {
      // Comparar en relación logarítmica (semitonos)
      const semitoneDist = Math.abs(12 * Math.log2(freq / str.freq));
      if (semitoneDist < minDifference) {
        minDifference = semitoneDist;
        closestIndex = index;
      }
    });

    // Histéresis: si ya estamos afinando una cuerda y la nota sigue cerca, conservarla
    if (this.lockedStringIndex !== null) {
      const currentLockedStr = this.currentTuning.strings[this.lockedStringIndex];
      const lockedDist = Math.abs(12 * Math.log2(freq / currentLockedStr.freq));
      if (lockedDist < 2.5) {
        return this.lockedStringIndex;
      }
    }

    if (minDifference < 2.8) {
      this.lockedStringIndex = closestIndex;
      return closestIndex;
    }
    return null;
  }

  /**
   * Bucle principal de animación a 60 FPS con trigonometría pura y cero bugs de Safari
   */
  startRenderLoop() {
    const loop = () => {
      if (this.audioProcessor.isRunning) {
        const pitchData = this.audioProcessor.detectPitch();
        if (pitchData) {
          if (this.dom.vuBar) {
            this.dom.vuBar.style.width = `${pitchData.volumePercent || 0}%`;
          }
          this.processPitchData(pitchData);
          if (pitchData.buffer) {
            this.drawWave(pitchData.buffer, (pitchData.volumePercent || 0) > 3);
          }
        }
      } else {
        if (this.dom.vuBar) this.dom.vuBar.style.width = '0%';
        this.drawWave(null, false);
      }

      // Suavizado ultra fluido LERP a 60 FPS
      const angleDiff = this.targetAngle - this.currentAngle;
      this.currentAngle += angleDiff * 0.28;

      // Trigonometría pura: Pivote estrictamente anclado en (160, 180)
      const rad = (this.currentAngle - 90) * (Math.PI / 180);
      const needleLen = 124;
      const x2 = 160 + needleLen * Math.cos(rad);
      const y2 = 180 + needleLen * Math.sin(rad);

      if (this.dom.needleBody) {
        this.dom.needleBody.setAttribute('x2', x2.toFixed(1));
        this.dom.needleBody.setAttribute('y2', y2.toFixed(1));
      }
      if (this.dom.needleHead) {
        this.dom.needleHead.setAttribute('cx', x2.toFixed(1));
        this.dom.needleHead.setAttribute('cy', y2.toFixed(1));
      }

      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
  }

  processPitchData(data) {
    if (!data || !data.hasSignal) {
      // Regreso suave de la aguja hacia el centro
      this.targetAngle = this.targetAngle * 0.85;
      this.dom.flatIndicator.classList.remove('active');
      this.dom.sharpIndicator.classList.remove('active');
      return;
    }

    let { frequency, cents, noteAmerican, noteEuropean, octave } = data;

    // Identificar la cuerda objetivo
    let targetStringIndex = this.selectedStringIndex;
    if (this.isAutoMode) {
      targetStringIndex = this.findClosestString(frequency);
    }

    // Si tenemos una cuerda objetivo específica, afinamos relativo a su frecuencia exacta
    if (targetStringIndex !== null && targetStringIndex !== undefined) {
      const targetStr = this.currentTuning.strings[targetStringIndex];
      const exactCents = Math.round(1200 * Math.log2(frequency / targetStr.freq));
      if (Math.abs(exactCents) <= 60) {
        cents = exactCents;
        noteAmerican = targetStr.noteAm;
        noteEuropean = targetStr.noteEu;
        octave = targetStr.oct;
      }
    }

    // Suavizado EMA de los Cents para eliminar vibraciones espurias
    this.smoothedCents = this.smoothedCents * 0.62 + cents * 0.38;
    const roundedCents = Math.round(this.smoothedCents);

    // Ángulo de -60° a +60° según los Cents
    const clampedCents = Math.max(-50, Math.min(50, this.smoothedCents));
    this.targetAngle = (clampedCents / 50) * 60;

    // Actualizar textos en pantalla
    this.dom.noteAmerican.textContent = noteAmerican;
    this.dom.noteOctave.textContent = octave !== undefined ? octave : '';
    this.dom.euNoteName.textContent = noteEuropean;
    this.dom.freqValue.textContent = frequency.toFixed(1);
    this.dom.centsValue.textContent = `${roundedCents > 0 ? '+' : ''}${roundedCents}`;

    // Flechas Flat / Sharp
    this.dom.flatIndicator.classList.toggle('active', roundedCents < -2);
    this.dom.sharpIndicator.classList.toggle('active', roundedCents > 2);

    // Estados de afinación
    const isInTune = Math.abs(cents) <= 3;
    const isFlat = cents < -3;
    const isSharp = cents > 3;

    let meterClass = 'meter-wrapper';
    let feedbackHtml = '';

    if (isInTune) {
      meterClass += ' in-tune';
      feedbackHtml = '<span class="status-badge in-tune">✓ AFINADO PERFECTO</span>';
      
      // Feedback háptico en móviles cuando entra en tono
      const now = Date.now();
      if (now - this.lastInTuneVibrate > 1200 && 'vibrate' in navigator) {
        try {
          navigator.vibrate(25);
        } catch (e) {}
        this.lastInTuneVibrate = now;
      }
    } else if (isFlat) {
      meterClass += ' flat';
      feedbackHtml = `<span class="status-badge flat">Demasiado grave (${cents} cents)</span>`;
    } else if (isSharp) {
      meterClass += ' sharp';
      feedbackHtml = `<span class="status-badge sharp">Demasiado agudo (+${cents} cents)</span>`;
    }

    this.dom.meterWrapper.className = meterClass;
    this.dom.tuningFeedback.innerHTML = feedbackHtml;

    // Resaltar cuerda en el rack
    if (targetStringIndex !== null) {
      this.highlightString(targetStringIndex, isInTune);
    }
  }

  /**
   * Dibuja una onda suave en el fondo para dar sensación de vida y presencia
   */
  drawWave(buffer, hasSignal) {
    const ctx = this.canvasCtx;
    const width = this.dom.waveCanvas.width;
    const height = this.dom.waveCanvas.height;

    ctx.clearRect(0, 0, width, height);

    if (!buffer || !hasSignal) return;

    ctx.save();
    ctx.beginPath();

    const centerY = height * 0.42;
    const sliceWidth = width / (buffer.length / 4);
    let x = 0;

    for (let i = 0; i < buffer.length / 4; i += 2) {
      const v = buffer[i] * 90; // Escala vertical
      const y = centerY + v;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      x += sliceWidth * 2;
    }

    ctx.strokeStyle = 'rgba(0, 136, 203, 0.35)';
    ctx.lineWidth = 1.8;
    ctx.stroke();
    ctx.restore();
  }
}

// Iniciar aplicación al cargar el DOM
window.addEventListener('DOMContentLoaded', () => {
  window.tunerApp = new GuitarTunerApp();
});
