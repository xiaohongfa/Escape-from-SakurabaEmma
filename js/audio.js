/**
 * Procedural Web Audio System for Backrooms Game
 * Generates eerie 60Hz fluorescent hum, wet carpet footsteps,
 * proximity entity drones, heartbeat, and jumpscare sounds without external audio files.
 */
class BackroomsAudio {
    constructor() {
        this.ctx = null;
        this.isMuted = false;
        this.humNodes = null;
        this.barkBuffer = null;
        this.barkLoadPromise = null;
        this.barkVolume = 1.4;
        this.deathCallClips = null;
        this.m7ReloadBuffer = null;
        this.m7BurstBuffer = null;
        this.m7ShotBuffers = {};
        this.m7ActiveShots = new Set();
        this.m7Burst = null;
        this.m7ShotCount = 0;
        this.m7LastShotAt = -Infinity;
        this.m7PreviewClip = null;
        this.slideVoice = null;
        this.m7ShotVariant = 'a';
        try {
            const saved = localStorage.getItem('m7ShotVariant');
            if (['a', 'b', 'c'].includes(saved)) this.m7ShotVariant = saved;
        } catch (_) {}
        this.smilerBarks = new Map();
        this.heartbeatInterval = null;
        this.lastStepTime = 0;
    }

    init() {
        if (this.ctx) return;
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.8;
        this.masterGain.connect(this.ctx.destination);

        this.startFluorescentHum();
        this.loadEntityBark();
        this.loadDeathCalls();
        this.loadM7Audio();
    }

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    suspend() {
        this.stopM7Gunfire();
        this.stopSlide();
        if (this.ctx && this.ctx.state === 'running') this.ctx.suspend();
    }

    /**
     * Iconic 60Hz / 120Hz ballast hum of office fluorescent lights
     */
    startFluorescentHum() {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;

        // Base 60Hz hum + 120Hz harmonic
        const osc1 = this.ctx.createOscillator();
        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(60, now);

        const osc2 = this.ctx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(120, now);

        // Lowpass filter to simulate muffled ceiling ballast
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(180, now);
        filter.Q.setValueAtTime(4.0, now);

        // Random subtle crackle / flutter
        const humGain = this.ctx.createGain();
        humGain.gain.setValueAtTime(0.12, now);

        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(humGain);
        humGain.connect(this.masterGain);

        osc1.start();
        osc2.start();

        this.humGain = humGain;
        this.humFilter = filter;

        // Periodic light ballast buzz flutter
        setInterval(() => {
            if (!this.ctx || this.isMuted) return;
            const t = this.ctx.currentTime;
            const flicker = Math.random() < 0.15;
            if (flicker) {
                humGain.gain.cancelScheduledValues(t);
                humGain.gain.setValueAtTime(0.02, t);
                humGain.gain.linearRampToValueAtTime(0.22, t + 0.05);
                humGain.gain.linearRampToValueAtTime(0.12, t + 0.18);
            }
        }, 1200);
    }

