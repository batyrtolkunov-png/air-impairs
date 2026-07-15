import { useCallback, useEffect, useRef, useState } from 'react';

const WIDTH = 360;
const HEIGHT = 600;
const BIRD_X = 90;
const PIPE_WIDTH = 64;
const PIPE_GAP = 160;
type Pipe = { x: number; gapY: number; passed: boolean };
type GameState = 'ready' | 'playing' | 'gameover';

function drawScene(ctx: CanvasRenderingContext2D, birdY: number, pipes: Pipe[], score: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  sky.addColorStop(0, '#8ad8ef'); sky.addColorStop(1, '#e9f8e8');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = 'rgba(255,255,255,.72)';
  [[55, 95], [280, 150], [175, 55]].forEach(([x, y]) => {
    ctx.beginPath(); ctx.arc(x, y, 20, 0, Math.PI * 2); ctx.arc(x + 24, y + 4, 27, 0, Math.PI * 2); ctx.fill();
  });
  pipes.forEach((pipe) => {
    ctx.fillStyle = '#2c8c69'; ctx.fillRect(pipe.x, 0, PIPE_WIDTH, pipe.gapY - PIPE_GAP / 2);
    ctx.fillRect(pipe.x, pipe.gapY + PIPE_GAP / 2, PIPE_WIDTH, HEIGHT);
    ctx.fillStyle = '#45b987'; ctx.fillRect(pipe.x + 7, 0, 10, pipe.gapY - PIPE_GAP / 2);
    ctx.fillRect(pipe.x + 7, pipe.gapY + PIPE_GAP / 2, 10, HEIGHT);
  });
  ctx.fillStyle = '#f7c948'; ctx.beginPath(); ctx.arc(BIRD_X, birdY, 18, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(BIRD_X + 8, birdY - 6, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1c2833'; ctx.beginPath(); ctx.arc(BIRD_X + 10, birdY - 6, 3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ed795d'; ctx.beginPath(); ctx.moveTo(BIRD_X + 16, birdY); ctx.lineTo(BIRD_X + 30, birdY + 5); ctx.lineTo(BIRD_X + 16, birdY + 8); ctx.fill();
  ctx.fillStyle = '#f1a936'; ctx.beginPath(); ctx.ellipse(BIRD_X - 8, birdY + 6, 12, 7, -.35, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = '800 44px Inter, sans-serif'; ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0,0,0,.25)'; ctx.shadowBlur = 4; ctx.fillText(String(score), WIDTH / 2, 62); ctx.shadowBlur = 0;
}

export function FlappyGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);
  const stateRef = useRef<GameState>('ready');
  const birdRef = useRef({ y: HEIGHT / 2, velocity: 0 });
  const pipesRef = useRef<Pipe[]>([]);
  const scoreRef = useRef(0);
  const [gameState, setGameState] = useState<GameState>('ready');
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() => Number(localStorage.getItem('flappy-best') || 0));

  const reset = useCallback(() => {
    birdRef.current = { y: HEIGHT / 2, velocity: -6.5 };
    pipesRef.current = [{ x: WIDTH + 80, gapY: 220, passed: false }];
    scoreRef.current = 0; setScore(0); stateRef.current = 'playing'; setGameState('playing');
  }, []);

  const flap = useCallback(() => {
    if (stateRef.current !== 'playing') reset();
    else birdRef.current.velocity = -6.5;
  }, [reset]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.code === 'Space') { event.preventDefault(); flap(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [flap]);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const loop = () => {
      const bird = birdRef.current;
      if (stateRef.current === 'playing') {
        bird.velocity += .36; bird.y += bird.velocity;
        pipesRef.current.forEach((pipe) => { pipe.x -= 2.7; });
        const last = pipesRef.current[pipesRef.current.length - 1];
        if (last && last.x < WIDTH - 190) pipesRef.current.push({ x: WIDTH + 20, gapY: 150 + Math.random() * 280, passed: false });
        pipesRef.current = pipesRef.current.filter((pipe) => pipe.x > -PIPE_WIDTH);
        for (const pipe of pipesRef.current) {
          const hitX = BIRD_X + 16 > pipe.x && BIRD_X - 16 < pipe.x + PIPE_WIDTH;
          const hitY = bird.y - 16 < pipe.gapY - PIPE_GAP / 2 || bird.y + 16 > pipe.gapY + PIPE_GAP / 2;
          if (hitX && hitY) stateRef.current = 'gameover';
          if (!pipe.passed && pipe.x + PIPE_WIDTH < BIRD_X) { pipe.passed = true; scoreRef.current += 1; setScore(scoreRef.current); }
        }
        if (bird.y < 16 || bird.y > HEIGHT - 16) stateRef.current = 'gameover';
        if (stateRef.current === 'gameover') {
          setGameState('gameover');
          setBest((oldBest) => { const next = Math.max(oldBest, scoreRef.current); localStorage.setItem('flappy-best', String(next)); return next; });
        }
      }
      drawScene(ctx, bird.y, pipesRef.current, scoreRef.current);
      frameRef.current = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(frameRef.current);
  }, []);

  return (
    <section className="game-shell">
      <div className="scoreboard"><span>СЧЁТ <b>{score}</b></span><span>РЕКОРД <b>{best}</b></span></div>
      <div className="canvas-wrap" onPointerDown={flap}>
        <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} aria-label="Игра Flappy Bird" />
        {gameState !== 'playing' && (
          <div className="game-overlay">
            <div className="bird-badge">🐤</div>
            <h2>{gameState === 'ready' ? 'Готов лететь?' : 'Полёт окончен'}</h2>
            <p>{gameState === 'ready' ? 'Пролетай между трубами и набирай очки.' : `Твой результат: ${score}`}</p>
            <button type="button" onPointerDown={(event) => { event.stopPropagation(); reset(); }}>
              {gameState === 'ready' ? 'Начать игру' : 'Ещё раз'}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
