'use client'

import { useEffect, useState } from 'react'
import type { AuthChangeEvent } from '@supabase/supabase-js'
import { Badge, Button, Card, Checkbox, Field, Icon, Meter, Stage } from '@/shared/stageshow/kit'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import './AuthScreen.css'

export type AuthMode = 'signin' | 'signup' | 'forgot' | 'reset'

function authErrorMessage(message: string) {
  const normalized = message.toLowerCase()
  if (normalized.includes('invalid login credentials')) return 'Неверный email или пароль'
  if (normalized.includes('email not confirmed')) return 'Сначала подтвердите email по ссылке из письма'
  if (normalized.includes('already registered')) return 'Аккаунт с таким email уже существует'
  if (normalized.includes('password') && normalized.includes('least')) return 'Пароль должен содержать не менее 6 символов'
  if (normalized.includes('rate limit')) return 'Слишком много попыток. Попробуйте немного позже'
  return message
}

export function AuthScreen({ onAuthenticated, initialMode = 'signin' }: { onAuthenticated: () => void; initialMode?: AuthMode }) {
  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [agreement, setAgreement] = useState(true)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    const supabase = createClient()
    if (!supabase) return
    const searchParams = new URLSearchParams(window.location.search)
    if (searchParams.has('recovery')) setMode('reset')
    if (searchParams.get('auth-error') === 'confirmation') setError('Ссылка недействительна или уже была использована')
    const { data } = supabase.auth.onAuthStateChange((event: AuthChangeEvent) => {
      if (event === 'PASSWORD_RECOVERY') setMode('reset')
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode)
    setPassword('')
    setError('')
    setNotice('')
  }

  const submit = async () => {
    if (pending) return
    const normalizedEmail = email.trim().toLowerCase()
    if (mode !== 'reset' && !/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setError('Введите корректный email')
      return
    }
    if (mode !== 'forgot' && password.length < 6) {
      setError('Пароль должен содержать не менее 6 символов')
      return
    }
    if (mode === 'signup' && !agreement) {
      setError('Подтвердите согласие с условиями использования')
      return
    }

    const supabase = createClient()
    if (!supabase) {
      setError('Supabase не настроен. Заполните .env.local')
      return
    }

    setPending(true)
    setError('')
    setNotice('')
    try {
      if (mode === 'signin') {
        const { error: authError } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password })
        if (authError) throw authError
        onAuthenticated()
        return
      }

      if (mode === 'signup') {
        const { data: sessionData } = await supabase.auth.getSession()
        if (sessionData.session?.user.is_anonymous) {
          const { error: metadataError } = await supabase.auth.updateUser({ data: { needs_password: true } })
          if (metadataError) throw metadataError
          const { error: linkError } = await supabase.auth.updateUser(
            { email: normalizedEmail },
            { emailRedirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent('/?complete-signup=1')}` },
          )
          if (linkError) throw linkError
          setNotice('Подтвердите email по ссылке из письма. После возврата задайте пароль ещё раз')
          return
        }
        const { data, error: authError } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/confirm?next=/` },
        })
        if (authError) throw authError
        if (data.session) onAuthenticated()
        else setNotice('Проверьте почту и подтвердите регистрацию по ссылке из письма')
        return
      }

      if (mode === 'forgot') {
        const { error: authError } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
          redirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent('/?recovery=1')}`,
        })
        if (authError) throw authError
        setNotice('Если аккаунт существует, мы отправили ссылку для смены пароля')
        return
      }

      const { error: authError } = await supabase.auth.updateUser({ password, data: { needs_password: false } })
      if (authError) throw authError
      window.history.replaceState({}, '', '/')
      onAuthenticated()
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Не удалось выполнить запрос'
      setError(authErrorMessage(message))
    } finally {
      setPending(false)
    }
  }

  const title = mode === 'signin' ? 'Войти' : mode === 'signup' ? 'Зарегистрироваться' : mode === 'forgot' ? 'Восстановить пароль' : 'Новый пароль'
  const subtitle = mode === 'forgot'
    ? 'Отправим ссылку для восстановления на вашу почту'
    : mode === 'reset'
      ? 'Придумайте новый пароль для аккаунта'
      : 'Введите email и пароль, чтобы продолжить'
  const action = mode === 'signin' ? 'Войти' : mode === 'signup' ? 'Зарегистрироваться' : mode === 'forgot' ? 'Отправить ссылку' : 'Сохранить пароль'

  return (
    <main className="auth-host">
      <Stage width={1600} height={1000} theme="light" fidelity="realistic" className="auth-stage">
        {() => (
          <Card className="auth-shell" pad="small" gap={0} lift>
                <section className="auth-form-panel" onKeyDown={(event) => { if (event.key === 'Enter') void submit() }}>
              <div className="auth-brand">
                <span className="auth-brand__mark"><Icon name="calendar" size={22} filled /></span>
                <span><strong>12 недель</strong><small>трекер главных целей</small></span>
              </div>

              <div className="auth-form">
                <div className="auth-heading">
                  <h1>{title}</h1>
                  <p>{subtitle}</p>
                </div>

                {!isSupabaseConfigured() && <Badge tone="danger">Сначала настройте Supabase в .env.local</Badge>}

                {mode !== 'reset' && (
                  <Field label="Email" value={email} placeholder="name@example.com" editable leading={<Icon name="mail" size={15} />} onValueChange={setEmail} />
                )}
                {mode !== 'forgot' && (
                  <Field label={mode === 'reset' ? 'Новый пароль' : 'Пароль'} value={password} placeholder="Не менее 6 символов" editable password leading={<Icon name="lock" size={15} />} onValueChange={setPassword} />
                )}

                {mode === 'signin' && (
                  <div className="auth-forgot"><Button variant="ghost" onClick={() => switchMode('forgot')}>Забыли пароль?</Button></div>
                )}
                {mode === 'signup' && (
                  <Checkbox checked={agreement} onChange={setAgreement} label="Соглашаюсь с условиями использования и обработкой данных" />
                )}
                {error && <Badge tone="danger">{error}</Badge>}
                {notice && <Badge tone="success">{notice}</Badge>}

                <Button className="auth-submit" size="large" variant="primary" onClick={() => void submit()}>{pending ? 'Подождите…' : action}</Button>

                <div className="auth-switch">
                  {mode === 'signin' && <><span>Нет аккаунта?</span><Button variant="ghost" onClick={() => switchMode('signup')}>Зарегистрироваться</Button></>}
                  {mode === 'signup' && <><span>Уже есть аккаунт?</span><Button variant="ghost" onClick={() => switchMode('signin')}>Войти</Button></>}
                  {(mode === 'forgot' || mode === 'reset') && <Button variant="ghost" onClick={() => switchMode('signin')}>Вернуться ко входу</Button>}
                </div>
              </div>
            </section>

            <aside className="auth-promo-panel">
              <div className="auth-promo-copy">
                <h2>Главные цели<br /><span>под вашим контролем</span></h2>
                <p>Соберите 12-недельный цикл, разложите его по неделям и каждый день видьте реальный прогресс.</p>
                <div className="auth-benefits">
                  <div><span className="auth-benefit-icon auth-benefit-icon--blue"><Icon name="calendar" size={17} /></span><span><strong>Цели цикла</strong><small>Держите в фокусе то, что действительно важно.</small></span></div>
                  <div><span className="auth-benefit-icon auth-benefit-icon--amber"><Icon name="bolt" size={17} /></span><span><strong>План недели</strong><small>Превращайте результат в конкретные действия.</small></span></div>
                  <div><span className="auth-benefit-icon auth-benefit-icon--green"><Icon name="check" size={17} /></span><span><strong>Видимый прогресс</strong><small>Отмечайте выполнение и не теряйте темп.</small></span></div>
                </div>
              </div>
              <Card className="auth-preview" pad="large">
                <div className="auth-preview__head"><span>Неделя 4 из 12</span><Badge tone="success" dot>По плану</Badge></div>
                <strong>Продвинуть главный проект</strong>
                <Meter value={0.68} />
                <div className="auth-preview__checks">
                  <Checkbox checked label="Сделать ключевой шаг" />
                  <Checkbox checked label="Проверить результат" />
                  <Checkbox checked={false} label="Зафиксировать следующий шаг" />
                </div>
              </Card>
            </aside>
          </Card>
        )}
      </Stage>
    </main>
  )
}
