import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { BestiaryMonster, DungeonGame, type GameSave, type NetworkGameState } from "./components/DungeonGame";
import { setGameVolume, setMusicPaused, startMusic } from "./game/audio";
import { supabase } from "./lib/supabase";
import { CONTROL_GROUPS, DEFAULT_KEY_BINDINGS, readableKey, type ControlAction, type KeyBindings } from "./game/controls";

function getStoredKeyBindings(): KeyBindings { try { return { ...DEFAULT_KEY_BINDINGS, ...JSON.parse(localStorage.getItem('ashen-key-bindings') || '{}') }; } catch { return { ...DEFAULT_KEY_BINDINGS }; } }

type Language = "ru" | "en" | "es";
type Difficulty = "easy" | "normal" | "hard";
type PlayerClass = "knight" | "mage" | "archer" | "boxer";
type MenuTab = "home" | "journal" | "main" | "inventory" | "boutique";
type CalendarState = {
  claimed: number;
  lastClaimDate: string;
  shards: number;
  diamonds: number;
  chests: string[];
};

function getStoredPlayerName() {
  try {
    return (
      (JSON.parse(localStorage.getItem("ashen-heart-player") ?? "{}")
        .name as string) || ""
    );
  } catch {
    return "";
  }
}
function getStoredSaves(): Array<GameSave | null> {
  try {
    const saves = JSON.parse(localStorage.getItem("ashen-heart-saves") ?? "[]");
    return Array.from({ length: 5 }, (_, index) => saves[index] ?? null);
  } catch {
    return Array(5).fill(null);
  }
}
function getStoredCalendar(): CalendarState {
  try {
    return {
      claimed: 0,
      lastClaimDate: "",
      shards: 0,
      diamonds: 0,
      chests: [],
      ...JSON.parse(localStorage.getItem("ashen-heart-calendar") ?? "{}"),
    };
  } catch {
    return {
      claimed: 0,
      lastClaimDate: "",
      shards: 0,
      diamonds: 0,
      chests: [],
    };
  }
}

const text = {
  ru: {
    adventure: "ПИКСЕЛЬНОЕ ПРИКЛЮЧЕНИЕ",
    title: (
      <>
        ПЕПЕЛЬНОЕ
        <br />
        СЕРДЦЕ
      </>
    ),
    newGame: "НОВАЯ ИГРА",
    continue: "ПРОДОЛЖИТЬ",
    settings: "НАСТРОЙКИ",
    choose: "Выбери действие",
    settingsTitle: "НАСТРОЙКИ",
    language: "ЯЗЫК",
    volume: "ГРОМКОСТЬ",
    difficulty: "СЛОЖНОСТЬ",
    easy: "ЛЁГКАЯ",
    normal: "СРЕДНЯЯ",
    hard: "СЛОЖНАЯ",
    easyHint: "Половина монстров",
    normalHint: "Обычное количество",
    hardHint: "Вдвое больше монстров",
    back: "НАЗАД",
    controls: "WASD — ДВИЖЕНИЕ · SPACE — АТАКА · Q — УЛЬТА · ESC — МЕНЮ",
  },
  en: {
    adventure: "PIXEL ADVENTURE",
    title: (
      <>
        ASHEN
        <br />
        HEART
      </>
    ),
    newGame: "NEW GAME",
    continue: "CONTINUE",
    settings: "SETTINGS",
    choose: "Choose an action",
    settingsTitle: "SETTINGS",
    language: "LANGUAGE",
    volume: "VOLUME",
    difficulty: "DIFFICULTY",
    easy: "EASY",
    normal: "NORMAL",
    hard: "HARD",
    easyHint: "Half as many monsters",
    normalHint: "Standard monster count",
    hardHint: "Twice as many monsters",
    back: "BACK",
    controls: "WASD — MOVE · SPACE — ATTACK · Q — ULTIMATE · ESC — MENU",
  },
  es: {
    adventure: "AVENTURA PÍXEL",
    title: (
      <>
        CORAZÓN
        <br />
        DE CENIZA
      </>
    ),
    newGame: "NUEVA PARTIDA",
    continue: "CONTINUAR",
    settings: "AJUSTES",
    choose: "Elige una acción",
    settingsTitle: "AJUSTES",
    language: "IDIOMA",
    volume: "VOLUMEN",
    difficulty: "DIFICULTAD",
    easy: "FÁCIL",
    normal: "NORMAL",
    hard: "DIFÍCIL",
    easyHint: "La mitad de monstruos",
    normalHint: "Cantidad normal",
    hardHint: "El doble de monstruos",
    back: "VOLVER",
    controls: "WASD — MOVER · SPACE — ATACAR · Q — ESPECIAL · ESC — MENÚ",
  },
};

const registrationText = {
  ru: {
    button: "РЕГИСТРАЦИЯ",
    title: "СОЗДАТЬ ПРОФИЛЬ",
    name: "ИМЯ ИГРОКА",
    email: "ЭЛЕКТРОННАЯ ПОЧТА",
    password: "ПАРОЛЬ",
    show: "ПОКАЗАТЬ ПАРОЛЬ",
    hide: "СКРЫТЬ ПАРОЛЬ",
    submit: "ЗАРЕГИСТРИРОВАТЬСЯ",
    google: "ПРОДОЛЖИТЬ С GOOGLE",
    guest: "ВОЙТИ КАК ГОСТЬ",
    required: "Для начала игры зарегистрируйся или войди как гость",
    success: "Профиль создан!",
    error: "Заполни все поля. Пароль должен содержать не меньше 6 символов.",
  },
  en: {
    button: "REGISTER",
    title: "CREATE PROFILE",
    name: "PLAYER NAME",
    email: "EMAIL",
    password: "PASSWORD",
    show: "SHOW PASSWORD",
    hide: "HIDE PASSWORD",
    submit: "REGISTER",
    google: "CONTINUE WITH GOOGLE",
    guest: "PLAY AS GUEST",
    required: "Register or continue as a guest to start the game",
    success: "Profile created!",
    error: "Complete every field. Password must contain at least 6 characters.",
  },
  es: {
    button: "REGISTRARSE",
    title: "CREAR PERFIL",
    name: "NOMBRE DEL JUGADOR",
    email: "CORREO ELECTRÓNICO",
    password: "CONTRASEÑA",
    show: "MOSTRAR CONTRASEÑA",
    hide: "OCULTAR CONTRASEÑA",
    submit: "REGISTRARSE",
    google: "CONTINUAR CON GOOGLE",
    guest: "ENTRAR COMO INVITADO",
    required: "Regístrate o entra como invitado para empezar",
    success: "¡Perfil creado!",
    error:
      "Completa todos los campos. La contraseña debe tener al menos 6 caracteres.",
  },
};

