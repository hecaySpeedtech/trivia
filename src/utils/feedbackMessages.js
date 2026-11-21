export function feedbackFor(score, total) {
  const pct = total ? Math.round((score / total) * 100) : 0;
  if (pct === 100) return "¡Excelente! Respondiste todo correctamente. ¡Sos un genio!";
  if (pct >= 80) return "¡Muy bien! Casi perfecto. Seguí así.";
  if (pct >= 60) return "¡Buen trabajo! Con un poco más de práctica lo vas a lograr.";
  if (pct >= 40) return "No te rindas, cada intento te hace más fuerte.";
  return "¡Ánimo! Lo importante es intentarlo. Vamos de nuevo.";
}