    /**
     * Squelchy, damp carpet footstep sound
     */
    playFootstep(isSprinting = false) {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        if (now - this.lastStepTime < (isSprinting ? 0.28 : 0.45)) return;
        this.lastStepTime = now;

        // Damp thud: Filtered noise + low sine sweep
        const bufferSize = this.ctx.sampleRate * 0.12;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25));
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.setValueAtTime(320 + Math.random() * 80, now);
        noiseFilter.Q.setValueAtTime(1.8, now);

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(isSprinting ? 0.35 : 0.22, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.masterGain);

        // Sub thud
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(110 + Math.random() * 20, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.09);

        const oscGain = this.ctx.createGain();
        oscGain.gain.setValueAtTime(isSprinting ? 0.3 : 0.18, now);
        oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

        osc.connect(oscGain);
        oscGain.connect(this.masterGain);

        noise.start(now);
        osc.start(now);
        osc.stop(now + 0.15);
    }

    playJump() {
        if (!this.ctx || this.isMuted) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(185, now);
        osc.frequency.exponentialRampToValueAtTime(82, now + 0.16);
        gain.gain.setValueAtTime(0.11, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.19);
    }

    playGunshot(isAwm = false) {
        if (!this.ctx || this.isMuted) return;
        const now = this.ctx.currentTime;
        const scale = isAwm ? 1.35 : 1;
        const duration = isAwm ? 0.34 : 0.2;
        const length = Math.floor(this.ctx.sampleRate * duration);
        const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (length * 0.18));
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(isAwm ? 2500 : 3400, now);
        filter.frequency.exponentialRampToValueAtTime(450, now + duration);
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.9 * scale, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        noise.start(now);
        noise.stop(now + duration);

        const thump = this.ctx.createOscillator();
        const thumpGain = this.ctx.createGain();
        thump.type = 'sine';
        thump.frequency.setValueAtTime(isAwm ? 118 : 155, now);
        thump.frequency.exponentialRampToValueAtTime(38, now + (isAwm ? 0.42 : 0.27));
        thumpGain.gain.setValueAtTime(0.66 * scale, now);
        thumpGain.gain.exponentialRampToValueAtTime(0.001, now + (isAwm ? 0.45 : 0.3));
        thump.connect(thumpGain);
        thumpGain.connect(this.masterGain);
        thump.start(now);
        thump.stop(now + (isAwm ? 0.46 : 0.31));

        const action = this.ctx.createOscillator();
        const actionGain = this.ctx.createGain();
        const actionAt = now + (isAwm ? 0.38 : 0.085);
        action.type = 'square';
        action.frequency.setValueAtTime(isAwm ? 340 : 620, actionAt);
        action.frequency.exponentialRampToValueAtTime(120, actionAt + 0.075);
        actionGain.gain.setValueAtTime(isAwm ? 0.17 : 0.11, actionAt);
        actionGain.gain.exponentialRampToValueAtTime(0.001, actionAt + 0.085);
        action.connect(actionGain);
        actionGain.connect(this.masterGain);
        action.start(actionAt);
        action.stop(actionAt + 0.09);
    }

    loadM7Audio() {
        const assets = window.GAME_ASSETS || {};
        for (const variant of ['a', 'b', 'c']) {
            fetch(assets[`m7_shot_${variant}`] || `assets/audio/m7-shot-${variant}.wav`)
                .then(response => response.arrayBuffer())
                .then(data => this.ctx.decodeAudioData(data))
                .then(buffer => { this.m7ShotBuffers[variant] = buffer; })
                .catch(error => console.error(`M7 shot ${variant} could not be decoded`, error));
        }
        fetch(assets.m7_burst || 'assets/audio/m7-burst.wav')
            .then(response => response.arrayBuffer())
            .then(data => this.ctx.decodeAudioData(data))
            .then(buffer => { this.m7BurstBuffer = buffer; })
            .catch(error => console.error('M7 burst audio could not be decoded', error));
        fetch(assets.m7_reload || 'assets/audio/m7-reload.wav')
            .then(response => response.arrayBuffer())
            .then(data => this.ctx.decodeAudioData(data))
            .then(buffer => { this.m7ReloadBuffer = buffer; })
            .catch(error => console.error('M7 reload audio could not be decoded', error));
    }

    playM7Clip(buffer, volume, trackShot = false) {
        if (!this.ctx || this.isMuted || !buffer) return false;
        const source = this.ctx.createBufferSource();
        const gain = this.ctx.createGain();
        source.buffer = buffer;
        gain.gain.value = volume;
        source.connect(gain);
        gain.connect(this.masterGain);
        if (trackShot) {
            this.m7ActiveShots.add(source);
            source.onended = () => this.m7ActiveShots.delete(source);
        }
        source.start();
        return { source, gain };
    }

    setM7ShotVariant(variant) {
        if (!['a', 'b', 'c'].includes(variant)) return;
        this.m7ShotVariant = variant;
        try { localStorage.setItem('m7ShotVariant', variant); } catch (_) {}
    }

    playM7Preview(variant) {
        if (this.m7PreviewClip) this.m7PreviewClip.pause();
        const assets = window.GAME_ASSETS || {};
        const source = variant === 'burst'
            ? (assets.m7_burst || 'assets/audio/m7-burst.wav')
            : (assets[`m7_shot_${variant}`] || `assets/audio/m7-shot-${variant}.wav`);
        const clip = new Audio(source);
        clip.volume = 0.62;
        this.m7PreviewClip = clip;
        clip.play().catch(error => console.warn('M7 preview could not play', error));
    }

    playM7Shot() {
        if (this.isMuted) return;
        const now = this.ctx?.currentTime ?? 0;
        if (now - this.m7LastShotAt > 0.19) this.endM7Burst();
        this.m7LastShotAt = now;
        this.m7ShotCount++;
        if (this.m7ShotCount === 2 && this.m7BurstBuffer) {
            // Fade the tap sample before its next transient, then continue from
            // the matching point in the unmodified source recording.
            for (const voice of this.m7ActiveShots) {
                if (voice._m7Gain) {
                    voice._m7Gain.gain.setTargetAtTime(0, now, 0.006);
                    try { voice.stop(now + 0.025); } catch (_) {}
                }
            }
            const source = this.ctx.createBufferSource();
            const gain = this.ctx.createGain();
            source.buffer = this.m7BurstBuffer;
            gain.gain.setValueAtTime(0.78, now);
            source.connect(gain);
            gain.connect(this.masterGain);
            source.start(now, 0.09);
            this.m7Burst = { source, gain };
            source.onended = () => { if (this.m7Burst?.source === source) this.m7Burst = null; };
            return;
        }
        if (this.m7Burst) return;
        const buffer = this.m7ShotBuffers[this.m7ShotVariant];
        const voice = this.playM7Clip(buffer, 0.78, true);
        if (voice) {
            voice.source._m7Gain = voice.gain;
            return;
        }
        this.playM7Preview(this.m7ShotVariant);
    }

    endM7Burst(delay = 0) {
        this.m7ShotCount = 0;
        if (!this.ctx || !this.m7Burst) return;
        const { source, gain } = this.m7Burst;
        this.m7Burst = null;
        const now = this.ctx.currentTime + delay;
        gain.gain.setValueAtTime(gain.gain.value, now);
        gain.gain.setTargetAtTime(0, now, 0.025);
        try { source.stop(now + 0.12); } catch (_) {}
    }

    stopM7Gunfire() {
        if (this.m7Burst) {
            try { this.m7Burst.source.stop(); } catch (_) {}
            this.m7Burst = null;
        }
        this.m7ShotCount = 0;
        for (const source of this.m7ActiveShots) {
            try { source.stop(); } catch (_) {}
        }
        this.m7ActiveShots.clear();
        if (this.m7PreviewClip) this.m7PreviewClip.pause();
    }

    playM7Reload() {
        if (!this.playM7Clip(this.m7ReloadBuffer, 0.8) && !this.m7ReloadBuffer) this.playClick();
    }

    playHitConfirm(killed = false) {
        if (!this.ctx || this.isMuted) return;
        const now = this.ctx.currentTime;
        const tone = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        tone.type = 'triangle';
        tone.frequency.setValueAtTime(killed ? 520 : 760, now);
        tone.frequency.exponentialRampToValueAtTime(killed ? 180 : 410, now + 0.11);
        gain.gain.setValueAtTime(killed ? 0.19 : 0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
        tone.connect(gain);
        gain.connect(this.masterGain);
        tone.start(now);
        tone.stop(now + 0.14);
    }

    playSlide() {
        if (!this.ctx || this.isMuted) return;
        this.stopSlide();
        const now = this.ctx.currentTime;
        const length = Math.floor(this.ctx.sampleRate * 0.4);
        const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        let grain = 0;
        for (let i = 0; i < length; i++) {
            grain = grain * 0.82 + (Math.random() * 2 - 1) * 0.18;
            data[i] = grain * Math.sin(Math.PI * i / length);
        }
        const source = this.ctx.createBufferSource();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();
        source.buffer = buffer;
        source.loop = true;
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(640, now);
        filter.Q.value = 0.55;
        gain.gain.setValueAtTime(0, now);
        gain.gain.setTargetAtTime(0.34, now, 0.025);
        source.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        source.start(now);
        this.slideVoice = { source, filter, gain };
        const impact = this.ctx.createOscillator();
        const impactGain = this.ctx.createGain();
        impact.type = 'sine';
        impact.frequency.setValueAtTime(95, now);
        impact.frequency.exponentialRampToValueAtTime(48, now + 0.09);
        impactGain.gain.setValueAtTime(0.23, now);
        impactGain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
        impact.connect(impactGain);
        impactGain.connect(this.masterGain);
        impact.start(now);
        impact.stop(now + 0.12);
        source.onended = () => {
            source.disconnect();
            filter.disconnect();
            gain.disconnect();
        };
    }

    updateSlide(speed) {
        if (!this.slideVoice || !this.ctx) return;
        const now = this.ctx.currentTime;
        const intensity = Math.max(0, Math.min(1, (speed - 3.4) / 7.9));
        this.slideVoice.filter.frequency.setTargetAtTime(380 + intensity * 500, now, 0.05);
        this.slideVoice.gain.gain.setTargetAtTime(0.11 + intensity * 0.27, now, 0.05);
    }

    stopSlide() {
        if (!this.slideVoice || !this.ctx) return;
        const { source, gain } = this.slideVoice;
        this.slideVoice = null;
        const now = this.ctx.currentTime;
        gain.gain.setTargetAtTime(0, now, 0.018);
        try { source.stop(now + 0.09); } catch (_) {}
    }

    /** Decode once; each nearby Smiler gets its own spatial loop and panner. */
    loadEntityBark() {
        if (!this.ctx || this.barkLoadPromise) return;
        const source = (window.GAME_ASSETS || {}).smiler_bark || 'assets/audio/smiler-bark.m4a';
        this.barkLoadPromise = fetch(source)
            .then(response => {
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return response.arrayBuffer();
            })
            .then(data => this.ctx.decodeAudioData(data))
            .then(buffer => { this.barkBuffer = buffer; })
            .catch(error => {
                this.barkLoadPromise = null;
                console.error('Smiler bark could not be decoded', error);
            });
    }

    loadDeathCalls() {
        if (this.deathCallClips) return;
        this.deathCallClips = ['death-hungry-1.wav', 'death-hungry-2.wav'].map(file => {
            const clip = new Audio(`assets/audio/${file}`);
            clip.preload = 'auto';
            clip.load();
            return clip;
        });
    }

    setBarkVolume(percent) {
        this.barkVolume = Math.max(0, Math.min(2, Number(percent) / 100));
        try { localStorage.setItem('smilerBarkVolume', String(Math.round(this.barkVolume * 100))); } catch (_) {}
    }

    updateEntityBarks(entities, camera) {
        if (!this.ctx) return;
        if (!this.barkBuffer || this.isMuted) {
            this.stopEntityBarks();
            return;
        }
        const listener = this.ctx.listener;
        const pos = camera.position;
        const forward = camera.getWorldDirection(new THREE.Vector3());
        const now = this.ctx.currentTime;

        if (listener.positionX) {
            listener.positionX.setTargetAtTime(pos.x, now, 0.04);
            listener.positionY.setTargetAtTime(pos.y, now, 0.04);
            listener.positionZ.setTargetAtTime(pos.z, now, 0.04);
            listener.forwardX.setTargetAtTime(forward.x, now, 0.04);
            listener.forwardY.setTargetAtTime(forward.y, now, 0.04);
            listener.forwardZ.setTargetAtTime(forward.z, now, 0.04);
        } else {
            listener.setPosition(pos.x, pos.y, pos.z);
            listener.setOrientation(forward.x, forward.y, forward.z, 0, 1, 0);
        }

        const maxDistance = 16;
        const audible = entities
            .filter(entity => !entity.isDead)
            .map(entity => ({ entity, distance: entity.position.distanceTo(pos) }))
            .filter(item => item.distance < maxDistance)
            .sort((a, b) => a.distance - b.distance);
        const active = new Set(audible.map(item => item.entity));

        for (const [entity, voice] of this.smilerBarks) {
            if (active.has(entity)) continue;
            voice.gain.gain.setTargetAtTime(0, now, 0.12);
            voice.source.stop(now + 0.45);
            voice.source.onended = () => {
                voice.source.disconnect();
                voice.panner.disconnect();
                voice.gain.disconnect();
            };
            this.smilerBarks.delete(entity);
        }

        for (const { entity, distance } of audible) {
            let voice = this.smilerBarks.get(entity);
            if (!voice) {
                const source = this.ctx.createBufferSource();
                source.buffer = this.barkBuffer;
                source.loop = true;
                const panner = this.ctx.createPanner();
                panner.panningModel = 'HRTF';
                panner.distanceModel = 'inverse';
                panner.refDistance = 2.5;
                panner.maxDistance = maxDistance;
                panner.rolloffFactor = 1.35;
                const gain = this.ctx.createGain();
                gain.gain.value = 0;
                source.connect(panner);
                panner.connect(gain);
                gain.connect(this.masterGain);
                source.start();
                voice = { source, panner, gain };
                this.smilerBarks.set(entity, voice);
            }

            const entityPos = entity.position;
            if (voice.panner.positionX) {
                voice.panner.positionX.setTargetAtTime(entityPos.x, now, 0.04);
                voice.panner.positionY.setTargetAtTime(entityPos.y, now, 0.04);
                voice.panner.positionZ.setTargetAtTime(entityPos.z, now, 0.04);
            } else {
                voice.panner.setPosition(entityPos.x, entityPos.y, entityPos.z);
            }
            // Keep the loop quiet at the edge, then bring it forward smoothly nearby.
            const proximity = Math.max(0, 1 - distance / maxDistance);
            voice.gain.gain.setTargetAtTime((0.18 + proximity * 0.72) * this.barkVolume, now, 0.12);
        }
    }

    stopEntityBarks() {
        if (!this.ctx) return;
        const stopAt = this.ctx.currentTime + 0.45;
        for (const voice of this.smilerBarks.values()) {
            voice.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.12);
            voice.source.stop(stopAt);
            voice.source.onended = () => {
                voice.source.disconnect();
                voice.panner.disconnect();
                voice.gain.disconnect();
            };
        }
        this.smilerBarks.clear();
    }

    /**
     * Heartbeat pulse for low sanity / adrenaline
     */
    playHeartbeat(rate = 1.0) {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;

        const playLub = (offset, vol, freq) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + offset);
            osc.frequency.exponentialRampToValueAtTime(30, now + offset + 0.12);

            gain.gain.setValueAtTime(vol, now + offset);
            gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.14);

            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start(now + offset);
            osc.stop(now + offset + 0.15);
        };

        playLub(0, 0.4, 75);
        playLub(0.18, 0.28, 65);
    }

    /**
     * Item pickup sound (Almond Water / Keycard / Battery)
     */
    playPickup() {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.setValueAtTime(659, now + 0.08);
        osc.frequency.setValueAtTime(880, now + 0.16);

        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.5);
    }

    /**
     * Drink almond water gulp / restoration sound
     */
    playDrink() {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;

        for (let i = 0; i < 3; i++) {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            const t = now + i * 0.14;
            osc.frequency.setValueAtTime(260 + i * 40, t);
            osc.frequency.exponentialRampToValueAtTime(450, t + 0.09);

            gain.gain.setValueAtTime(0.3, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start(t);
            osc.stop(t + 0.14);
        }
    }

    /**
     * Flashlight click sound
     */
    playClick() {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(1400, now);
        osc.frequency.exponentialRampToValueAtTime(200, now + 0.03);

        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.04);
    }

    /**
     * Terrifying jumpscare sting
     */
    playJumpscare() {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;

        // Dissonant saw wave scream
        const freqs = [180, 225, 310, 480, 620];
        freqs.forEach(f => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(f, now);
            osc.frequency.linearRampToValueAtTime(f * 1.5, now + 0.4);

            gain.gain.setValueAtTime(0.35, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start(now);
            osc.stop(now + 1.3);
        });

        // Noise blast
        const bufferSize = this.ctx.sampleRate * 0.8;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.4));
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const nGain = this.ctx.createGain();
        nGain.gain.setValueAtTime(0.5, now);
        nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
        noise.connect(nGain);
        nGain.connect(this.masterGain);
        noise.start(now);
    }

    playDeathCall(variantOverride = null, distance = null) {
        let variant = 0;
        if (variantOverride === 0 || variantOverride === 1) {
            variant = variantOverride;
        } else {
            try {
                const saved = Number(localStorage.getItem('deathCallVariant') || 0);
                variant = Number.isFinite(saved) ? Math.abs(Math.floor(saved)) % 2 : 0;
                localStorage.setItem('deathCallVariant', String((variant + 1) % 2));
            } catch (_) {
                variant = Math.floor(Math.random() * 2);
            }
        }
        this.loadDeathCalls();
        // Smiler calls fade out over the same short range as their normal barks.
        // Player death and the preview buttons omit distance and remain full volume.
        const volume = distance === null ? 1
            : Math.pow(Math.max(0, Math.min(1, (16 - Math.max(0, distance)) / 14)), 2);
        if (volume <= 0) return;
        const clip = this.deathCallClips[variant].cloneNode();
        clip.volume = volume;
        clip.play().catch(error => console.warn('Death call playback failed', error));
    }
}

window.BackroomsAudio = BackroomsAudio;
