export function haptic(pattern: 'light' | 'medium' | 'heavy' | 'success' = 'light') {
  if (!('vibrate' in navigator)) return;
  const ms: Record<typeof pattern, number | number[]> = { light: 10, medium: 25, heavy: 50, success: [15, 60, 30, 60, 45] };
  navigator.vibrate(ms[pattern]);
}
