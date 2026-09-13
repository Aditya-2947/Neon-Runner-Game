// src/audio.js - Web Audio API Synthesizer for Retro Cyberpunk SFX

class AudioSynth {
    constructor() {
        this.ctx = null;
        this.masterVolume = null;
        this.isMuted = false;
        this.musicInterval = null;
    }

    // Initialize AudioContext on first user interaction
    init() {
        if (this.ctx) return;

        try {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContextClass();
            
            // Set up master gain node
            this.masterVolume = this.ctx.createGain();
            this.masterVolume.gain.setValueAtTime(0.3, this.ctx.currentTime); // keep overall volume comfortable
            this.masterVolume.connect(this.ctx.destination);
            
            console.log("Audio Synth Initialized successfully.");
        } catch (e) {
            console.warn("Web Audio API is not supported in this browser:", e);
        }
    }

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    // Synthesize Jump sound (Rising pitch sweep)
    playJump() {
        this.init();
        this.resume();
        if (!this.ctx || this.isMuted) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle'; // softer than square, chunkier than sine
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(580, now + 0.15);

        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

        osc.connect(gain);
        gain.connect(this.masterVolume);

        osc.start(now);
        osc.stop(now + 0.16);
    }

    // Synthesize Slide sound (Friction/noise swoosh)
    playSlide() {
        this.init();
        this.resume();
        if (!this.ctx || this.isMuted) return;

        const now = this.ctx.currentTime;
        const duration = 0.35;

        // Generate white noise buffer
        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        // Create bandpass filter to sound like "sliding/whoosh"
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(600, now);
        filter.frequency.exponentialRampToValueAtTime(300, now + duration);
        filter.Q.setValueAtTime(3, now);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.6, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterVolume);

