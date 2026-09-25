export function getAuthErrorMessage(error: { message: string; code?: string }): string {
  const message = error.message.toLowerCase();
  const code = error.code?.toLowerCase();

  if (code === 'invalid_credentials' || message.includes('invalid login credentials')) {
    return 'El email o la contraseña no son correctos.';
  }
  if (message.includes('already registered') || message.includes('already exists') || message.includes('user already')) {
    return 'Ya existe una cuenta registrada con ese email.';
  }
  if (message.includes('username') && (message.includes('duplicate') || message.includes('unique') || message.includes('already'))) {
    return 'Ese username ya está ocupado. Prueba con otro.';
  }
  if (message.includes('email') && (message.includes('invalid') || message.includes('valid'))) {
    return 'Escribe un email válido.';
  }
  if (message.includes('password') && (message.includes('weak') || message.includes('short') || message.includes('length'))) {
    return 'La contraseña no cumple los requisitos. Usa al menos 6 caracteres.';
  }
  if (message.includes('network') || message.includes('fetch')) {
    return 'No pudimos conectarnos. Revisa tu conexión e inténtalo de nuevo.';
  }
  return 'No pudimos completar la solicitud. Inténtalo de nuevo.';
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
