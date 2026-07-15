import { useEffect, useRef, useState } from 'react';
import { DungeonGame, type GameSave } from './components/DungeonGame';
import { setGameVolume, setMusicPaused, startMusic } from './game/audio';
import { supabase } from './lib/supabase';

type Language = 'ru' | 'en' | 'es';
type Difficulty = 'easy' | 'normal' | 'hard';

function getStoredPlayerName() {
  try { return JSON.parse(localStorage.getItem('ashen-heart-player') ?? '{}').name as string || ''; }
  catch { return ''; }
}
function getStoredSaves(): Array<GameSave | null> { try { const saves = JSON.parse(localStorage.getItem('ashen-heart-saves') ?? '[]'); return Array.from({ length: 5 }, (_, index) => saves[index] ?? null); } catch { return Array(5).fill(null); } }

const text = {
  ru: { adventure: 'ПИКСЕЛЬНОЕ ПРИКЛЮЧЕНИЕ', title: <>ПЕПЕЛЬНОЕ<br />СЕРДЦЕ</>, newGame: 'НОВАЯ ИГРА', continue: 'ПРОДОЛЖИТЬ', settings: 'НАСТРОЙКИ', choose: 'Выбери действие', settingsTitle: 'НАСТРОЙКИ', language: 'ЯЗЫК', volume: 'ГРОМКОСТЬ', difficulty: 'СЛОЖНОСТЬ', easy: 'ЛЁГКАЯ', normal: 'СРЕДНЯЯ', hard: 'СЛОЖНАЯ', easyHint: 'Половина монстров', normalHint: 'Обычное количество', hardHint: 'Вдвое больше монстров', back: 'НАЗАД', controls: 'WASD — ДВИЖЕНИЕ · SPACE — АТАКА · Q — УЛЬТА · ESC — МЕНЮ' },
  en: { adventure: 'PIXEL ADVENTURE', title: <>ASHEN<br />HEART</>, newGame: 'NEW GAME', continue: 'CONTINUE', settings: 'SETTINGS', choose: 'Choose an action', settingsTitle: 'SETTINGS', language: 'LANGUAGE', volume: 'VOLUME', difficulty: 'DIFFICULTY', easy: 'EASY', normal: 'NORMAL', hard: 'HARD', easyHint: 'Half as many monsters', normalHint: 'Standard monster count', hardHint: 'Twice as many monsters', back: 'BACK', controls: 'WASD — MOVE · SPACE — ATTACK · Q — ULTIMATE · ESC — MENU' },
  es: { adventure: 'AVENTURA PÍXEL', title: <>CORAZÓN<br />DE CENIZA</>, newGame: 'NUEVA PARTIDA', continue: 'CONTINUAR', settings: 'AJUSTES', choose: 'Elige una acción', settingsTitle: 'AJUSTES', language: 'IDIOMA', volume: 'VOLUMEN', difficulty: 'DIFICULTAD', easy: 'FÁCIL', normal: 'NORMAL', hard: 'DIFÍCIL', easyHint: 'La mitad de monstruos', normalHint: 'Cantidad normal', hardHint: 'El doble de monstruos', back: 'VOLVER', controls: 'WASD — MOVER · SPACE — ATACAR · Q — ESPECIAL · ESC — MENÚ' },
};

const registrationText = {
  ru: { button: 'РЕГИСТРАЦИЯ', title: 'СОЗДАТЬ ПРОФИЛЬ', name: 'ИМЯ ИГРОКА', email: 'ЭЛЕКТРОННАЯ ПОЧТА', password: 'ПАРОЛЬ', show: 'ПОКАЗАТЬ ПАРОЛЬ', hide: 'СКРЫТЬ ПАРОЛЬ', submit: 'ЗАРЕГИСТРИРОВАТЬСЯ', google: 'ПРОДОЛЖИТЬ С GOOGLE', guest: 'ВОЙТИ КАК ГОСТЬ', required: 'Для начала игры зарегистрируйся или войди как гость', success: 'Профиль создан!', error: 'Заполни все поля. Пароль должен содержать не меньше 6 символов.' },
  en: { button: 'REGISTER', title: 'CREATE PROFILE', name: 'PLAYER NAME', email: 'EMAIL', password: 'PASSWORD', show: 'SHOW PASSWORD', hide: 'HIDE PASSWORD', submit: 'REGISTER', google: 'CONTINUE WITH GOOGLE', guest: 'PLAY AS GUEST', required: 'Register or continue as a guest to start the game', success: 'Profile created!', error: 'Complete every field. Password must contain at least 6 characters.' },
  es: { button: 'REGISTRARSE', title: 'CREAR PERFIL', name: 'NOMBRE DEL JUGADOR', email: 'CORREO ELECTRÓNICO', password: 'CONTRASEÑA', show: 'MOSTRAR CONTRASEÑA', hide: 'OCULTAR CONTRASEÑA', submit: 'REGISTRARSE', google: 'CONTINUAR CON GOOGLE', guest: 'ENTRAR COMO INVITADO', required: 'Regístrate o entra como invitado para empezar', success: '¡Perfil creado!', error: 'Completa todos los campos. La contraseña debe tener al menos 6 caracteres.' },
};