export default function App() {
  const [menuOpen, setMenuOpen] = useState(true);
  const [pauseOpen, setPauseOpen] = useState(false);
  const [saveSlotsOpen, setSaveSlotsOpen] = useState(false);
  const [saveMode, setSaveMode] = useState<"save" | "load">("load");
  const [saveSlots, setSaveSlots] =
    useState<Array<GameSave | null>>(getStoredSaves);
  const [saveRequest, setSaveRequest] = useState(0);
  const [initialSave, setInitialSave] = useState<GameSave | null>(null);
  const pendingSaveSlot = useRef(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [listeningControl, setListeningControl] = useState<ControlAction | null>(null);
  const [keyBindings, setKeyBindings] = useState<KeyBindings>(getStoredKeyBindings);
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [deviceOpen, setDeviceOpen] = useState(false);
  const [mobileControls, setMobileControls] = useState(false);
  const [mobilePortrait, setMobilePortrait] = useState(false);
  const [fullscreenHint, setFullscreenHint] = useState("");
  const [modeOpen, setModeOpen] = useState(false);
  const [playTypeOpen, setPlayTypeOpen] = useState(false);
  const [networkLobbyOpen, setNetworkLobbyOpen] = useState(false);
  const [joinCodeOpen, setJoinCodeOpen] = useState(false);
  const [roomCode, setRoomCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [roomMessage, setRoomMessage] = useState("");
  const [pendingRoomPlayer, setPendingRoomPlayer] = useState<{ name: string; requestId: string } | null>(null);
  const [networkRole, setNetworkRole] = useState<"host" | "guest" | null>(null);
  const [remotePosition, setRemotePosition] = useState<{ x: number; y: number; fx?: number; fy?: number; moving?: boolean; attacking?: boolean } | null>(null);
  const [remoteGameState, setRemoteGameState] = useState<NetworkGameState | null>(null);
  const roomChannel = useRef<RealtimeChannel | null>(null);
  const roomJoinRetry = useRef<number | null>(null);
  const roomPollTimer = useRef<number | null>(null);
  const roomJoinApproved = useRef(false);
  const roomRequestId = useRef("");
  const lastRoomCode = useRef("");
  const [players, setPlayers] = useState<1 | 2>(1);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameId, setGameId] = useState(0);
  const [tutorial, setTutorial] = useState(false);
  const [startingCoins, setStartingCoins] = useState(0);
  const [oneHitBoss, setOneHitBoss] = useState(false);
  const [startingLevelOverride, setStartingLevelOverride] = useState<
    number | null
  >(null);
  const [cutscenePlayers, setCutscenePlayers] = useState<1 | 2 | null>(null);
  const [cutsceneStep, setCutsceneStep] = useState(0);
  const [endingStep, setEndingStep] = useState<number | null>(null);
  const [merchantMode, setMerchantMode] = useState(false);
  const [merchantShopOpen, setMerchantShopOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarState, setCalendarState] =
    useState<CalendarState>(getStoredCalendar);
  const [boutiqueOpen, setBoutiqueOpen] = useState(false);
  const [menuTab, setMenuTab] = useState<MenuTab>("main");
  const [boutiqueOwned, setBoutiqueOwned] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("ashen-heart-boutique") ?? "[]");
    } catch {
      return [];
    }
  });
  const [equippedBoutiqueSkin, setEquippedBoutiqueSkin] = useState(
    () => localStorage.getItem("ashen-heart-equipped-skin") || "default",
  );
  const monsterJournal = [
    { id: "slime", name: "СЛИЗЕНЬ", region: "Тёмный лес", unlockLevel: 1 },
    { id: "goblin", name: "ГОБЛИН", region: "Тёмный лес", unlockLevel: 1 },
    {
      id: "goblin-boss",
      name: "ВЕЛИКИЙ ГОБЛИН",
      region: "Тёмный лес",
      unlockLevel: 6,
    },
    {
      id: "scorpion",
      name: "ПЕСЧАНЫЙ СКОРПИОН",
      region: "Жаркая пустыня",
      unlockLevel: 7,
    },
    { id: "mummy", name: "МУМИЯ", region: "Жаркая пустыня", unlockLevel: 7 },
    {
      id: "mummy-boss",
      name: "ХРАНИТЕЛЬ ПУСТЫНЬ",
      region: "Жаркая пустыня",
      unlockLevel: 12,
    },
    {
      id: "ice-spirit",
      name: "ЛЕДЯНОЙ ДУХ",
      region: "Ледяное кладбище",
      unlockLevel: 13,
    },
    {
      id: "ice-golem",
      name: "ЛЕДЯНОЙ ГОЛЕМ",
      region: "Ледяное кладбище",
      unlockLevel: 13,
    },
    {
      id: "ice-golem-boss",
      name: "ПОВЕЛИТЕЛЬ ЛЬДА",
      region: "Ледяное кладбище",
      unlockLevel: 18,
    },
  ];
  const [worldMapOpen, setWorldMapOpen] = useState(false);
  const [completedRegions, setCompletedRegions] = useState(0);
  const [travelToLevel, setTravelToLevel] = useState<number | null>(null);
  const [classPlayers, setClassPlayers] = useState<1 | 2 | null>(null);
  const [classChoice, setClassChoice] = useState<PlayerClass[]>([]);
  const [playerClasses, setPlayerClasses] = useState<
    [PlayerClass, PlayerClass]
  >(["knight", "knight"]);
  const [language, setLanguage] = useState<Language>("ru");
  const [volume, setVolume] = useState(70);
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [playerName, setPlayerName] = useState("");
  const [activePlayerName, setActivePlayerName] = useState(getStoredPlayerName);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [registrationMessage, setRegistrationMessage] = useState("");
  const [googleMessage, setGoogleMessage] = useState("");
  const [registered, setRegistered] = useState(() =>
    Boolean(localStorage.getItem("ashen-heart-player")),
  );
  const [guest, setGuest] = useState(false);
  const t = text[language];
  const rt = registrationText[language];
  const enemyMultiplier =
    difficulty === "easy" ? 0.5 : difficulty === "hard" ? 2 : 1;

  useEffect(() => { if(!listeningControl)return;const capture=(event:KeyboardEvent)=>{event.preventDefault();event.stopPropagation();if(event.code==='Escape'){setListeningControl(null);return;}setKeyBindings((current)=>{const next={...current};const duplicate=(Object.keys(next) as ControlAction[]).find((id)=>id!==listeningControl&&next[id]===event.code);if(duplicate)next[duplicate]=current[listeningControl];next[listeningControl]=event.code;localStorage.setItem('ashen-key-bindings',JSON.stringify(next));return next;});setListeningControl(null);};window.addEventListener('keydown',capture,true);return()=>window.removeEventListener('keydown',capture,true);},[listeningControl]);
  useEffect(() => {
    setGameVolume(volume / 100);
  }, [volume]);
  useEffect(() => {
    if (!mobileControls) {
      setMobilePortrait(false);
      return;
    }
    const updateOrientation = () =>
      setMobilePortrait(window.innerHeight > window.innerWidth);
    updateOrientation();
    window.addEventListener("resize", updateOrientation);
    window.addEventListener("orientationchange", updateOrientation);
    return () => {
      window.removeEventListener("resize", updateOrientation);
      window.removeEventListener("orientationchange", updateOrientation);
    };
  }, [mobileControls]);
  useEffect(() => {
    let lastTouchEnd = 0;
    const preventDoubleTapZoom = (event: TouchEvent) => {
      const now = Date.now();
      if (now - lastTouchEnd < 350) event.preventDefault();
      lastTouchEnd = now;
    };
    const preventGesture = (event: Event) => event.preventDefault();
    document.addEventListener("touchend", preventDoubleTapZoom, {
      passive: false,
    });
    document.addEventListener("gesturestart", preventGesture, {
      passive: false,
    });
    document.addEventListener("gesturechange", preventGesture, {
      passive: false,
    });
    return () => {
      document.removeEventListener("touchend", preventDoubleTapZoom);
      document.removeEventListener("gesturestart", preventGesture);
      document.removeEventListener("gesturechange", preventGesture);
    };
  }, []);
  useEffect(() => {
    const grantKey = "ashen-heart-diamond-grant-150-v1";
    if (localStorage.getItem(grantKey)) return;
    setCalendarState((current) => {
      const next = { ...current, diamonds: current.diamonds + 150 };
      localStorage.setItem("ashen-heart-calendar", JSON.stringify(next));
      localStorage.setItem(grantKey, "claimed");
      return next;
    });
  }, []);
  useEffect(() => {
    setMusicPaused(pauseOpen);
  }, [menuOpen, pauseOpen]);
  useEffect(() => {
    const beginMenuMusic = () => {
      startMusic();
      setMusicPaused(false);
      window.removeEventListener("pointerdown", beginMenuMusic);
      window.removeEventListener("keydown", beginMenuMusic);
    };
    window.addEventListener("pointerdown", beginMenuMusic);
    window.addEventListener("keydown", beginMenuMusic);
    return () => {
      window.removeEventListener("pointerdown", beginMenuMusic);
      window.removeEventListener("keydown", beginMenuMusic);
    };
  }, []);

  useEffect(() => {
    const applyGoogleUser = (user: any) => {
      if (!user) return;
      const name = String(
        user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.email?.split("@")[0] ||
          "Google Player",
      );
      const googleEmail = String(user.email || "");
      localStorage.setItem(
        "ashen-heart-player",
        JSON.stringify({ name, email: googleEmail, provider: "google" }),
      );
      setPlayerName(name);
      setEmail(googleEmail);
      setActivePlayerName(name);
      setRegistered(true);
      setGuest(false);
      setRegistrationMessage(rt.success);
      setGoogleMessage("");
    };
    void supabase.auth
      .getSession()
      .then(({ data }) => applyGoogleUser(data.session?.user));
    const { data } = supabase.auth.onAuthStateChange((_event, session) =>
      applyGoogleUser(session?.user),
    );
    return () => data.subscription.unsubscribe();
  }, [rt.success]);

  const continueWithGoogle = async () => {
    setGoogleMessage("Перенаправляем на Google…");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) setGoogleMessage(`Не удалось открыть Google: ${error.message}`);
  };

  useEffect(() => {
    const openMenu = (event: KeyboardEvent) => {
      if (event.code === "Escape" && gameStarted && !menuOpen) {
        setSettingsOpen(false);
        setRegistrationOpen(false);
        setPauseOpen((current) => !current);
      }
    };
    window.addEventListener("keydown", openMenu);
    return () => window.removeEventListener("keydown", openMenu);
  }, [gameStarted, menuOpen]);

  const startNewGame = () => {
    if (!registered && !guest) {
      setRegistrationMessage("Регистрация обязательна для начала игры.");
      setRegistrationOpen(true);
      return;
    }
    setSettingsOpen(false);
    setRegistrationOpen(false);
    setModeOpen(false);
    setDeviceOpen(true);
  };
  const chooseDevice = async (mobile: boolean) => {
    setMobileControls(mobile);
    setDeviceOpen(false);
    if (mobile) {
      try {
        if (!document.fullscreenElement)
          await document.documentElement.requestFullscreen({
            navigationUI: "hide",
          });
      } catch {
        /* Fullscreen may require installed PWA on iOS. */
      }
      try {
        await (
          screen.orientation as ScreenOrientation & {
            lock?: (mode: string) => Promise<void>;
          }
        ).lock?.("landscape");
      } catch {
        /* Orientation lock is not available in every mobile browser. */
      }
    }
    setPlayTypeOpen(true);
  };
  const closeRoomChannel = () => { if (roomJoinRetry.current !== null) window.clearInterval(roomJoinRetry.current); if (roomPollTimer.current !== null) window.clearInterval(roomPollTimer.current); roomJoinRetry.current = null; roomPollTimer.current = null; setPendingRoomPlayer(null); setRemotePosition(null); setRemoteGameState(null); if (roomChannel.current) void supabase.removeChannel(roomChannel.current); roomChannel.current = null; };
  const openLocalGame = () => { setPlayTypeOpen(false); setNetworkLobbyOpen(false); setNetworkRole(null); setRoomCode(""); closeRoomChannel(); if (mobileControls) beginCutscene(1); else setModeOpen(true); };
  const connectRoom = (code: string, role: "host" | "guest") => {
    closeRoomChannel(); roomJoinApproved.current = false; roomRequestId.current = role === "guest" ? `${Date.now()}-${Math.random().toString(36).slice(2,8)}` : ""; setRoomMessage(role === "host" ? "КОМНАТА СОЗДАНА · ОЖИДАНИЕ ДРУГА" : "ПОДКЛЮЧЕНИЕ К КОМНАТЕ..."); setRemotePosition(null);
    const channel = supabase.channel(`ashen-room-${code}`, { config: { broadcast: { self: false } } }); roomChannel.current = channel;
    channel.on("broadcast", { event: "position" }, ({ payload }) => { if (payload?.role !== role) setRemotePosition({ x: Number(payload.x), y: Number(payload.y), fx: Number(payload.fx ?? 1), fy: Number(payload.fy ?? 0), moving: Boolean(payload.moving), attacking:Boolean(payload.attacking) }); });
    channel.on("broadcast", { event: "game-state" }, ({ payload }) => { if (payload?.sender !== role) setRemoteGameState(payload as NetworkGameState); });
    if (role === "host") channel.on("broadcast", { event: "join-request" }, ({ payload }) => { if (!payload?.requestId) return; setPendingRoomPlayer({ name: String(payload.name || "Инкогнито").slice(0,24), requestId: String(payload.requestId) }); setRoomMessage("НОВЫЙ ЗАПРОС НА ВХОД"); });
    else channel.on("broadcast", { event: "join-approved" }, ({ payload }) => { if (payload?.code !== code || payload?.requestId !== roomRequestId.current || roomJoinApproved.current) return; roomJoinApproved.current = true; if (roomJoinRetry.current !== null) window.clearInterval(roomJoinRetry.current); roomJoinRetry.current = null; setRoomMessage("КОМНАТА НАЙДЕНА"); setRoomCode(code); setNetworkRole("guest"); setJoinCodeOpen(false); setNetworkLobbyOpen(false); setPlayTypeOpen(false); beginClassChoice(1); });
    if (role === "host") { setRoomCode(code); setNetworkRole("host"); setNetworkLobbyOpen(false); setPlayTypeOpen(false); beginClassChoice(1); }
    channel.subscribe((status) => { if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") { setRoomMessage("НЕ УДАЛОСЬ ПОДКЛЮЧИТЬСЯ К СЕТИ · ПОПРОБУЙ ЕЩЁ РАЗ"); return; } if (status !== "SUBSCRIBED") return; if (role === "host") setRoomMessage("КОМНАТА В СЕТИ · ОЖИДАНИЕ ДРУГА"); else { const requestJoin=()=>void channel.send({ type: "broadcast", event: "join-request", payload: { code, requestId: roomRequestId.current, name: guest ? "Инкогнито" : activePlayerName || playerName || "Игрок" } });requestJoin();if(roomJoinRetry.current!==null)window.clearInterval(roomJoinRetry.current);roomJoinRetry.current=window.setInterval(requestJoin,750); } });
    const playerLabel = guest ? "Инкогнито" : activePlayerName || playerName || "Игрок";
    if (role === "host") {
      void supabase.from("game_rooms").upsert({ code, request_id: null, player_name: null, approved_request_id: null, updated_at: new Date().toISOString() });
      roomPollTimer.current = window.setInterval(async () => { const { data } = await supabase.from("game_rooms").select("request_id,player_name").eq("code", code).maybeSingle(); if (data?.request_id) { setPendingRoomPlayer({ name: String(data.player_name || "Инкогнито").slice(0,24), requestId: String(data.request_id) }); setRoomMessage("НОВЫЙ ЗАПРОС НА ВХОД"); } }, 600);
    } else {
      const requestId = roomRequestId.current;
      const pollRoom = async () => { const { data } = await supabase.from("game_rooms").select("approved_request_id").eq("code", code).maybeSingle(); if (!data) { setRoomMessage("КОМНАТА НЕ НАЙДЕНА · ПРОВЕРЬ КОД"); return; } if (data.approved_request_id === requestId && !roomJoinApproved.current) { roomJoinApproved.current = true; if (roomJoinRetry.current !== null) window.clearInterval(roomJoinRetry.current); if (roomPollTimer.current !== null) window.clearInterval(roomPollTimer.current); roomJoinRetry.current = null; roomPollTimer.current = null; setRoomMessage("КОМНАТА НАЙДЕНА"); setRoomCode(code); setNetworkRole("guest"); setJoinCodeOpen(false); setNetworkLobbyOpen(false); setPlayTypeOpen(false); beginClassChoice(1); return; } await supabase.from("game_rooms").update({ request_id: requestId, player_name: playerLabel, updated_at: new Date().toISOString() }).eq("code", code); setRoomMessage("ОЖИДАНИЕ ПОДТВЕРЖДЕНИЯ ХОЗЯИНА"); };
      void pollRoom(); roomPollTimer.current = window.setInterval(() => void pollRoom(), 600);
    }
  };
  const createNetworkRoom = () => { let code="";do code=String(Math.floor(10000+Math.random()*90000));while(code===lastRoomCode.current);lastRoomCode.current=code;connectRoom(code,"host"); };
  const joinNetworkRoom = () => { const code=joinCode.replace(/\D/g,"").slice(0,5);if(code.length!==5){setRoomMessage("ВВЕДИ ПЯТИЗНАЧНЫЙ КОД");return;}connectRoom(code,"guest"); };
  const approveRoomPlayer = () => { const channel=roomChannel.current,pending=pendingRoomPlayer;if(!pending)return;if(channel)void channel.send({ type:"broadcast",event:"join-approved",payload:{ code:roomCode,requestId:pending.requestId } });void supabase.from("game_rooms").update({ approved_request_id: pending.requestId, request_id: null, updated_at: new Date().toISOString() }).eq("code",roomCode);setRoomMessage(`${pending.name} ПОДКЛЮЧЁН`);setPendingRoomPlayer(null); };
  const sendNetworkPosition = (position: { x: number; y: number; fx?: number; fy?: number; moving?: boolean; attacking?:boolean }) => { const channel=roomChannel.current;if(!channel||!networkRole)return;void channel.send({ type:"broadcast",event:"position",payload:{...position,role:networkRole} }); };
  const sendNetworkGameState = (state: NetworkGameState) => { const channel=roomChannel.current;if(!channel||!networkRole)return;void channel.send({ type:"broadcast",event:"game-state",payload:state }); };
  const enterMobileFullscreen = async () => {
    try {
      if (!document.fullscreenElement)
        await document.documentElement.requestFullscreen({
          navigationUI: "hide",
        });
      try {
        await (
          screen.orientation as ScreenOrientation & {
            lock?: (mode: string) => Promise<void>;
          }
        ).lock?.("landscape");
      } catch {
        /* unsupported */
      }
      setFullscreenHint("");
    } catch {
      setFullscreenHint(
        "На iPhone в Safari: нажми значок телефона слева от названия сайта → три точки → Скрыть панель инструментов",
      );
    }
  };
  const beginGame = (
    count: 1 | 2,
    save: GameSave | null = null,
    startTutorial = false,
    startLevel: number | null = null,
  ) => {
    startMusic();
    setInitialSave(save);
    setStartingLevelOverride(startLevel);
    setStartingCoins(0);
    setOneHitBoss(false);
    setTutorial(!save && startTutorial);
    setCompletedRegions(save ? Math.floor(save.level / 6) : 0);
    setTravelToLevel(null);
    setWorldMapOpen(false);
    setMerchantMode(false);
    setPlayers(count);
    setGameId((current) => current + 1);
    setGameStarted(true);
    setModeOpen(false);
    setSaveSlotsOpen(false);
    setPauseOpen(false);
    setMenuOpen(false);
  };
  const beginCutscene = (count: 1 | 2) => {
    setCutscenePlayers(count);
    setCutsceneStep(0);
    setModeOpen(false);
    setMenuOpen(false);
  };
  const beginClassChoice = (count: 1 | 2) => {
    setCutscenePlayers(null);
    setClassPlayers(count);
    setClassChoice([]);
  };
  const chooseClass = (chosen: PlayerClass) => {
    if (!classPlayers) return;
    const choices = [...classChoice, chosen];
    if (choices.length >= classPlayers) {
      if (networkRole === "host") setPlayerClasses([choices[0], playerClasses[1]]);
      else if (networkRole === "guest") setPlayerClasses([playerClasses[0], choices[0]]);
      else setPlayerClasses([choices[0], choices[1] ?? choices[0]]);
      const count = classPlayers;
      setClassPlayers(null);
      if (networkRole) beginGame(2, null, true, null);
      else beginGame(count, null, true, null);
    } else setClassChoice(choices);
  };
  const chooseSaveSlot = (index: number) => {
    const save = saveSlots[index];
    if (saveMode === "load") {
      if (save) beginGame(save.players, save);
      return;
    }
    pendingSaveSlot.current = index;
    setSaveRequest((current) => current + 1);
  };
  const storeSnapshot = (snapshot: GameSave) => {
    if (guest) { setSaveSlotsOpen(false); return; }
    const frozenSnapshot = structuredClone(snapshot);
    setSaveSlots((current) => {
      const next = [...current];
      next[pendingSaveSlot.current] = frozenSnapshot;
      localStorage.setItem("ashen-heart-saves", JSON.stringify(next));
      return next;
    });
    setSaveSlotsOpen(false);
  };
  const register = (event: React.FormEvent) => {
    event.preventDefault();
    if (!playerName.trim() || !email.includes("@") || password.length < 6) {
      setRegistrationMessage(rt.error);
      return;
    }
    localStorage.setItem(
      "ashen-heart-player",
      JSON.stringify({ name: playerName.trim(), email: email.trim() }),
    );
    setRegistered(true);
    setGuest(false);
    setActivePlayerName(playerName.trim());
    setPassword("");
    setRegistrationMessage(rt.success);
  };
  const regions = [
    {
      name: "ТЁМНЫЙ ЛЕС",
      icon: "♠",
      description: "Древние чащи и логово гоблинов",
    },
    {
      name: "ЖАРКАЯ ПУСТЫНЯ",
      icon: "☀",
      description: "Песчаные руины под палящим небом",
    },
    {
      name: "ЛЕДЯНОЕ КЛАДБИЩЕ",
      icon: "✦",
      description: "Замёрзшие могилы и проклятые склепы",
    },
    {
      name: "СМЕРТЕЛЬНЫЕ ГОРЫ",
      icon: "▲",
      description: "Ледяные тропы над пропастью",
    },
    {
      name: "ДИКИЙ БЕРЕГ",
      icon: "≈",
      description: "Штормы, скалы и последний хранитель",
    },
  ];
  const dailyRewards = [
    { icon: "◆", title: "200 ОСКОЛКОВ", shards: 200 },
    { icon: "♦", title: "5 АЛМАЗОВ", diamonds: 5 },
    { icon: "▣", title: "ОБЫЧНЫЙ СУНДУК", chest: "Обычный сундук" },
    { icon: "◆", title: "400 ОСКОЛКОВ", shards: 400 },
    { icon: "♦", title: "10 АЛМАЗОВ", diamonds: 10 },
    { icon: "▣", title: "РЕДКИЙ СУНДУК", chest: "Редкий сундук" },
    {
      icon: "✦",
      title: "ПОДАРОК ГЕРОЯ",
      shards: 1000,
      diamonds: 25,
      chest: "Легендарный сундук",
    },
  ];
  const boutiqueSkins = [
    { id: "dune", name: "ДЮНА", price: 100 },
    { id: "king", name: "КОРОЛЬ", price: 100 },
    { id: "wizard", name: "ВОЛШЕБНИК", price: 100 },
    { id: "gentleman", name: "ДЖЕНТЛЬМЕН", price: 100 },
  ];
  const boutiqueAccessories = [
    { id: "propeller-cap", name: "КЕПКА-ВЕРТОЛЁТИК", price: 2500 },
    { id: "frog-cap", name: "КЕПКА-ЛЯГУШКА", price: 2500 },
    { id: "crown", name: "КОРОНА", price: 2500 },
    { id: "headphones", name: "НАУШНИКИ", price: 2500 },
  ];
  const buyBoutiqueItem = (id: string, price: number) => {
    if (boutiqueOwned.includes(id) || calendarState.diamonds < price) return;
    const owned = [...boutiqueOwned, id];
    const wallet = {
      ...calendarState,
      diamonds: calendarState.diamonds - price,
    };
    localStorage.setItem("ashen-heart-boutique", JSON.stringify(owned));
    localStorage.setItem("ashen-heart-calendar", JSON.stringify(wallet));
    setBoutiqueOwned(owned);
    setCalendarState(wallet);
  };
  const buyBoutiqueAccessory = (id: string, price: number) => {
    if (boutiqueOwned.includes(id) || calendarState.shards < price) return;
    const owned = [...boutiqueOwned, id];
    const wallet = { ...calendarState, shards: calendarState.shards - price };
    localStorage.setItem("ashen-heart-boutique", JSON.stringify(owned));
    localStorage.setItem("ashen-heart-calendar", JSON.stringify(wallet));
    setBoutiqueOwned(owned); setCalendarState(wallet);
  };
  const equipBoutiqueSkin = (id: string) => {
    if (!boutiqueOwned.includes(id)) return;
    localStorage.setItem("ashen-heart-equipped-skin", id);
    setEquippedBoutiqueSkin(id);
  };
  const claimDailyReward = (index: number) => {
    const today = new Date().toLocaleDateString("en-CA");
    if (
      index !== calendarState.claimed ||
      calendarState.lastClaimDate === today
    )
      return;
    const reward = dailyRewards[index];
    const next: CalendarState = {
      claimed: calendarState.claimed + 1,
      lastClaimDate: today,
      shards: calendarState.shards + (reward.shards ?? 0),
      diamonds: calendarState.diamonds + (reward.diamonds ?? 0),
      chests: reward.chest
        ? [...calendarState.chests, reward.chest]
        : calendarState.chests,
    };
    localStorage.setItem("ashen-heart-calendar", JSON.stringify(next));
    setCalendarState(next);
  };
  const handleVictory = (finishedLevel: number) => {
    const completed = Math.min(5, Math.ceil(finishedLevel / 6));
    setCompletedRegions((current) => Math.max(current, completed));
    if (finishedLevel === 6) setEndingStep(0);
    else if (finishedLevel === 12 || finishedLevel === 18)
      setMerchantMode(true);
    else setWorldMapOpen(true);
  };
  const travelToRegion = (regionIndex: number) => {
    if (regionIndex > completedRegions) return;
    setTravelToLevel(regionIndex * 6 + 1);
    setWorldMapOpen(false);
    setMerchantMode(false);
  };
  const highestVisitedLevel = Math.max(
    gameStarted ? (startingLevelOverride ?? initialSave?.level ?? 1) : 0,
    ...saveSlots.map((save) => save?.level ?? 0),
  );
  const openMenuTab = (tab: MenuTab) => {
    setMenuTab(tab);
    setBoutiqueOpen(tab === "boutique");
  };

  return (
    <main className="game-page">
      {gameStarted && (
        <DungeonGame
          key={gameId}
          paused={
            menuOpen ||
            pauseOpen ||
            mobilePortrait ||
            endingStep !== null ||
            worldMapOpen
          }
          enemyMultiplier={enemyMultiplier}
          startingCoins={startingCoins}
          oneHitBoss={oneHitBoss}
          startingLevel={startingLevelOverride}
          profileName={guest ? "Инкогнито" : activePlayerName || "Игрок"}
          players={players}
          playerClass={playerClasses[0]}
          playerClass2={playerClasses[1]}
          initialSave={initialSave}
          tutorial={tutorial}
          merchantMode={merchantMode}
          travelToLevel={travelToLevel}
          saveRequest={saveRequest}
          onSaveSnapshot={storeSnapshot}
          onVictory={handleVictory}
          onShopOpenChange={setMerchantShopOpen}
          mobileControls={mobileControls}
          equippedSkin={equippedBoutiqueSkin}
          networkRole={networkRole}
          remotePosition={remotePosition}
          onNetworkPosition={sendNetworkPosition}
          remoteGameState={remoteGameState}
          onNetworkGameState={sendNetworkGameState}
          keyBindings={keyBindings}
        />
      )}
      {roomCode && <div className="network-room-code"><small>КОД КОМНАТЫ</small><strong>{roomCode}</strong></div>}
      {networkRole === "host" && pendingRoomPlayer && <div className="room-join-request" role="dialog" aria-live="polite"><small>ХОЧЕТ ПРИСОЕДИНИТЬСЯ</small><strong>{pendingRoomPlayer.name}</strong><button type="button" onClick={approveRoomPlayer}>ПОДТВЕРДИТЬ</button></div>}
      {gameStarted && mobileControls && mobilePortrait && (
        <div className="rotate-phone-overlay">
          <div className="pixel-phone-rotate">
            <i />
            <b />
          </div>
          <h2>ПОВЕРНИ ТЕЛЕФОН</h2>
          <p>Для игры нужна горизонтальная ориентация экрана</p>
          <span>↻</span>
        </div>
      )}
      {classPlayers && (
        <section className="class-select">
          <div className="class-panel">
            <div className="class-emblem">✦</div>
            <small>ПЕПЕЛЬНОЕ СЕРДЦЕ</small>
            <h2>ВЫБЕРИ КЛАСС · ИГРОК {classChoice.length + 1}</h2>
            <div className="class-divider">
              <i />
              <b>◆</b>
              <i />
            </div>
            <div className="class-grid">
              <button onClick={() => chooseClass("knight")}>
                <i>⚔️</i>
                <strong>РЫЦАРЬ</strong>
              </button>
              <button onClick={() => chooseClass("mage")}>
                <i>🔮</i>
                <strong>МАГ</strong>
              </button>
              <button onClick={() => chooseClass("archer")}>
                <i>🏹</i>
                <strong>ЛУЧНИК</strong>
              </button>
              <button onClick={() => chooseClass("boxer")}>
                <i>🥊</i>
                <strong>БОКСЁР</strong>
              </button>
            </div>
          </div>
        </section>
      )}
      {endingStep !== null && (
        <section
          className={`ending-cutscene ending-${endingStep}`}
          onClick={() => {
            if (endingStep < 5) setEndingStep(endingStep + 1);
            else {
              setEndingStep(null);
              setMerchantMode(true);
            }
          }}
        >
          <div className="ending-ruins" />
          <div className="ending-hero">
            <i />
            <b />
          </div>
          <div className="fallen-goblin">
            <i />
            <b />
            <span />
          </div>
          <div className="ending-caption">
            <small>{endingStep % 2 === 0 ? "ГЕРОЙ" : "ВОЖДЬ ГОБЛИНОВ"}</small>
            <p>
              {
                [
                  "Ты разрушал эти земли ради него. Говори: где мне искать убийцу моего города?",
                  "Я не знаю его имени... Мы звали его Пепельным Странником. Он платил древним золотом.",
                  "Где он?",
                  "Ищи Архив Безмолвной башни на севере. Там хранятся договоры и карта его пути.",
                  "Если ты солгал, я вернусь. Но если там есть ответы — твоя жизнь сегодня останется при тебе.",
                  "Иди к северным воротам. Там начинается дорога к башне... и там тебя уже ждут.",
                ][endingStep]
              }
            </p>
            <b>{endingStep < 5 ? "ПРОДОЛЖИТЬ ▶" : "ЗАВЕРШИТЬ РАЗГОВОР ▶"}</b>
          </div>
        </section>
      )}
      {merchantMode && !merchantShopOpen && !worldMapOpen && !endingStep && (
        <button
          className="world-map-button"
          onClick={() => setWorldMapOpen(true)}
        >
          КАРТА МИРА
        </button>
      )}
      {worldMapOpen && (
        <section className="world-map-overlay">
          <div className="world-map-panel">
            <small>ПУТЬ ПЕПЕЛЬНОГО СЕРДЦА</small>
            <h2>КАРТА МИРА</h2>
            <p>
              Каждая новая область открывается после победы над хранителем
              предыдущей.
            </p>
            <div className="world-route">
              {regions.map((region, index) => {
                const unlocked = index <= completedRegions;
                const complete = index < completedRegions;
                return (
                  <button
                    key={region.name}
                    className={`${unlocked ? "unlocked" : "locked"} ${complete ? "complete" : ""}`}
                    disabled={
                      !unlocked || (index === 0 && completedRegions > 0)
                    }
                    onClick={() => travelToRegion(index)}
                  >
                    <i>{unlocked ? region.icon : "▣"}</i>
                    <b>{region.name}</b>
                    <span>
                      {complete
                        ? "ПРОЙДЕНО"
                        : unlocked
                          ? index === completedRegions && completedRegions < 5
                            ? "ОТКРЫТО · ВОЙТИ"
                            : "ТЕКУЩАЯ ОБЛАСТЬ"
                          : "ЗАКРЫТО"}
                    </span>
                    <small>{region.description}</small>
                  </button>
                );
              })}
            </div>
            {completedRegions >= 5 ? (
              <strong className="world-complete">ВСЕ ЗЕМЛИ ОСВОБОЖДЕНЫ!</strong>
            ) : (
              <button
                className="world-map-close"
                onClick={() => setWorldMapOpen(false)}
              >
                ВЕРНУТЬСЯ
              </button>
            )}
          </div>
        </section>
      )}
      {cutscenePlayers && (
        <section
          className={`comic-cutscene scene-${cutsceneStep}`}
          onClick={() => {
            if (cutsceneStep < 5) setCutsceneStep((step) => step + 1);
            else beginClassChoice(cutscenePlayers);
          }}
        >
          <div className="comic-sky">
            <i />
            <i />
            <i />
          </div>
          <div className="ruined-castle">
            <b />
            <b />
            <b />
            <span />
            <span />
          </div>
          <div className="destroyer-shadow">
            <i />
            <b />
          </div>
          <div className="comic-hero">
            <i className="head" />
            <i className="body" />
            <i className="arm" />
          </div>
          <div className="comic-caption">
            <small>ПРОЛОГ · ПЕПЕЛЬНЫЙ ГОРОД</small>
            <p>
              {
                [
                  "...Где я? Последнее, что я помню — огонь над башнями.",
                  "Город разрушен. Но под камнями всё ещё бьётся странное сердце...",
                  "Стой... Эта тень среди огня. Я видел её перед тем, как рухнула главная башня.",
                  "Это он разрушил город. Я запомню этот силуэт, где бы он ни скрывался.",
                  "Клянусь пеплом этого города: я найду тебя и отомщу за всех.",
                  "Хватит лежать. Вставай. Путь начинается здесь.",
                ][cutsceneStep]
              }
            </p>
            <b>
              {cutsceneStep < 5
                ? "НАЖМИ, ЧТОБЫ ПРОДОЛЖИТЬ ▶"
                : "ВСТАТЬ И НАЧАТЬ ОБУЧЕНИЕ ▶"}
            </b>
          </div>
          <button
            className="cutscene-skip"
            onClick={(event) => {
              event.stopPropagation();
              beginClassChoice(cutscenePlayers);
            }}
          >
            ПРОПУСТИТЬ
          </button>
        </section>
      )}
      {gameStarted && !menuOpen && !pauseOpen && (
        <button
          className="pause-button"
          aria-label="Пауза"
          onClick={() => setPauseOpen(true)}
        >
          <i />
          <i />
        </button>
      )}
      {pauseOpen && !menuOpen && (
        <div className="pause-overlay">
          <section className="pause-panel">
            <small>ИГРА ОСТАНОВЛЕНА</small>
            <h2>ПАУЗА</h2>
            <button onClick={() => setPauseOpen(false)}>{t.continue}</button>
            <button
              disabled={guest}
              onClick={() => {
                setSaveMode("save");
                setSaveSlotsOpen(true);
              }}
            >
              СОХРАНИТЬ ИГРУ
            </button>
            <button
              onClick={() => {
                setPauseOpen(false);
                setSettingsOpen(true);
                setMenuOpen(true);
              }}
            >
              {t.settings}
            </button>
            <button
              className="pause-exit"
              onClick={() => {
                setPauseOpen(false);
                setSettingsOpen(false);
                setRegistrationOpen(false);
                setModeOpen(false);
                setMenuOpen(true);
              }}
            >
              ГЛАВНОЕ МЕНЮ
            </button>
          </section>
        </div>
      )}
      {saveSlotsOpen && (
        <div className="save-overlay">
          <section className="save-panel">
            <small>
              {saveMode === "save"
                ? "ВЫБЕРИ МЕСТО ДЛЯ СОХРАНЕНИЯ"
                : "ВЫБЕРИ СОХРАНЁННЫЙ ЭТАП"}
            </small>
            <h2>{saveMode === "save" ? "СОХРАНЕНИЕ" : "ПРОДОЛЖИТЬ"}</h2>
            <div className="save-slots">
              {saveSlots.map((save, index) => (
                <button
                  key={index}
                  className={save ? "filled" : ""}
                  onClick={() => chooseSaveSlot(index)}
                  disabled={saveMode === "load" && !save}
                >
                  <b>СЛОТ {index + 1}</b>
                  {save ? (
                    <>
                      <span>
                        УРОВЕНЬ {save.level} · {save.players} ИГРОК
                        {save.players === 2 ? "А" : ""}
                      </span>
                      <time>{new Date(save.savedAt).toLocaleString()}</time>
                    </>
                  ) : (
                    <span>ПУСТО</span>
                  )}
                </button>
              ))}
            </div>
            <button
              className="settings-back"
              onClick={() => setSaveSlotsOpen(false)}
            >
              ← НАЗАД
            </button>
          </section>
        </div>
      )}
      {calendarOpen && (
        <div className="calendar-overlay">
          <section className="daily-calendar">
            <button
              className="calendar-close"
              onClick={() => setCalendarOpen(false)}
            >
              ✕
            </button>
            <small>ДАРЫ ПЕПЕЛЬНОГО СЕРДЦА</small>
            <h2>ЕЖЕДНЕВНЫЕ НАГРАДЫ</h2>
            <div className="calendar-wallet">
              <b>◆ {calendarState.shards}</b>
              <b>♦ {calendarState.diamonds}</b>
              <b>▣ {calendarState.chests.length}</b>
            </div>
            <div className="daily-grid">
              {dailyRewards.map((reward, index) => {
                const claimed = index < calendarState.claimed,
                  current = index === calendarState.claimed,
                  claimedToday =
                    calendarState.lastClaimDate ===
                    new Date().toLocaleDateString("en-CA");
                return (
                  <button
                    key={index}
                    className={`${claimed ? "claimed" : ""} ${current ? "current" : ""}`}
                    disabled={!current || claimedToday}
                    onClick={() => claimDailyReward(index)}
                  >
                    <span>ДЕНЬ {index + 1}</span>
                    <i className={claimed ? "reward-claimed" : reward.chest ? `reward-chest ${index === 5 ? "rare" : index === 6 ? "legendary" : "common"}` : reward.diamonds ? "reward-diamond" : "reward-shard"}>{claimed ? "✓" : ""}</i>
                    <strong>{reward.title}</strong>
                    <small>
                      {claimed
                        ? "ПОЛУЧЕНО"
                        : current && !claimedToday
                          ? "ЗАБРАТЬ"
                          : current
                            ? "ПРИХОДИ ЗАВТРА"
                            : "ЗАКРЫТО"}
                    </small>
                  </button>
                );
              })}
            </div>
            <p>Следующий подарок открывается на следующий календарный день.</p>
          </section>
        </div>
      )}
      {menuOpen && menuTab === "home" && (
        <div className="menu-tab-overlay">
          <section className="menu-tab-panel home-tab-panel">
            <button className="menu-tab-close" onClick={() => openMenuTab("main")} aria-label="Закрыть">✕</button>
            <div className="pets-paw-icon">
              <i />
              <b />
              <span />
              <em />
              <u />
            </div>
            <small>ВЕРНЫЕ СПУТНИКИ</small>
            <h2>ПИТОМЦЫ</h2>
            <div className="locked-pets-grid">{Array.from({length:5},(_,index)=>{const unlocked=index===0&&completedRegions>=1;return <article className={`locked-cat cat-${index+1} ${unlocked?'pet-unlocked black-cat-pet':''}`} key={index}><div className="cat-shadow"><i className="cat-ear left"/><i className="cat-ear right"/><i className="cat-head"/><i className="cat-eye left"/><i className="cat-eye right"/>{unlocked&&<i className="cat-mouth"/>}<i className="cat-body"/><i className="cat-paw left"/><i className="cat-paw right"/><i className="cat-tail"/></div><strong>{unlocked?'ЧЁРНАЯ КОШКА':'НЕИЗВЕСТНЫЙ ПИТОМЕЦ'}</strong><span>{unlocked?'ХОДЬБА · УКУС':'???'}</span></article>})}</div>
            <p>{completedRegions>=1?'Чёрная кошка открыта за прохождение Тёмного леса. Остальные питомцы ещё скрыты.':'Проходи локации, чтобы кошачьи тени превращались в настоящих питомцев.'}</p>
          </section>
        </div>
      )}
      {menuOpen && menuTab === "inventory" && (
        <div className="menu-tab-overlay">
          <section className="menu-tab-panel collection-panel">
            <button className="menu-tab-close" onClick={() => openMenuTab("main")} aria-label="Закрыть">✕</button>
            <small>СОБРАННЫЕ СОКРОВИЩА</small>
            <h2>ИНВЕНТАРЬ</h2>
            <div className="inventory-wallet">
              <b>◆ {calendarState.shards}</b>
              <b>♦ {calendarState.diamonds}</b>
              <b>▣ {calendarState.chests.length}</b>
            </div>
            <h3>КОЛЛЕКЦИЯ БУТИКА</h3>
            <div className="collection-grid">
              {[...boutiqueSkins, ...boutiqueAccessories].map((item) => {
                const owned = boutiqueOwned.includes(item.id);
                const isSkin = boutiqueSkins.some(
                  (skinItem) => skinItem.id === item.id,
                );
                const equipped = equippedBoutiqueSkin === item.id;
                return (
                  <button
                    key={item.id}
                    className={`${owned ? "collected" : "empty"} ${equipped ? "equipped" : ""}`}
                    disabled={!owned || !isSkin}
                    onClick={() => isSkin && equipBoutiqueSkin(item.id)}
                  >
                    <i>{owned ? "◆" : "?"}</i>
                    <strong>{owned ? item.name : "НЕ ОТКРЫТО"}</strong>
                    {owned && isSkin && (
                      <span>{equipped ? "НАДЕТО" : "НАДЕТЬ"}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      )}
      {menuOpen && menuTab === "journal" && (
        <div className="menu-tab-overlay">
          <section className="menu-tab-panel journal-panel">
            <button className="menu-tab-close" onClick={() => openMenuTab("main")} aria-label="Закрыть">✕</button>
            <small>ЗАПИСИ О СОЗДАНИЯХ</small>
            <h2>ДНЕВНИК МОНСТРОВ</h2>
            <div className="journal-grid">
              {monsterJournal.map((monster) => {
                const discovered = highestVisitedLevel >= monster.unlockLevel;
                return (
                  <article
                    key={monster.id}
                    className={discovered ? "discovered" : "unknown"}
                  >
                    <BestiaryMonster id={monster.id} hidden={!discovered} />
                    <strong>{discovered ? monster.name : "НЕИЗВЕСТНО"}</strong>
                    <small>
                      {discovered ? monster.region : "ЕЩЁ НЕ ВСТРЕЧЕН"}
                    </small>
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      )}
      {boutiqueOpen && (
        <div className="boutique-overlay">
          <section className="boutique-panel">
            <button
              className="calendar-close"
              onClick={() => openMenuTab("main")}
            >
              ✕
            </button>
            <small>ЛАВКА РЕДКИХ ОБРАЗОВ</small>
            <h2>БУТИК</h2>
            <div className="boutique-balance"><b><i className="wallet-diamond" /> АЛМАЗЫ: {calendarState.diamonds}</b><b><i className="wallet-shard" /> ОСКОЛКИ: {calendarState.shards}</b></div>
            <h3>СКИНЫ</h3>
            <div className="boutique-grid">
              {boutiqueSkins.map((item) => {
                const owned = boutiqueOwned.includes(item.id);
                const equipped = equippedBoutiqueSkin === item.id;
                return (
                  <button
                    key={item.id}
                    className={`${owned ? "owned" : ""} ${equipped ? "equipped" : ""}`}
                    disabled={!owned && calendarState.diamonds < item.price}
                    onClick={() =>
                      owned
                        ? equipBoutiqueSkin(item.id)
                        : buyBoutiqueItem(item.id, item.price)
                    }
                  >
                    <i className={`boutique-avatar skin-${item.id}`}>
                      <b className="avatar-hat" />
                      <b className="avatar-head" />
                      <b className="avatar-body" />
                      <b className="avatar-arm left" />
                      <b className="avatar-arm right" />
                      <b className="avatar-leg left" />
                      <b className="avatar-leg right" />
                      <b className="avatar-detail" />
                    </i>
                    <strong>{item.name}</strong>
                    <span>
                      {equipped
                        ? "НАДЕТО"
                        : owned
                          ? "НАДЕТЬ"
                          : `♦ ${item.price}`}
                    </span>
                  </button>
                );
              })}
            </div>
            <h3>АКСЕССУАРЫ</h3>
            <div className="boutique-grid">
              {boutiqueAccessories.map((item) => {
                const owned = boutiqueOwned.includes(item.id);
                return (
                  <button
                    key={item.id}
                    className={owned ? "owned" : ""}
                    disabled={owned || calendarState.shards < item.price}
                    onClick={() => buyBoutiqueAccessory(item.id, item.price)}
                  >
                    <i className={`boutique-accessory accessory-${item.id}`}>
                      <b className="wearer-hair" />
                      <b className="wearer-head" />
                      <b className="wearer-body" />
                      <b className="wearer-arm left" />
                      <b className="wearer-arm right" />
                      <b className="wearer-leg left" />
                      <b className="wearer-leg right" />
                      <b className="accessory-part main" />
                      <b className="accessory-part detail-one" />
                      <b className="accessory-part detail-two" />
                      <b className="accessory-part detail-three" />
                    </i>
                    <strong>{item.name}</strong>
                    <span>{owned ? "КУПЛЕНО" : `◆ ${item.price}`}</span>
                  </button>
                );
              })}
            </div>
            <p>Купленные образы и аксессуары сохраняются в коллекции.</p>
          </section>
        </div>
      )}
      {menuOpen && (
        <section className="main-menu" aria-label={t.settings}>
          <button
            className="mobile-fullscreen-button"
            onClick={enterMobileFullscreen}
          >
            <i>⛶</i>
            <span>НА ВЕСЬ ЭКРАН</span>
          </button>
          {fullscreenHint && (
            <p className="mobile-fullscreen-hint">{fullscreenHint}</p>
          )}
          <div className="menu-mist mist-one" />
          <div className="menu-mist mist-two" />
          {!settingsOpen && !registrationOpen && !deviceOpen && !modeOpen && !playTypeOpen && !networkLobbyOpen && !joinCodeOpen ? (
            <>
              <button
                className="calendar-menu-button"
                onClick={() => setCalendarOpen(true)}
                aria-label="Ежедневные награды"
              >
                <i />
                <b>7</b>
              </button>
              <button
                className="boutique-menu-button"
                onClick={() => setBoutiqueOpen(true)}
                aria-label="Бутик"
              >
                <i />
              </button>
              <div className="menu-emblem">
                <span>✦</span>
              </div>
              <p className="menu-kicker">{t.adventure}</p>
              <div className="ashen-heart-mark" aria-hidden="true">
                <i />
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>
              <h1>{t.title}</h1>
              <div className="menu-divider">
                <i />
                <b>◆</b>
                <i />
              </div>
              <nav className="menu-actions">
                <button onClick={startNewGame}>{t.newGame}</button>
                <button
                  onClick={() => {
                    if (guest) {
                      setRegistrationMessage("Чтобы продолжить сохранённую игру, зарегистрируйся или войди через Google.");
                      setRegistrationOpen(true);
                      return;
                    }
                    if (!registered && !guest) {
                      setRegistrationMessage("Сначала зарегистрируйся или войди через Google.");
                      setRegistrationOpen(true);
                      return;
                    }
                    setSaveMode("load");
                    setSaveSlotsOpen(true);
                  }}
                >
                  {t.continue}
                </button>
                <button onClick={() => setSettingsOpen(true)}>
                  {t.settings}
                </button>
                <button
                  onClick={() => {
                    setRegistrationMessage("");
                    setRegistrationOpen(true);
                  }}
                >
                  {rt.button}
                </button>
              </nav>
              <p className="menu-message">{t.choose}</p>
              <small>{t.controls}</small>
            </>
          ) : deviceOpen ? (
            <div className="settings-panel device-panel">
              <h2>ВЫБЕРИ УСТРОЙСТВО</h2>
              <p>Как ты будешь управлять героем?</p>
              <div className="device-options">
                <button onClick={() => chooseDevice(false)}>
                  <i className="device-pc" />
                  <strong>КОМПЬЮТЕР</strong>
                  <small>Клавиатура и клавиши действий</small>
                </button>
                <button onClick={() => chooseDevice(true)}>
                  <i className="device-phone" />
                  <strong>ТЕЛЕФОН</strong>
                  <small>Джойстик и сенсорные кнопки</small>
                </button>
              </div>
              <button
                className="settings-back"
                onClick={() => setDeviceOpen(false)}
              >
                ← НАЗАД
              </button>
            </div>
          ) : playTypeOpen ? (
            <div className="settings-panel mode-panel network-choice-panel">
              <h2>КАК ИГРАТЬ?</h2><p>Выбери локальную игру или подключение друга по сети.</p>
              <div className="mode-options"><button onClick={openLocalGame}><strong>ЛОКАЛЬНО</strong><small>Один экран или общая клавиатура</small></button><button onClick={() => { setPlayTypeOpen(false); setNetworkLobbyOpen(true); }}><strong>ПО СЕТИ</strong><small>Играть с другом по коду комнаты</small></button></div>
              <button className="settings-back" onClick={() => { setPlayTypeOpen(false); setDeviceOpen(true); }}>← НАЗАД</button>
            </div>
          ) : joinCodeOpen ? (
            <div className="settings-panel network-join-panel"><h2>ВОЙТИ ПО КОДУ</h2><p>Введи пятизначный код, который видит создатель комнаты.</p><input className="room-code-input" inputMode="numeric" maxLength={5} value={joinCode} onChange={(event) => setJoinCode(event.target.value.replace(/\D/g, "").slice(0,5))} placeholder="00000" /><button className="registration-submit" onClick={joinNetworkRoom}>ПОДКЛЮЧИТЬСЯ</button>{roomMessage && <p className="room-message">{roomMessage}</p>}<button className="settings-back" onClick={() => { closeRoomChannel(); setJoinCodeOpen(false); setNetworkLobbyOpen(true); }}>← НАЗАД</button></div>
          ) : networkLobbyOpen ? (
            <div className="settings-panel mode-panel network-choice-panel"><h2>СЕТЕВАЯ ИГРА</h2><p>Создай новую комнату или войди в комнату друга.</p><div className="mode-options"><button onClick={createNetworkRoom}><strong>СОЗДАТЬ КОМНАТУ</strong><small>Получить новый пятизначный код</small></button><button onClick={() => { setNetworkLobbyOpen(false); setJoinCodeOpen(true); setRoomMessage(""); }}><strong>ВОЙТИ ПО КОДУ</strong><small>Подключиться к существующей комнате</small></button></div>{roomMessage && <p className="room-message">{roomMessage}</p>}<button className="settings-back" onClick={() => { closeRoomChannel(); setNetworkLobbyOpen(false); setPlayTypeOpen(true); }}>← НАЗАД</button></div>
          ) : controlsOpen ? (
            <div className="settings-panel controls-panel"><h2>УПРАВЛЕНИЕ</h2><p>Нажми на действие, затем нажми любую клавишу.</p><div className="controls-groups">{CONTROL_GROUPS.map((group)=><section key={group.title}><h3>{group.title}</h3>{group.actions.map((action)=><button key={action.id} className={listeningControl===action.id?'listening':''} onClick={()=>setListeningControl(action.id)}><span>{action.label}</span><b>{listeningControl===action.id?'НАЖМИ КЛАВИШУ…':readableKey(keyBindings[action.id])}</b></button>)}</section>)}</div><div className="controls-footer"><button onClick={()=>{setKeyBindings({...DEFAULT_KEY_BINDINGS});localStorage.setItem('ashen-key-bindings',JSON.stringify(DEFAULT_KEY_BINDINGS));}}>СБРОСИТЬ</button><button className="settings-back" onClick={()=>{setListeningControl(null);setControlsOpen(false);}}>← НАЗАД</button></div></div>
          ) : settingsOpen ? (
            <div className="settings-panel">
              <h2>{t.settingsTitle}</h2>
              <div className="setting-row">
                <label>{t.language}</label>
                <div className="setting-options language-options">
                  <button
                    className={language === "ru" ? "active" : ""}
                    onClick={() => setLanguage("ru")}
                  >
                    РУССКИЙ
                  </button>
                  <button
                    className={language === "en" ? "active" : ""}
                    onClick={() => setLanguage("en")}
                  >
                    ENGLISH
                  </button>
                  <button
                    className={language === "es" ? "active" : ""}
                    onClick={() => setLanguage("es")}
                  >
                    ESPAÑOL
                  </button>
                </div>
              </div>
              <div className="setting-row">
                <label htmlFor="volume">
                  {t.volume} <b>{volume}%</b>
                </label>
                <input
                  id="volume"
                  type="range"
                  min="0"
                  max="100"
                  value={volume}
                  onChange={(event) => setVolume(Number(event.target.value))}
                  style={{ "--volume": `${volume}%` } as React.CSSProperties}
                />
              </div>
              <div className="setting-row">
                <label>{t.difficulty}</label>
                <div className="difficulty-options">
                  {(["easy", "normal", "hard"] as Difficulty[]).map((mode) => (
                    <button
                      key={mode}
                      className={difficulty === mode ? "active" : ""}
                      onClick={() => setDifficulty(mode)}
                    >
                      <strong>{t[mode]}</strong>
                      <small>
                        {
                          t[
                            `${mode}Hint` as
                              "easyHint" | "normalHint" | "hardHint"
                          ]
                        }
                      </small>
                    </button>
                  ))}
                </div>
              </div>
              <button className="controls-open-button" onClick={() => setControlsOpen(true)}>⌨ УПРАВЛЕНИЕ</button>
              <button
                className="settings-back"
                onClick={() => setSettingsOpen(false)}
              >
                ← {t.back}
              </button>
            </div>
          ) : registrationOpen ? (
            <form
              className="settings-panel registration-panel"
              onSubmit={register}
            >
              <h2>{rt.title}</h2>
              <label className="registration-field">
                <span>{rt.name}</span>
                <input
                  value={playerName}
                  onChange={(event) => setPlayerName(event.target.value)}
                  autoComplete="username"
                  maxLength={24}
                />
              </label>
              <label className="registration-field">
                <span>{rt.email}</span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                />
              </label>
              <label className="registration-field">
                <span>{rt.password}</span>
                <div className="password-input">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="new-password"
                    minLength={6}
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? rt.hide : rt.show}
                    title={showPassword ? rt.hide : rt.show}
                    onClick={() => setShowPassword((visible) => !visible)}
                  >
                    <i>{showPassword ? "◆" : "◇"}</i>
                    <small>{showPassword ? rt.hide : rt.show}</small>
                  </button>
                </div>
              </label>
              <button className="registration-submit" type="submit">
                {rt.submit}
              </button>
              <div className="registration-separator">
                <i />
                ИЛИ
                <i />
              </div>
              <button
                className="google-register"
                type="button"
                onClick={continueWithGoogle}
              >
                <b>G</b>
                <span>{rt.google}</span>
              </button>
              {googleMessage && (
                <p className="google-message">{googleMessage}</p>
              )}
              {!registered && (
                <button
                  className="guest-login"
                  type="button"
                  onClick={() => {
                    setGuest(true);
                    setRegistrationMessage("");
                    setRegistrationOpen(false);
                  }}
                >
                  {rt.guest}
                </button>
              )}
              <p
                className={`registration-result ${registrationMessage === rt.success ? "success" : ""}`}
              >
                {registrationMessage}
              </p>
              <button
                className="settings-back"
                type="button"
                onClick={() => (registered || guest) && setRegistrationOpen(false)}
                disabled={!registered && !guest}
              >
                ← {t.back}
              </button>
            </form>
          ) : (
            <div className="settings-panel mode-panel">
              <h2>ВЫБЕРИ РЕЖИМ</h2>
              <p>Сколько игроков будет играть на одной клавиатуре?</p>
              <div className="mode-options">
                <button onClick={() => beginCutscene(1)}>
                  <strong>1 ИГРОК</strong>
                  <small>
                    WASD · E · I · Q<br />H — САМОЛЕЧЕНИЕ
                  </small>
                </button>
                <button onClick={() => beginCutscene(2)}>
                  <strong>2 ИГРОКА</strong>
                  <small>
                    СТРЕЛКИ · Ю · Э · Б<br />L — ЛЕЧЕНИЕ ТИММЕЙТА
                  </small>
                </button>
              </div>
              <button
                className="settings-back"
                onClick={() => { setModeOpen(false); setPlayTypeOpen(true); }}
              >
                ← НАЗАД
              </button>
            </div>
          )}
          {!settingsOpen && !registrationOpen && !deviceOpen && !modeOpen && !playTypeOpen && !networkLobbyOpen && !joinCodeOpen && (
            <nav
              className="main-bottom-tabs"
              aria-label="Разделы главного меню"
            >
              <button
                className={menuTab === "home" ? "active" : ""}
                onClick={() => openMenuTab("home")}
              >
                <i className="tab-pets" />
                <span>ПИТОМЦЫ</span>
              </button>
              <button
                className={menuTab === "journal" ? "active" : ""}
                onClick={() => openMenuTab("journal")}
              >
                <i className="tab-journal" />
                <span>ДНЕВНИК</span>
              </button>
              <button
                className={`tab-main-button ${menuTab === "main" ? "active" : ""}`}
                onClick={() => openMenuTab("main")}
              >
                <i className="tab-swords" />
                <span>ГЛАВНАЯ</span>
              </button>
              <button
                className={menuTab === "inventory" ? "active" : ""}
                onClick={() => openMenuTab("inventory")}
              >
                <i className="tab-armor" />
                <span>ИНВЕНТАРЬ</span>
              </button>
              <button
                className={menuTab === "boutique" ? "active" : ""}
                onClick={() => openMenuTab("boutique")}
              >
                <i className="tab-shop" />
                <span>БУТИК</span>
              </button>
            </nav>
          )}
        </section>
      )}
    </main>
  );
}
