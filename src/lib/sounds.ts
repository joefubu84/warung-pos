// Singleton Web Audio Context to avoid browser 6-context limits and handle autoplay policies
let sharedAudioContext: AudioContext | null = null;

export const getSharedAudioContext = (): AudioContext | null => {
  if (typeof window === 'undefined') return null;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return null;
    
    if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
      sharedAudioContext = new AudioContextClass();
    }
    return sharedAudioContext;
  } catch (e) {
    console.warn("Could not create Web Audio Context:", e);
    return null;
  }
};

// Function to unlock audio context on user gesture (click, tap, keypress)
export const unlockAudio = async (): Promise<boolean> => {
  const ctx = getSharedAudioContext();
  if (!ctx) return false;

  try {
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    
    // Play a silent 0.001s buffer to ensure audio pipeline is fully active
    const silentBuffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = silentBuffer;
    source.connect(ctx.destination);
    source.start(0);

    return ctx.state === 'running';
  } catch (err) {
    console.warn("Audio unlock attempt warning:", err);
    return false;
  }
};

// Main function to play kitchen notification sounds
export const playKitchenSound = async (choice: string, customUrl?: string | null): Promise<void> => {
  // 1. Custom URL via HTML Audio Element
  if (choice === 'custom' && customUrl) {
    try {
      const audio = new Audio(customUrl);
      audio.volume = 1.0;
      await audio.play();
      return;
    } catch (e) {
      console.warn("Error playing custom sound, falling back to Web Audio bell:", e);
    }
  }

  // 2. Predefined synthesized sounds via Web Audio API
  try {
    const ctx = getSharedAudioContext();
    if (!ctx) return;

    // Ensure context is running if suspended
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch (e) {
        console.warn("AudioContext resume failed:", e);
      }
    }

    switch (choice) {
      case 'beep_alert':
        playBeepAlert(ctx);
        break;
      case 'ding_dong':
        playDingDong(ctx);
        break;
      case 'whistle':
        playWhistle(ctx);
        break;
      case 'buzzer':
        playBuzzer(ctx);
        break;
      case 'kitchen_bell':
      default:
        playKitchenBell(ctx);
        break;
    }
  } catch (error) {
    console.error("Web Audio playback error:", error);
  }
};

// 1. Kitchen Bell: Classic high-clarity restaurant counter bell (double chime Ding-Ding! 🛎️)
const playKitchenBell = (ctx: AudioContext) => {
  const now = ctx.currentTime;
  
  // First chime (A5 - 880 Hz + harmonic)
  playBellChime(ctx, now, 880, 0.85);
  
  // Second chime (C6 - 1046.5 Hz + harmonic) 0.22s later for attention
  playBellChime(ctx, now + 0.22, 1046.5, 1.0);
};

const playBellChime = (ctx: AudioContext, startTime: number, freq: number, volume: number) => {
  const oscFundamental = ctx.createOscillator();
  const oscHarmonic = ctx.createOscillator();
  const gainNode = ctx.createGain();

  // Fundamental frequency
  oscFundamental.type = 'sine';
  oscFundamental.frequency.setValueAtTime(freq, startTime);
  oscFundamental.frequency.exponentialRampToValueAtTime(freq * 0.95, startTime + 0.8);

  // Harmonic overtone for metallic brass resonance
  oscHarmonic.type = 'sine';
  oscHarmonic.frequency.setValueAtTime(freq * 2.05, startTime);
  oscHarmonic.frequency.exponentialRampToValueAtTime(freq * 1.95, startTime + 0.5);

  // Envelope
  gainNode.gain.setValueAtTime(0, startTime);
  gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.015);
  gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + 0.9);

  oscFundamental.connect(gainNode);
  oscHarmonic.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscFundamental.start(startTime);
  oscHarmonic.start(startTime);
  oscFundamental.stop(startTime + 0.95);
  oscHarmonic.stop(startTime + 0.95);
};

// 2. Beep Alert: Electronic 3-tone rapid alert
const playBeepAlert = (ctx: AudioContext) => {
  const now = ctx.currentTime;
  for (let i = 0; i < 3; i++) {
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    const start = now + i * 0.18;
    
    osc.type = 'square';
    osc.frequency.setValueAtTime(950, start);
    
    gainNode.gain.setValueAtTime(0, start);
    gainNode.gain.linearRampToValueAtTime(0.4, start + 0.02);
    gainNode.gain.linearRampToValueAtTime(0, start + 0.12);
    
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    osc.start(start);
    osc.stop(start + 0.14);
  }
};

// 3. Ding Dong: Cheerful two-tone announcement
const playDingDong = (ctx: AudioContext) => {
  const now = ctx.currentTime;
  
  // Ding (E5 - 659.25 Hz)
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(659.25, now);
  gain1.gain.setValueAtTime(0, now);
  gain1.gain.linearRampToValueAtTime(0.8, now + 0.02);
  gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
  osc1.connect(gain1);
  gain1.connect(ctx.destination);
  osc1.start(now);
  osc1.stop(now + 0.65);

  // Dong (C5 - 523.25 Hz)
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(523.25, now + 0.28);
  gain2.gain.setValueAtTime(0, now + 0.28);
  gain2.gain.linearRampToValueAtTime(0.9, now + 0.30);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
  osc2.connect(gain2);
  gain2.connect(ctx.destination);
  osc2.start(now + 0.28);
  osc2.stop(now + 1.25);
};

// 4. Whistle: Attention-grabbing swoop
const playWhistle = (ctx: AudioContext) => {
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  
  osc.type = 'sine';
  osc.frequency.setValueAtTime(1000, now);
  osc.frequency.exponentialRampToValueAtTime(2000, now + 0.25);
  osc.frequency.exponentialRampToValueAtTime(1500, now + 0.55);
  
  gainNode.gain.setValueAtTime(0, now);
  gainNode.gain.linearRampToValueAtTime(0.7, now + 0.08);
  gainNode.gain.linearRampToValueAtTime(0, now + 0.55);
  
  osc.connect(gainNode);
  gainNode.connect(ctx.destination);
  
  osc.start(now);
  osc.stop(now + 0.6);
};

// 5. Buzzer: Urgent notification buzz
const playBuzzer = (ctx: AudioContext) => {
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(160, now);
  
  gainNode.gain.setValueAtTime(0, now);
  gainNode.gain.linearRampToValueAtTime(0.6, now + 0.05);
  gainNode.gain.linearRampToValueAtTime(0, now + 0.75);
  
  osc.connect(gainNode);
  gainNode.connect(ctx.destination);
  
  osc.start(now);
  osc.stop(now + 0.8);
};