export default function App() {
  const [menuOpen, setMenuOpen] = useState(true);
  const [pauseOpen, setPauseOpen] = useState(false);
  const [saveSlotsOpen, setSaveSlotsOpen] = useState(false);
  const [saveMode, setSaveMode] = useState<'save' | 'load'>('load');
  const [saveSlots, setSaveSlots] = useState<Array<GameSave | null>>(getStoredSaves);
  const [saveRequest, setSaveRequest] = useState(0);
  const [initialSave, setInitialSave] = useState<GameSave | null>(null);
  const pendingSaveSlot = useRef(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [modeOpen, setModeOpen] = useState(false);
  const [players, setPlayers] = useState<1 | 2>(1);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameId, setGameId] = useState(0);
  const [tutorial, setTutorial] = useState(false);
  const [cutscenePlayers, setCutscenePlayers] = useState<1 | 2 | null>(null);
  const [cutsceneStep, setCutsceneStep] = useState(0);
  const [language, setLanguage] = useState<Language>('ru');
  const [volume, setVolume] = useState(70);
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [playerName, setPlayerName] = useState('');
  const [activePlayerName, setActivePlayerName] = useState(getStoredPlayerName);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [registrationMessage, setRegistrationMessage] = useState('');
  const [googleMessage, setGoogleMessage] = useState('');
  const [registered, setRegistered] = useState(() => Boolean(localStorage.getItem('ashen-heart-player')));
  const [guest, setGuest] = useState(false);
  const t = text[language];
  const rt = registrationText[language];
  const enemyMultiplier = difficulty === 'easy' ? .5 : difficulty === 'hard' ? 2 : 1;

  useEffect(() => { setGameVolume(volume / 100); }, [volume]);
  useEffect(() => { if (gameStarted) setMusicPaused(menuOpen || pauseOpen); }, [gameStarted, menuOpen, pauseOpen]);

  useEffect(() => {
    const applyGoogleUser = (user: any) => { if (!user) return; const name = String(user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Google Player'); const googleEmail = String(user.email || ''); localStorage.setItem('ashen-heart-player', JSON.stringify({ name, email: googleEmail, provider: 'google' })); setPlayerName(name); setEmail(googleEmail); setActivePlayerName(name); setRegistered(true); setGuest(false); setRegistrationMessage(rt.success); setGoogleMessage(''); };
    void supabase.auth.getSession().then(({ data }) => applyGoogleUser(data.session?.user));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => applyGoogleUser(session?.user));
    return () => data.subscription.unsubscribe();
  }, [rt.success]);

  const continueWithGoogle = async () => {
    setGoogleMessage('Перенаправляем на Google…');
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
    if (error) setGoogleMessage(`Не удалось открыть Google: ${error.message}`);
  };

  useEffect(() => {
    const openMenu = (event: KeyboardEvent) => {
      if (event.code === 'Escape' && gameStarted && !menuOpen) { setSettingsOpen(false); setRegistrationOpen(false); setPauseOpen((current) => !current); }
    };
    window.addEventListener('keydown', openMenu);
    return () => window.removeEventListener('keydown', openMenu);
  }, [gameStarted, menuOpen]);

  const startNewGame = () => { setSettingsOpen(false); setRegistrationOpen(false); setModeOpen(true); };
  const beginGame = (count: 1 | 2, save: GameSave | null = null, startTutorial = false) => { startMusic(); setInitialSave(save); setTutorial(startTutorial); setPlayers(count); setGameId((current) => current + 1); setGameStarted(true); setModeOpen(false); setSaveSlotsOpen(false); setPauseOpen(false); setMenuOpen(false); };
  const beginCutscene = (count: 1 | 2) => { setCutscenePlayers(count); setCutsceneStep(0); setModeOpen(false); setMenuOpen(false); };
  const chooseSaveSlot = (index: number) => { const save = saveSlots[index]; if (saveMode === 'load') { if (save) beginGame(save.players, save); return; } pendingSaveSlot.current = index; setSaveRequest((current) => current + 1); };
  const storeSnapshot = (snapshot: GameSave) => { const frozenSnapshot = structuredClone(snapshot); setSaveSlots((current) => { const next = [...current]; next[pendingSaveSlot.current] = frozenSnapshot; localStorage.setItem('ashen-heart-saves', JSON.stringify(next)); return next; }); setSaveSlotsOpen(false); };
  const register = (event: React.FormEvent) => {
    event.preventDefault();
    if (!playerName.trim() || !email.includes('@') || password.length < 6) { setRegistrationMessage(rt.error); return; }
    localStorage.setItem('ashen-heart-player', JSON.stringify({ name: playerName.trim(), email: email.trim() }));
    setRegistered(true); setGuest(false); setActivePlayerName(playerName.trim()); setPassword(''); setRegistrationMessage(rt.success);
  };

  return <main className="game-page">
    {gameStarted && <DungeonGame key={gameId} paused={menuOpen || pauseOpen} enemyMultiplier={enemyMultiplier} profileName={guest ? 'Инкогнито' : activePlayerName || 'Игрок'} players={players} initialSave={initialSave} tutorial={tutorial} saveRequest={saveRequest} onSaveSnapshot={storeSnapshot} />}
    {cutscenePlayers && <section className={`comic-cutscene scene-${cutsceneStep}`} onClick={() => { if (cutsceneStep < 5) setCutsceneStep((step) => step + 1); else { const count = cutscenePlayers; setCutscenePlayers(null); beginGame(count, null, true); } }}>
      <div className="comic-sky"><i /><i /><i /></div><div className="ruined-castle"><b /><b /><b /><span /><span /></div><div className="destroyer-shadow"><i /><b /></div><div className="comic-hero"><i className="head" /><i className="body" /><i className="arm" /></div>
      <div className="comic-caption"><small>ПРОЛОГ · ПЕПЕЛЬНЫЙ ГОРОД</small><p>{['...Где я? Последнее, что я помню — огонь над башнями.', 'Город разрушен. Но под камнями всё ещё бьётся странное сердце...', 'Стой... Эта тень среди огня. Я видел её перед тем, как рухнула главная башня.', 'Это он разрушил город. Я запомню этот силуэт, где бы он ни скрывался.', 'Клянусь пеплом этого города: я найду тебя и отомщу за всех.', 'Хватит лежать. Вставай. Путь начинается здесь.'][cutsceneStep]}</p><b>{cutsceneStep < 5 ? 'НАЖМИ, ЧТОБЫ ПРОДОЛЖИТЬ ▶' : 'ВСТАТЬ И НАЧАТЬ ОБУЧЕНИЕ ▶'}</b></div>
      <button className="cutscene-skip" onClick={(event) => { event.stopPropagation(); const count = cutscenePlayers; setCutscenePlayers(null); beginGame(count, null, true); }}>ПРОПУСТИТЬ</button>
    </section>}
    {gameStarted && !menuOpen && !pauseOpen && <button className="pause-button" aria-label="Пауза" onClick={() => setPauseOpen(true)}><i /><i /></button>}
    {pauseOpen && !menuOpen && <div className="pause-overlay"><section className="pause-panel"><small>ИГРА ОСТАНОВЛЕНА</small><h2>ПАУЗА</h2><button onClick={() => setPauseOpen(false)}>{t.continue}</button><button onClick={() => { setSaveMode('save'); setSaveSlotsOpen(true); }}>СОХРАНИТЬ ИГРУ</button><button onClick={() => { setPauseOpen(false); setSettingsOpen(true); setMenuOpen(true); }}>{t.settings}</button><button className="pause-exit" onClick={() => { setPauseOpen(false); setSettingsOpen(false); setRegistrationOpen(false); setModeOpen(false); setMenuOpen(true); }}>ГЛАВНОЕ МЕНЮ</button></section></div>}
    {saveSlotsOpen && <div className="save-overlay"><section className="save-panel"><small>{saveMode === 'save' ? 'ВЫБЕРИ МЕСТО ДЛЯ СОХРАНЕНИЯ' : 'ВЫБЕРИ СОХРАНЁННЫЙ ЭТАП'}</small><h2>{saveMode === 'save' ? 'СОХРАНЕНИЕ' : 'ПРОДОЛЖИТЬ'}</h2><div className="save-slots">{saveSlots.map((save, index) => <button key={index} className={save ? 'filled' : ''} onClick={() => chooseSaveSlot(index)} disabled={saveMode === 'load' && !save}><b>СЛОТ {index + 1}</b>{save ? <><span>УРОВЕНЬ {save.level} · {save.players} ИГРОК{save.players === 2 ? 'А' : ''}</span><time>{new Date(save.savedAt).toLocaleString()}</time></> : <span>ПУСТО</span>}</button>)}</div><button className="settings-back" onClick={() => setSaveSlotsOpen(false)}>← НАЗАД</button></section></div>}
    {menuOpen && <section className="main-menu" aria-label={t.settings}>
      <div className="menu-mist mist-one" /><div className="menu-mist mist-two" />
      {!settingsOpen && !registrationOpen && !modeOpen ? <>
        <div className="menu-emblem"><span>✦</span></div><p className="menu-kicker">{t.adventure}</p><h1>{t.title}</h1>
        <div className="menu-divider"><i /><b>◆</b><i /></div>
        <nav className="menu-actions"><button onClick={startNewGame}>{t.newGame}</button><button onClick={() => { setSaveMode('load'); setSaveSlotsOpen(true); }}>{t.continue}</button><button onClick={() => setSettingsOpen(true)}>{t.settings}</button><button onClick={() => { setRegistrationMessage(''); setRegistrationOpen(true); }}>{rt.button}</button></nav>
        <p className="menu-message">{t.choose}</p><small>{t.controls}</small>
      </> : settingsOpen ? <div className="settings-panel">
        <h2>{t.settingsTitle}</h2>
        <div className="setting-row"><label>{t.language}</label><div className="setting-options language-options"><button className={language === 'ru' ? 'active' : ''} onClick={() => setLanguage('ru')}>РУССКИЙ</button><button className={language === 'en' ? 'active' : ''} onClick={() => setLanguage('en')}>ENGLISH</button><button className={language === 'es' ? 'active' : ''} onClick={() => setLanguage('es')}>ESPAÑOL</button></div></div>
        <div className="setting-row"><label htmlFor="volume">{t.volume} <b>{volume}%</b></label><input id="volume" type="range" min="0" max="100" value={volume} onChange={(event) => setVolume(Number(event.target.value))} style={{ '--volume': `${volume}%` } as React.CSSProperties} /></div>
        <div className="setting-row"><label>{t.difficulty}</label><div className="difficulty-options">{(['easy', 'normal', 'hard'] as Difficulty[]).map((mode) => <button key={mode} className={difficulty === mode ? 'active' : ''} onClick={() => setDifficulty(mode)}><strong>{t[mode]}</strong><small>{t[`${mode}Hint` as 'easyHint' | 'normalHint' | 'hardHint']}</small></button>)}</div></div>
        <button className="settings-back" onClick={() => setSettingsOpen(false)}>← {t.back}</button>
      </div> : registrationOpen ? <form className="settings-panel registration-panel" onSubmit={register}>
        <h2>{rt.title}</h2>
        <label className="registration-field"><span>{rt.name}</span><input value={playerName} onChange={(event) => setPlayerName(event.target.value)} autoComplete="username" maxLength={24} /></label>
        <label className="registration-field"><span>{rt.email}</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" /></label>
        <label className="registration-field"><span>{rt.password}</span><div className="password-input"><input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={6} /><button type="button" aria-label={showPassword ? rt.hide : rt.show} title={showPassword ? rt.hide : rt.show} onClick={() => setShowPassword((visible) => !visible)}><i>{showPassword ? '◆' : '◇'}</i><small>{showPassword ? rt.hide : rt.show}</small></button></div></label>
        <button className="registration-submit" type="submit">{rt.submit}</button>
        <div className="registration-separator"><i />ИЛИ<i /></div>
        <button className="google-register" type="button" onClick={continueWithGoogle}><b>G</b><span>{rt.google}</span></button>
        {googleMessage && <p className="google-message">{googleMessage}</p>}
        {!registered && <button className="guest-login" type="button" onClick={() => { setGuest(true); setRegistrationMessage(''); setRegistrationOpen(false); }}>{rt.guest}</button>}
        <p className={`registration-result ${registrationMessage === rt.success ? 'success' : ''}`}>{registrationMessage}</p>
        <button className="settings-back" type="button" onClick={() => setRegistrationOpen(false)}>← {t.back}</button>
      </form> : <div className="settings-panel mode-panel"><h2>ВЫБЕРИ РЕЖИМ</h2><p>Сколько игроков будет играть на одной клавиатуре?</p><div className="mode-options"><button onClick={() => beginCutscene(1)}><strong>1 ИГРОК</strong><small>WASD · E · I · Q<br />H — ЛЕЧЕНИЕ ТИММЕЙТА</small></button><button onClick={() => beginCutscene(2)}><strong>2 ИГРОКА</strong><small>СТРЕЛКИ · Ю · Э · Б<br />L — ЛЕЧЕНИЕ ТИММЕЙТА</small></button></div><button className="settings-back" onClick={() => setModeOpen(false)}>← НАЗАД</button></div>}
    </section>}
  </main>;
}
