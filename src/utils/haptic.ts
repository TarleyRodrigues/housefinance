export function haptic(pattern: 'light' | 'medium' | 'heavy' = 'light') {
  if (!('vibrate' in navigator)) return;
  const ms = { light: 10, medium: 25, heavy: 50 };
  navigator.vibrate(ms[pattern]);
}