        noise.start(now);
        noise.stop(now + duration);
    }

    // Synthesize Near-Miss blip (quick high-pitched triangle ping)
    playNearMiss() {
        this.init();
        this.resume();
        if (!this.ctx || this.isMuted) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1200, now);
        osc.frequency.exponentialRampToValueAtTime(1800, now + 0.04);
        osc.frequency.exponentialRampToValueAtTime(900, now + 0.08);

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

        osc.connect(gain);
        gain.connect(this.masterVolume);

        osc.start(now);
        osc.stop(now + 0.09);
    }

    // Synthesize Coin collection sound (Double sweet chime)
    playCoin() {
        this.init();
        this.resume();
        if (!this.ctx || this.isMuted) return;

        const now = this.ctx.currentTime;
        
        // Tone 1
        const osc1 = this.ctx.createOscillator();
        const gain1 = this.ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(987.77, now); // B5
        gain1.gain.setValueAtTime(0.25, now);
        gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
        
        osc1.connect(gain1);
        gain1.connect(this.masterVolume);
        osc1.start(now);
        osc1.stop(now + 0.09);

        // Tone 2 (offset)
        const osc2 = this.ctx.createOscillator();
        const gain2 = this.ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1318.51, now + 0.08); // E6
        gain2.gain.setValueAtTime(0, now);
        gain2.gain.setValueAtTime(0.25, now + 0.08);
        gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

        osc2.connect(gain2);
        gain2.connect(this.masterVolume);
        osc2.start(now + 0.08);
        osc2.stop(now + 0.26);
    }

    // Synthesize Elimination sound (Explosion / crash)
    playElimination() {
        this.init();
        this.resume();
        if (!this.ctx || this.isMuted) return;

        const now = this.ctx.currentTime;
        const duration = 0.5;

        // 1. Low frequency thump/crash
        const osc = this.ctx.createOscillator();
        const oscGain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.linearRampToValueAtTime(20, now + duration);
        
        oscGain.gain.setValueAtTime(0.6, now);
        oscGain.gain.exponentialRampToValueAtTime(0.01, now + duration);

        osc.connect(oscGain);
        oscGain.connect(this.masterVolume);
        osc.start(now);
        osc.stop(now + duration);

        // 2. White noise burst
        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1000, now);
        filter.frequency.exponentialRampToValueAtTime(100, now + duration);

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.8, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, now + duration);

        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(this.masterVolume);

        noise.start(now);
        noise.stop(now + duration);
    }

    // Synthesize Speed Up sound (Arpeggio sweep)
    playSpeedUp() {
        this.init();
        this.resume();
        if (!this.ctx || this.isMuted) return;

        const now = this.ctx.currentTime;
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        
        notes.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now + idx * 0.07);
            
            gain.gain.setValueAtTime(0, now);
            gain.gain.setValueAtTime(0.2, now + idx * 0.07);
            gain.gain.exponentialRampToValueAtTime(0.005, now + idx * 0.07 + 0.15);
            
            osc.connect(gain);
            gain.connect(this.masterVolume);
            
            osc.start(now + idx * 0.07);
            osc.stop(now + idx * 0.07 + 0.16);
        });
    }

    // Synthesize Power-Up Pickup sound (Ascending energetic crystal sweep)
    playPowerUp() {
        this.init();
        this.resume();
        if (!this.ctx || this.isMuted) return;

        const now = this.ctx.currentTime;
        const notes = [440, 554.37, 659.25, 880, 1108.73]; // A4, C#5, E5, A5, C#6
        notes.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now + idx * 0.04);
            gain.gain.setValueAtTime(0, now);
            gain.gain.setValueAtTime(0.2, now + idx * 0.04);
            gain.gain.exponentialRampToValueAtTime(0.005, now + idx * 0.04 + 0.18);

            osc.connect(gain);
            gain.connect(this.masterVolume);
            osc.start(now + idx * 0.04);
            osc.stop(now + idx * 0.04 + 0.19);
        });
    }

    // Synthesize Shield Break sound (Metallic clang - sawtooth burst + resonant bandpass)
    playShieldBreak() {
        this.init();
        this.resume();
        if (!this.ctx || this.isMuted) return;

        const now = this.ctx.currentTime;
        const duration = 0.35;

        const osc = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(420, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + duration);

        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1400, now);
        filter.Q.value = 5.0;

        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterVolume);

        osc.start(now);
        osc.stop(now + duration);
    }

    // Synthesize EMP Blast sound (Noise explosion with sweep)
    playEMP() {
        this.init();
        this.resume();
        if (!this.ctx || this.isMuted) return;

        const now = this.ctx.currentTime;
        const duration = 0.6;
        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2400, now);
        filter.frequency.exponentialRampToValueAtTime(60, now + duration);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.7, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterVolume);

        noise.start(now);
        noise.stop(now + duration);
    }

    // Synthesize Dash Whoosh sound
    playDash() {
        this.init();
        this.resume();
        if (!this.ctx || this.isMuted) return;

        const now = this.ctx.currentTime;
        const duration = 0.22;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(280, now);
        osc.frequency.exponentialRampToValueAtTime(700, now + 0.08);
        osc.frequency.exponentialRampToValueAtTime(140, now + duration);

        gain.gain.setValueAtTime(0.0, now);
        gain.gain.linearRampToValueAtTime(0.35, now + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

        osc.connect(gain);
        gain.connect(this.masterVolume);

        osc.start(now);
        osc.stop(now + duration + 0.02);
    }

    // Synthesize Game Over music (Sad descending theme)
    playGameOver() {
        this.init();
        this.resume();
        if (!this.ctx || this.isMuted) return;

        const now = this.ctx.currentTime;
        // Descending sad minor arpeggio
        const notes = [392.00, 349.23, 311.13, 261.63]; // G4, F4, Eb4, C4
        const duration = 0.4;

        notes.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + idx * 0.2);
            
            gain.gain.setValueAtTime(0, now);
            gain.gain.setValueAtTime(0.3, now + idx * 0.2);
            gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.2 + duration);
            
            osc.connect(gain);
            gain.connect(this.masterVolume);
            
            osc.start(now + idx * 0.2);
            osc.stop(now + idx * 0.2 + duration + 0.05);
        });
    }

    // Synthesize Victory music (Bright happy chords)
    playVictory() {
        this.init();
        this.resume();
        if (!this.ctx || this.isMuted) return;

        const now = this.ctx.currentTime;
        // Rising energetic major chords
        const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51]; // C5, E5, G5, C6, E6
        
        notes.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now + idx * 0.1);
            
            gain.gain.setValueAtTime(0, now);
            gain.gain.setValueAtTime(0.25, now + idx * 0.1);
            gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.1 + 0.45);
            
            osc.connect(gain);
            gain.connect(this.masterVolume);
            
            osc.start(now + idx * 0.1);
            osc.stop(now + idx * 0.1 + 0.5);
        });
    }

    startMusic() {
        this.init();
        this.resume();
        if (!this.ctx || this.isMuted || this.musicInterval) return;

        let step = 0;
        const tempo = 125; // BPM
        const noteLength = 60 / tempo / 2; // eighth notes (0.24s)
        
        // Bassline notes (C minor retro feel)
        const bassFreqs = [
            65.41, 65.41, 77.78, 77.78, 97.99, 97.99, 87.31, 87.31 // C2, C2, Eb2, Eb2, G2, G2, F2, F2
        ];
        // Lead arpeggio notes (played on even steps)
        const leadFreqs = [
            261.63, 311.13, 392.00, 349.23, 392.00, 466.16, 523.25, 392.00 // C4, Eb4, G4, F4, G4, Bb4, C5, G4
        ];

        this.musicInterval = setInterval(() => {
            if (!this.ctx || this.ctx.state === 'suspended') return;
            const now = this.ctx.currentTime;
            const playTime = now + 0.05; // lookahead schedule
            
            // 1. Bassline play
            const bassOsc = this.ctx.createOscillator();
            const bassGain = this.ctx.createGain();
            bassOsc.type = 'sawtooth';
            bassOsc.frequency.setValueAtTime(bassFreqs[step % bassFreqs.length], playTime);
            
            const bassFilter = this.ctx.createBiquadFilter();
            bassFilter.type = 'lowpass';
            bassFilter.frequency.setValueAtTime(250, playTime);

            bassGain.gain.setValueAtTime(0.0, playTime);
            bassGain.gain.linearRampToValueAtTime(0.12, playTime + 0.02);
            bassGain.gain.exponentialRampToValueAtTime(0.005, playTime + noteLength - 0.02);

            bassOsc.connect(bassFilter);
            bassFilter.connect(bassGain);
            bassGain.connect(this.masterVolume);
            bassOsc.start(playTime);
            bassOsc.stop(playTime + noteLength);

            // 2. High Arpeggio melody (every step, but offset/delay, soft)
            if (step % 2 === 0) {
                const leadOsc = this.ctx.createOscillator();
                const leadGain = this.ctx.createGain();
                leadOsc.type = 'triangle';
                leadOsc.frequency.setValueAtTime(leadFreqs[(step / 2) % leadFreqs.length], playTime);

                leadGain.gain.setValueAtTime(0.0, playTime);
                leadGain.gain.linearRampToValueAtTime(0.04, playTime + 0.02);
                leadGain.gain.exponentialRampToValueAtTime(0.001, playTime + noteLength * 2 - 0.05);

                leadOsc.connect(leadGain);
                leadGain.connect(this.masterVolume);
                leadOsc.start(playTime);
                leadOsc.stop(playTime + noteLength * 2);
            }

            step++;
        }, noteLength * 1000);
    }

    stopMusic() {
        if (this.musicInterval) {
            clearInterval(this.musicInterval);
            this.musicInterval = null;
        }
    }
}

// Export a single instance of AudioSynth
export const audio = new AudioSynth();
export default audio;
