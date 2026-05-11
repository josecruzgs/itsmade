/**
 * Normaliza un numero de WhatsApp mexicano al formato canonico que usa
 * Evolution API: `521` + 10 digitos (13 digitos en total).
 *
 * Esto garantiza que un cliente que ingresa por el panel con "6861234567" y
 * el mismo cliente que entra por webhook como "5216861234567" terminen como
 * el mismo registro en la tabla customers.
 *
 * Casos aceptados:
 *   - "5216861234567"          -> "5216861234567"  (ya canonico)
 *   - "526861234567"           -> "5216861234567"  (sin el "1" de movil MX)
 *   - "6861234567"             -> "5216861234567"  (sin lada de pais)
 *   - "+52 1 686 123 4567"     -> "5216861234567"  (con espacios y +)
 *   - "(686) 123-4567"         -> "5216861234567"
 *
 * Devuelve null si la entrada no se puede normalizar a un movil MX de 10
 * digitos. Casos rechazados:
 *   - "", null o undefined
 *   - menos de 10 digitos despues de quitar simbolos
 *   - formato extranjero no MX (ej: 1xxxxxxxxxx)
 */
export function normalizeMxWhatsApp(
  input: string | null | undefined,
): string | null {
  if (!input) return null;
  const digits = input.replace(/\D/g, "");
  if (!digits) return null;

  // Caso 1: ya canonico (521 + 10 = 13 digitos)
  if (digits.length === 13 && digits.startsWith("521")) return digits;

  // Caso 2: 52 + 10 digitos (le falta el "1" de movil MX)
  if (digits.length === 12 && digits.startsWith("52")) {
    return "521" + digits.slice(2);
  }

  // Caso 3: solo 10 digitos (lada local, sin pais)
  if (digits.length === 10) return "521" + digits;

  return null;
}
