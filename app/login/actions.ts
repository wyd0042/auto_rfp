'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

// Create a server client that properly handles cookies for PKCE flow
async function createServerActionClient() {
  const cookieStore = await cookies()
  
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    }
  )
}

export async function signInWithMagicLink(formData: FormData) {
  const supabase = await createServerActionClient()

  // Get email from form data
  const email = formData.get('email') as string
  
  // Validate email
  if (!email || !email.includes('@')) {
    redirect('/error')
  }

  // Get the origin for creating the full redirect URL
  const origin = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
    },
  })

  if (error) {
    console.error('Magic link error:', error)
    redirect('/error')
  }

  redirect('/login/confirmation')
}

// Keep this for backward compatibility if needed, but it won't be used in the new flow
export async function login(formData: FormData) {
  redirect('/login/confirmation')
}

// Keep this for backward compatibility if needed, but it won't be used in the new flow
export async function signup(formData: FormData) {
  redirect('/login/confirmation')
}

export async function logout() {
  const supabase = await createServerActionClient()
  await supabase.auth.signOut()
  
  revalidatePath('/', 'layout')
  redirect('/login')
}