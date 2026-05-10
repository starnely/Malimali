export const playBeep = () => {
  const audio = new Audio('/beep.mp3')
  audio.play().catch(() => {})
}