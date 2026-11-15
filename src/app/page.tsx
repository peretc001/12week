export default function Home() {
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 32 }}>
      <section style={{ maxWidth: 460 }}>
        <h1 style={{ margin: '0 0 12px', fontSize: 32, letterSpacing: '-0.04em' }}>12 недель</h1>
        <p style={{ margin: 0, lineHeight: 1.5 }}>
          Трекер открывается как приложение macOS. В корне репозитория выполните <code>npm run desktop</code> для разработки
          или <code>npm run desktop:build</code>, затем запустите <code>12 недель.app</code>.
        </p>
      </section>
    </main>
  )
}
