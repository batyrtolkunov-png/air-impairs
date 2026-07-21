import { supabase } from './supabase';

export type GuardOutcome = 'continue' | 'fight' | 'peace' | 'farewell';
export type GuardLine = { speaker: 'player' | 'guard'; text: string };
export type GuardReply = { reply: string; outcome: GuardOutcome };

const outcomes = new Set<GuardOutcome>(['continue', 'fight', 'peace', 'farewell']);

export async function talkToCastleGuard(history: GuardLine[], message: string): Promise<GuardReply> {
  const transcript = [...history, { speaker: 'player' as const, text: message }]
    .slice(-10).map((line) => `${line.speaker === 'player' ? 'Игрок' : 'Страж'}: ${line.text}`).join('\n');
  const system = `Ты суровый и грубоватый страж аборигенов у ворот замка в пиксельной фэнтези-игре. Отвечай по-русски, кратко, 1-2 предложениями, без ненависти к реальным группам и без нецензурной брани. Оцени весь разговор.
Верни ТОЛЬКО JSON: {"reply":"ответ","outcome":"continue|fight|peace|farewell"}.
fight — игрок оскорбляет, угрожает, вызывает на бой или упорно провоцирует; peace — игрок убедил пропустить его мирно; farewell — стороны решили разойтись и попрощались без прохода; continue — решения пока нет.`;
  const { data, error } = await supabase.functions.invoke('ai', { body: { system, prompt: transcript } });
  if (error) throw error;
  const raw = String(data?.text ?? '').replace(/^```json\s*|\s*```$/g, '').trim();
  const parsed = JSON.parse(raw) as Partial<GuardReply>;
  if (typeof parsed.reply !== 'string' || !outcomes.has(parsed.outcome as GuardOutcome)) throw new Error('Некорректный ответ стража');
  return { reply: parsed.reply.slice(0, 260), outcome: parsed.outcome as GuardOutcome };
}
