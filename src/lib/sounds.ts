// Function to play sounds using Web Audio API or custom URL
export const playKitchenSound = (choice: string, customUrl?: string | null) => {
  // If custom sound is selected and URL exists, use HTML Audio
  if (choice === 'custom' && customUrl) {
    const audio = new Audio(customUrl);
    audio.play().catch(e => console.error("Error playing custom sound:", e));
    return;
  }

  // Predefined sounds using Web Audio API
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    switch (choice) {
      case 'beep_alert':
        playBeepAlert(audioCtx);
        break;
      case 'ding_dong':
        playDingDong(audioCtx);
        break;
      case 'whistle':
        playWhistle(audioCtx);
        break;
      case 'buzzer':
        playBuzzer(audioCtx);
        break;
      case 'kitchen_bell':
      default:
        playKitchenBell(audioCtx);
        break;
    }
  } catch (error) {
    console.error("Web Audio API error:", error);
  }
};

// 1. Kitchen Bell (traditional ding)
const playKitchenBell = (ctx: AudioContext) => {
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  
  osc.type = 'sine';
  osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
  osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 1); // Drop to A4
  
  gainNode.gain.setValueAtTime(1, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.5);
  
  osc.connect(gainNode);
  gainNode.connect(ctx.destination);
  
  osc.start();
  osc.stop(ctx.currentTime + 1.5);
};

// 2. Beep Alert (electronic repeating beep)
const playBeepAlert = (ctx: AudioContext) => {
  for (let i = 0; i < 3; i++) {
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    osc.type = 'square';
    osc.frequency.setValueAtTime(1000, ctx.currentTime + i * 0.2);
    
    gainNode.gain.setValueAtTime(0, ctx.currentTime + i * 0.2);
    gainNode.gain.linearRampToValueAtTime(0.5, ctx.currentTime + i * 0.2 + 0.05);
    gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + i * 0.2 + 0.15);
    
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    osc.start(ctx.currentTime + i * 0.2);
    osc.stop(ctx.currentTime + i * 0.2 + 0.15);
  }
};

// 3. Ding Dong (cheerful two-tone)
const playDingDong = (ctx: AudioContext) => {
  // Ding
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = 'sine';
  osc1.frequency.value = 659.25; // E5
  gain1.gain.setValueAtTime(1, ctx.currentTime);
  gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
  osc1.connect(gain1);
  gain1.connect(ctx.destination);
  osc1.start(ctx.currentTime);
  osc1.stop(ctx.currentTime + 0.5);

  // Dong
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = 'sine';
  osc2.frequency.value = 523.25; // C5
  gain2.gain.setValueAtTime(1, ctx.currentTime + 0.3);
  gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.3);
  osc2.connect(gain2);
  gain2.connect(ctx.destination);
  osc2.start(ctx.currentTime + 0.3);
  osc2.stop(ctx.currentTime + 1.3);
};

// 4. Whistle (attention grabbing swoop)
const playWhistle = (ctx: AudioContext) => {
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  
  osc.type = 'sine';
  osc.frequency.setValueAtTime(1000, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(2000, ctx.currentTime + 0.3);
  osc.frequency.exponentialRampToValueAtTime(1500, ctx.currentTime + 0.6);
  
  gainNode.gain.setValueAtTime(0, ctx.currentTime);
  gainNode.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.1);
  gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6);
  
  osc.connect(gainNode);
  gainNode.connect(ctx.destination);
  
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.6);
};

// 5. Buzzer (urgent harsh sound)
const playBuzzer = (ctx: AudioContext) => {
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(150, ctx.currentTime);
  
  gainNode.gain.setValueAtTime(0, ctx.currentTime);
  gainNode.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.1);
  gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.8);
  
  osc.connect(gainNode);
  gainNode.connect(ctx.destination);
  
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.8);
};
