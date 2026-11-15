import { type EmailOtpType } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const requestedNext = searchParams.get('next') ?? '/'
  const safeNext = requestedNext.startsWith('/') && !requestedNext.startsWith('//') ? requestedNext : '/'
  const destination = new URL(safeNext, request.url)
  const supabase = await createClient()

  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
      : { error: new Error('Missing confirmation token') }

  if (!error) {
    const response = NextResponse.redirect(destination)
    response.headers.set('Cache-Control', 'private, no-store')
    return response
  }

  const errorDestination = new URL('/', request.url)
  errorDestination.searchParams.set('auth-error', 'confirmation')
  const response = NextResponse.redirect(errorDestination)
  response.headers.set('Cache-Control', 'private, no-store')
  return response
}
