/** Horários "HH:MM" separados por vírgula, validados, com zero à esquerda e em ordem. */
export function parseHorarios(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map(h => h.trim())
    .filter(h => /^\d{1,2}:\d{2}$/.test(h))
    .map(h => h.padStart(5, '0'))
    .sort()
}

/** Quebra uma diferença em ms em dias/horas/minutos/segundos (negativo vira zero). */
export function diffPartes(ms: number) {
  const totalSeg = Math.max(0, Math.floor(ms / 1000))
  return {
    dias: Math.floor(totalSeg / 86400),
    horas: Math.floor((totalSeg % 86400) / 3600),
    minutos: Math.floor((totalSeg % 3600) / 60),
    segundos: totalSeg % 60,
  }
}
