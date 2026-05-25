export function sanitizeUsuario<T extends { senhaHash?: string | null }>(
  usuario: T,
): Omit<T, "senhaHash"> {
  const safeUsuario = { ...usuario };
  delete safeUsuario.senhaHash;

  return safeUsuario as Omit<T, "senhaHash">;
}
