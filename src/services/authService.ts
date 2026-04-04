import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { AuthUser } from '../context/AuthContext'

export async function authUserFromSession(
  session: Session | null,
): Promise<AuthUser | null> {
  const email = session?.user?.email?.trim()
  const userId = session?.user?.id
  if (!email || !userId) return null

  const { data, error } = await supabase
    .from('profesores')
    .select('es_admin')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    return { email, userId, esAdmin: false }
  }

  return {
    email,
    userId,
    esAdmin: data?.es_admin === true,
  }
}

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

  const next = await authUserFromSession(data.session)
  if (!next) {
    throw new Error('No se pudo obtener el correo de la sesión.')
  }

  return next
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut()
  if (error) {
    throw new Error(error.message)
  }
}
