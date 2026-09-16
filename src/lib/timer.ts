export const PER_LINE_SECONDS = [6, 5, 4, 3.5, 3, 3] as const
export function timerLimit(lineCount: number, level: number): number {
  if (!Number.isInteger(lineCount) || lineCount < 1) throw new Error('Nieprawidłowa liczba odzywek')
  if (!Number.isInteger(level) || level < 0 || level > 5) throw new Error('Nieprawidłowy poziom nauki')
  return Math.max(15, Math.ceil(PER_LINE_SECONDS[level] * lineCount))
}
export const timerIsAmber = (remaining: number) => remaining > 0 && remaining <= 10
