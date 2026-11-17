import './index.css';

import { requestExpandedMode } from '@devvit/web/client';
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

type StatusState = {
  puzzleNumber?: number;
  statusText: string;
  solvedTodayText?: string;
};

const defaultStatus: StatusState = {
  statusText: 'New case today',
};

const fetchJson = async <T,>(url: string): Promise<T> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return (await response.json()) as T;
};

export const Splash = () => {
  const [status, setStatus] = useState<StatusState>(defaultStatus);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [todayResult, statsResult] = await Promise.allSettled([
          fetchJson<{
            state: {
              puzzleNumber: number;
              attemptsUsed: number;
              finished: boolean;
              solved: boolean;
            };
          }>('/api/puzzle/today'),
          fetchJson<{
            stats: { solved1: number; solved2: number; solved3: number; failed: number };
          }>('/api/stats/today'),
        ]);

        if (cancelled) return;

        const today = todayResult.status === 'fulfilled' ? todayResult.value : null;
        const stats = statsResult.status === 'fulfilled' ? statsResult.value : null;

        if (!today) {
          setStatus(defaultStatus);
          return;
        }

        const { puzzleNumber, attemptsUsed, finished, solved } = today.state;
        const solvedToday = stats
          ? stats.stats.solved1 + stats.stats.solved2 + stats.stats.solved3
          : null;

        let statusText = 'New case today';
        if (finished) {
          statusText = solved ? `Solved in ${attemptsUsed}/3` : 'Case failed';
        }

        setStatus({
          puzzleNumber,
          statusText,
          ...(solvedToday != null ? { solvedTodayText: `${solvedToday} solved today` } : {}),
        });
      } catch {
        if (!cancelled) {
          setStatus(defaultStatus);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const puzzleLabel = status.puzzleNumber ? `Puzzle #${status.puzzleNumber}` : 'Puzzle #—';

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#101826] px-4 py-5 text-[#f4f1de]">
      <main className="flex w-full max-w-[420px] flex-col items-center gap-4 text-center">
        <img
          src="/assets/detective.png"
          alt="Detective"
          width={192}
          height={192}
          className="h-[192px] w-[192px] select-none"
          style={{ imageRendering: 'pixelated' }}
          draggable={false}
        />

        <div className="flex flex-col items-center gap-1">
          <h1 className="text-3xl font-extrabold tracking-wide text-[#f4f1de] sm:text-4xl">
            Detectivo
          </h1>
          <p className="text-lg font-semibold text-[#f2cc8f] sm:text-xl">{puzzleLabel}</p>
          <p className="text-sm text-[#c9d1e1] sm:text-base">4 suspects. 1 liar. 3 tries.</p>
        </div>

        <section className="w-full rounded-xl border border-[#2f3b52] bg-[#182235] px-4 py-3 shadow-sm">
          <p className="text-base font-semibold text-[#f4f1de] sm:text-lg">{status.statusText}</p>
          {status.solvedTodayText ? (
            <p className="mt-1 text-sm text-[#9fb0cf] sm:text-base">{status.solvedTodayText}</p>
          ) : null}
        </section>

        <button
          type="button"
          className="mt-1 flex h-14 w-full max-w-[320px] cursor-pointer items-center justify-center rounded-xl bg-[#e07a5f] px-6 text-lg font-bold text-[#101826] shadow-md transition-colors hover:bg-[#f08a70] active:bg-[#cc694f] sm:text-xl"
          onClick={(e) => requestExpandedMode(e.nativeEvent, 'game')}
        >
          Play
        </button>
      </main>
    </div>
  );
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Splash />
  </StrictMode>
);