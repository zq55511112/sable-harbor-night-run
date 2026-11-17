// Tiny synthesized sound: no audio files, everything is oscillators and filtered
// noise through one master gain. The context is created lazily on the first user
// gesture (browser autoplay rules), and every call is a no-op until then.

export function createAudio() {
  let ctx = null;
  let master = null;
  let sirenNodes = null;
  let engineNodes = null;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);
    return true;
  }

  function tone(freq, dur, type = 'square', vol = 0.5, slideTo = null, delay = 0) {
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain).connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol = 0.5, freq = 1200, delay = 0) {
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter).connect(gain).connect(master);
    src.start(t0);
  }

  return {
    unlock() {
      ensure();
    },
    shot() {
      noise(0.14, 0.7, 2600);
      tone(160, 0.1, 'square', 0.3, 60);
    },
    punch() {
      noise(0.08, 0.4, 700);
    },
    hurt() {
      tone(220, 0.12, 'sawtooth', 0.3, 110);
    },
    pickup() {
      tone(660, 0.08, 'square', 0.3);
      tone(990, 0.12, 'square', 0.3, null, 0.07);
    },
    cash() {
      tone(880, 0.07, 'triangle', 0.4);
      tone(1320, 0.1, 'triangle', 0.4, null, 0.06);
    },
    door() {
      noise(0.1, 0.3, 500);
      tone(140, 0.1, 'triangle', 0.3, 90);
    },
    crash(strength = 1) {
      noise(0.25, 0.5 * strength, 900);
      tone(90, 0.2, 'sawtooth', 0.3 * strength, 45);
    },
    missionDone() {
      tone(523, 0.12, 'square', 0.3);
      tone(659, 0.12, 'square', 0.3, null, 0.1);
      tone(784, 0.22, 'square', 0.35, null, 0.2);
    },
    busted() {
      tone(392, 0.2, 'square', 0.3);
      tone(311, 0.2, 'square', 0.3, null, 0.18);
      tone(233, 0.4, 'square', 0.3, null, 0.36);
    },
    ui() {
      tone(440, 0.05, 'square', 0.2);
    },
    /** Looping police siren while wanted > 0 and police are near; level 0..1. */
    siren(level) {
      if (!ctx) return;
      if (level > 0 && !sirenNodes) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = 800;
        lfo.frequency.value = 0.7;
        lfoGain.gain.value = 180;
        lfo.connect(lfoGain).connect(osc.frequency);
        gain.gain.value = 0;
        osc.connect(gain).connect(master);
        osc.start();
        lfo.start();
        sirenNodes = { osc, gain, lfo };
      }
      if (sirenNodes) {
        sirenNodes.gain.gain.setTargetAtTime(0.06 * level, ctx.currentTime, 0.2);
        if (level <= 0) {
          const nodes = sirenNodes;
          sirenNodes = null;
          setTimeout(() => {
            try { nodes.osc.stop(); nodes.lfo.stop(); } catch { /* already stopped */ }
          }, 600);
        }
      }
    },
    /** Looping engine tone while driving; speed 0..1. */
    engine(speed) {
      if (!ctx) return;
      if (speed !== null && !engineNodes) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.value = 55;
        gain.gain.value = 0;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 320;
        osc.connect(filter).connect(gain).connect(master);
        osc.start();
        engineNodes = { osc, gain };
      }
      if (engineNodes) {
        if (speed === null) {
          const nodes = engineNodes;
          engineNodes = null;
          nodes.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
          setTimeout(() => {
            try { nodes.osc.stop(); } catch { /* already stopped */ }
          }, 400);
        } else {
          engineNodes.osc.frequency.setTargetAtTime(50 + speed * 130, ctx.currentTime, 0.08);
          engineNodes.gain.gain.setTargetAtTime(0.05 + speed * 0.05, ctx.currentTime, 0.1);
        }
      }
    },
  };
}
