# 12 недель

Трекер целей на 12-недельный цикл. Дата первой недели, тема, цели, пункты и
выполнение хранятся в Supabase; демоданные не создаются.

## Подключение Supabase

1. Создайте проект в Supabase.
2. Убедитесь, что в `Authentication → Providers` включён вход по Email.
3. В `Authentication → URL Configuration` добавьте адрес приложения в Site URL
   и Redirect URLs — это нужно для подтверждения почты и восстановления пароля.
4. Примените миграцию из `supabase/migrations` через Supabase CLI или SQL Editor.
5. Скопируйте `.env.example` в `.env.local` и заполните URL и publishable key.

Если приложение уже запускалось с анонимной авторизацией, для сохранения этих
данных при регистрации включите `Allow manual linking` в настройках Auth.

```bash
cp .env.example .env.local
```

Не используйте secret/service-role key в `NEXT_PUBLIC_` переменных.

Если начальная миграция уже была применена раньше, примените и последующие
миграции по порядку. `20261115000000_goal_item_scheduled_date.sql` добавляет
необязательную дату пунктам и переносит её вместе с датой 12-недельного цикла.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
