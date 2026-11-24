import './index.css';

import { requestExpandedMode } from '@devvit/web/client';
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MAX_ATTEMPTS } from '../shared/scoring';

type StatusState = {
  puzzleNumber?: number;
  puzzleTitle?: string;
  statusText: string;
  ctaText: string;
  solvedTodayText?: string;
  practice?: boolean;
};

const defaultStatus: StatusState = {
  statusText: 'New case today',
  ctaText: 'Play',
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
            puzzle: { title: string };
            state: {
              puzzleNumber: number;
              attemptsUsed: number;
              attemptsLeft: number;
              finished: boolean;
              solved: boolean;
              practice: boolean;
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

        const {
          puzzleNumber,
          attemptsUsed,
          attemptsLeft,
          finished,
          solved,
          practice,
        } = today.state;
        const solvedToday = stats
          ? stats.stats.solved1 + stats.stats.solved2 + stats.stats.solved3
          : null;

        let statusText = 'New case today';
        let ctaText = 'Play';
        if (finished) {
          statusText = solved ? `Solved in ${attemptsUsed}/${MAX_ATTEMPTS}` : 'Case failed';
          ctaText = 'View result';
        } else if (attemptsUsed > 0) {
          const triesLeft = attemptsLeft ?? Math.max(0, MAX_ATTEMPTS - attemptsUsed);
          statusText = `In progress · ${triesLeft} ${triesLeft === 1 ? 'try' : 'tries'} left`;
          ctaText = 'Resume';
        }

        const solvedLabel =
          solvedToday != null
            ? practice
              ? `${solvedToday} solved`
              : `${solvedToday} solved today`
            : undefined;

        setStatus({
          puzzleNumber,
          puzzleTitle: today.puzzle.title,
          statusText,
          ctaText,
          practice,
          ...(solvedLabel ? { solvedTodayText: solvedLabel } : {}),
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

  const puzzleLabel = status.puzzleNumber
    ? `Puzzle #${status.puzzleNumber}${status.puzzleTitle ? `: ${status.puzzleTitle}` : ''}`
    : 'Puzzle #—';
  const badge = status.practice ? 'Practice: no points' : null;

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#101826] px-4 py-3 text-[#f4f1de]">
      <main className="flex w-full max-w-[420px] flex-col items-center gap-2.5 text-center">
        <img
          src="/assets/detective.png"
          alt="Detective"
          width={144}
          height={144}
          className="h-28 w-28 select-none sm:h-36 sm:w-36"
          style={{ imageRendering: 'pixelated' }}
          draggable={false}
        />

        <div className="flex flex-col items-center gap-0.5">
          <h1 className="text-2xl font-extrabold tracking-wide text-[#f4f1de] sm:text-3xl">
            Detecticon
          </h1>
          <p className="text-base font-semibold text-[#f2cc8f] sm:text-lg">{puzzleLabel}</p>
          <p className="text-sm text-[#c9d1e1] sm:text-base">
            4 suspects. 1 liar. {MAX_ATTEMPTS} tries.
          </p>
          {badge ? (
            <p className="text-xs font-semibold text-[#e07a5f] sm:text-sm">{badge}</p>
          ) : null}
        </div>

        <section className="w-full rounded-xl border border-[#2f3b52] bg-[#182235] px-4 py-2.5 shadow-sm">
          <p className="text-base font-semibold text-[#f4f1de] sm:text-lg">{status.statusText}</p>
          {status.solvedTodayText ? (
            <p className="mt-0.5 text-sm text-[#9fb0cf] sm:text-base">{status.solvedTodayText}</p>
          ) : null}
        </section>

        <button
          type="button"
          className="mt-0.5 flex h-12 w-full max-w-[320px] cursor-pointer items-center justify-center rounded-xl bg-[#e07a5f] px-6 text-lg font-bold text-[#101826] shadow-md transition-colors hover:bg-[#f08a70] active:bg-[#cc694f] sm:h-14 sm:text-xl"
          onClick={(e) => requestExpandedMode(e.nativeEvent, 'game')}
        >
          {status.ctaText}
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