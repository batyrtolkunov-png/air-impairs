import { createClient } from '@supabase/supabase-js';

// Ключи берутся из .env.local (локально) и из Vercel → Settings → Environment Variables (на проде).
const projectUrl = 'https://ngovnqyxdjhwnsheldjd.supabase.co';
const projectPublishableKey = 'sb_publishable_yneHL2P74VrMntR65q8XaA_HuLAeUdb';
const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || projectUrl;
// Публичный ключ безопасно хранить в клиенте. Для этого проекта используем
// проверенный ключ, чтобы неверная переменная окружения не ломала сетевую игру.
const anonKey = url === projectUrl
  ? projectPublishableKey
  : (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined);

// Понятная ошибка вместо «белого экрана», если ключи забыли вставить.
if (!url || !anonKey) {
  throw new Error(
    'Нет ключей Supabase. Скопируй .env.example → .env.local и вставь VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY.',
  );
}

export const supabase = createClient(url, anonKey);
