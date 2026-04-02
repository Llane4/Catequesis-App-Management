import { supabase } from '../lib/supabase'
import type { AuthUser } from '../context/AuthContext'

export async function signIn(
  email: string,
  password: string,
): Promise<AuthUser> {
  const trimmed = email.trim()
  if (!trimmed || !password) {
    throw new Error('Correo y contraseña son obligatorios.')
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: trimmed,
    password,
  })

  if (error) {
    throw new Error(
      error.message === 'Invalid login credentials'
        ? 'Correo o contraseña incorrectos.'
        : error.message,
    )
  }

  const sessionEmail = data.user?.email?.trim()
  if (!sessionEmail) {
    throw new Error('No se pudo obtener el correo de la sesión.')
  }

  return { email: sessionEmail }
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut()
  if (error) {
    throw new Error(error.message)
  }
}
