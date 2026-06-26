import confetti from 'canvas-confetti';

export function fireRedeemConfetti() {
  // Check reduced motion preference
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const duration = 1200;
  const end = Date.now() + duration;

  const frame = () => {
    confetti({
      particleCount: 3,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.7 },
      colors: ['#0B66C3', '#FFC857', '#28A745'],
    });
    confetti({
      particleCount: 3,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.7 },
      colors: ['#0B66C3', '#FFC857', '#28A745'],
    });

    if (Date.now() < end) requestAnimationFrame(frame);
  };
  frame();
}

export function fireBadgeConfetti() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  confetti({
    particleCount: 50,
    spread: 60,
    origin: { y: 0.6 },
    colors: ['#FFC857', '#0B66C3'],
    decay: 0.9,
  });
}
