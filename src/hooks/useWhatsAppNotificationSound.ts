import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

const STORAGE_KEY = 'whatsapp-sound-muted';
const PRIMED_KEY = 'whatsapp-sound-primed';

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (audioContext) return audioContext;
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioContext = new Ctx();
    return audioContext;
  } catch {
    return null;
  }
}

/**
 * Plays a soft two-tone "ding" using Web Audio API — no asset file required.
 * Browsers block audio until the user interacts at least once with the page,
 * so we resume the context inside a user gesture (see primeAudio below).
 */
function playDing(volume = 0.35) {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});

  const now = ctx.currentTime;
  const tones = [
    { freq: 880, start: 0, dur: 0.18 },
    { freq: 1320, start: 0.12, dur: 0.22 },
  ];

  for (const t of tones) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = t.freq;
    gain.gain.setValueAtTime(0, now + t.start);
    gain.gain.linearRampToValueAtTime(volume, now + t.start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + t.start + t.dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now + t.start);
    osc.stop(now + t.start + t.dur + 0.02);
  }
}

export function isWhatsAppSoundMuted(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(STORAGE_KEY) === '1';
}

export function setWhatsAppSoundMuted(muted: boolean) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, muted ? '1' : '0');
}

/** Resume audio context inside a user gesture so future programmatic plays work. */
export function primeWhatsAppSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  if (typeof window !== 'undefined') localStorage.setItem(PRIMED_KEY, '1');
}

/**
 * Globally subscribes to inbound WhatsApp messages and plays a notification
 * sound. Mount this hook ONCE near the app root (or in the inbox page).
 */
export function useWhatsAppNotificationSound() {
  const lastPlayedAt = useRef<number>(0);
  const startTime = useRef<number>(Date.now());

  useEffect(() => {
    const channel = supabase
      .channel('whatsapp-sound-rt')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'whatsapp_messages' },
        (payload) => {
          const msg = payload.new as { direction?: string; created_at?: string };
          if (msg.direction !== 'inbound') return;

          // Ignore historical rows that may stream on initial subscription
          if (msg.created_at && new Date(msg.created_at).getTime() < startTime.current - 5000) return;

          if (isWhatsAppSoundMuted()) return;

          // Throttle: at most one sound per 1.5s to avoid bursts
          const now = Date.now();
          if (now - lastPlayedAt.current < 1500) return;
          lastPlayedAt.current = now;

          playDing();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
}
