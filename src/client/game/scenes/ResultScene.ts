import Phaser from 'phaser';
import { buildShareText, type GameState } from '../../../shared/game';
import { formatPointsEarned } from '../../../shared/scoring';
import { ApiError, NetworkError, fetchTodayStats, shareResult, type StatsResponse } from '../api';
import { DETECTIVE_KEY } from '../assets';
import { createInterrogationBackdrop } from '../ui/backdrop';
import { createCharacter } from '../ui/Character';

const STATS_TITLE_Y = 250;
const BAR_BOTTOM_Y = 318;
const BAR_MAX_HEIGHT = 40;
const STATS_LABEL_Y = 324;

export class ResultScene extends Phaser.Scene {
  private countdownText: Phaser.GameObjects.Text | undefined;
  private countdownEvent: Phaser.Time.TimerEvent | undefined;

  constructor() {
    super('ResultScene');
  }

  public create(data: { state: GameState }): void {
    let currentState = data.state;
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#1b1f2a');
    createInterrogationBackdrop(this, currentState.puzzleId, { simple: true });

    const solved = currentState.solved;
    const shareText = currentState.shareText ?? buildShareText(currentState);

    createCharacter({
      scene: this,
      x: width / 2,
      y: 36,
      textureKey: DETECTIVE_KEY,
      fallbackColor: 0x81b29a,
      width: 48,
      height: 56,
      scale: 1,
    });

    this.add
      .text(width / 2, 84, solved ? 'Case Solved' : 'Case Closed', {
        fontFamily: 'monospace',
        fontSize: '32px',
        color: solved ? '#81b29a' : '#e07a5f',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, 118, `Attempts used: ${currentState.attemptsUsed} / 3`, {
        fontFamily: 'monospace',
        fontSize: '22px',
        color: '#f4f1de',
      })
      .setOrigin(0.5);

    if (currentState.culprit) {
      this.add
        .text(width / 2, 148, `Culprit: ${currentState.culprit.name}`, {
          fontFamily: 'monospace',
          fontSize: '18px',
          color: '#a7b1c2',
          align: 'center',
          wordWrap: { width: width - 40 },
        })
        .setOrigin(0.5);
    }

    this.add
      .text(width / 2, 172, `+${formatPointsEarned(currentState.pointsEarned)}`, {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#f2cc8f',
      })
      .setOrigin(0.5);

    this.add
      .rectangle(width / 2, 212, width - 48, 60, 0xf4f1de)
      .setStrokeStyle(4, 0x3d405b);

    this.add
      .text(width / 2, 212, shareText, {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#1b1f2a',
        align: 'center',
        wordWrap: { width: width - 72 },
      })
      .setOrigin(0.5);

    // Area y=250..336 is reserved for the stats chart; it stays blank when the
    // fetch fails or nobody has finished today's puzzle yet.
    void this.loadStats(currentState);

    this.countdownText = this.add
      .text(width / 2, 350, '', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#f2cc8f',
        align: 'center',
        wordWrap: { width: width - 40 },
      })
      .setOrigin(0.5);
    this.updateCountdown();
    this.countdownEvent = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => this.updateCountdown(),
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.countdownEvent?.remove(false);
      this.countdownEvent = undefined;
    });

    const feedback = this.add
      .text(width / 2, 382, '', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#81b29a',
        align: 'center',
        wordWrap: { width: width - 32 },
      })
      .setOrigin(0.5);

    const rankingButton = this.add
      .rectangle(width / 2, 448, 220, 44, 0x3d405b)
      .setStrokeStyle(2, 0xf4f1de)
      .setInteractive({ useHandCursor: true });
    const rankingLabel = this.add
      .text(width / 2, 448, 'Weekly ranking', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#f4f1de',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    const openLeaderboard = (): void => {
      this.scene.start('LeaderboardScene', {
        from: 'ResultScene',
        puzzleId: currentState.puzzleId,
        state: currentState,
      });
    };
    rankingButton.on('pointerdown', openLeaderboard);
    rankingLabel.on('pointerdown', openLeaderboard);

    // No "Copy result" button: the clipboard API isn't available in the Reddit
    // webview, so "Post to comments" is the only sharing action offered.
    // Post to comments (share text only: attempts + puzzle number). One post per player per puzzle.
    const postButton = this.add
      .rectangle(width / 2, height - 106, 240, 48, 0xe07a5f)
      .setStrokeStyle(4, 0xf4f1de);
    const postLabel = this.add
      .text(width / 2, height - 106, 'Post to comments', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#1b1f2a',
      })
      .setOrigin(0.5);
    const cancelText = this.add
      .text(width / 2, height - 66, '', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#a7b1c2',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    let posting = false;
    let confirming = false;

    const setPostEnabled = (enabled: boolean): void => {
      if (enabled) {
        postButton.setInteractive({ useHandCursor: true });
        postLabel.setInteractive({ useHandCursor: true });
        postButton.setAlpha(1);
        postLabel.setAlpha(1);
      } else {
        postButton.disableInteractive();
        postLabel.disableInteractive();
        postButton.setAlpha(0.7);
        postLabel.setAlpha(0.7);
      }
    };

    const markPosted = (): void => {
      confirming = false;
      cancelText.setText('');
      postLabel.setText('Posted to comments');
      postButton.setFillStyle(0x6b7280);
      setPostEnabled(false);
    };

    const resetPostButton = (): void => {
      confirming = false;
      cancelText.setText('');
      postLabel.setText('Post to comments');
      postButton.setFillStyle(0xe07a5f);
      setPostEnabled(!currentState.sharedToComments && !posting);
    };

    if (currentState.sharedToComments) {
      markPosted();
    } else {
      setPostEnabled(true);
    }

    const cancelConfirm = (): void => {
      if (posting) return;
      resetPostButton();
      feedback.setText('');
    };
    cancelText.on('pointerdown', cancelConfirm);

    const handlePostTap = async (): Promise<void> => {
      if (posting || currentState.sharedToComments) return;
      if (!confirming) {
        confirming = true;
        postLabel.setText('Confirm post');
        cancelText.setText('Tap here to cancel');
        feedback.setColor('#f2cc8f');
        feedback.setText(`Post "${shareText}" as a comment?`);
        return;
      }

      posting = true;
      confirming = false;
      cancelText.setText('');
      setPostEnabled(false);
      postLabel.setText('Posting...');
      feedback.setColor('#a7b1c2');
      feedback.setText('Posting to comments...');

      try {
        const response = await shareResult(currentState.puzzleId);
        currentState = response.state;
        markPosted();
        feedback.setColor('#81b29a');
        feedback.setText('Posted to comments!');
      } catch (error) {
        posting = false;
        resetPostButton();
        if (error instanceof ApiError && error.status === 401) {
          feedback.setColor('#f2cc8f');
          feedback.setText('Log in to Reddit to post your result.');
        } else if (error instanceof ApiError && error.status === 409) {
          // Already posted (e.g. from another session) - disable to enforce once per player per puzzle.
          markPosted();
          feedback.setColor('#81b29a');
          feedback.setText('Result already posted to comments.');
        } else if (error instanceof NetworkError || error instanceof TypeError) {
          feedback.setColor('#e07a5f');
          feedback.setText('Could not post (connection problem). Tap to try again.');
        } else {
          const message = error instanceof Error ? error.message : 'Could not post to comments';
          feedback.setColor('#e07a5f');
          feedback.setText(`${message}.`);
        }
      }
    };

    const onPostTap = (): void => {
      void handlePostTap();
    };
    postButton.on('pointerdown', onPostTap);
    postLabel.on('pointerdown', onPostTap);

    this.add
      .text(width / 2, height - 20, solved ? 'Nice work, Inspector.' : 'Better luck next case.', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#a7b1c2',
      })
      .setOrigin(0.5);
  }

  private ownStatBucket(state: GameState): keyof StatsResponse['stats'] | null {
    if (!state.finished) {
      return null;
    }
    if (state.solved) {
      if (state.attemptsUsed === 1) return 'solved1';
      if (state.attemptsUsed === 2) return 'solved2';
      return 'solved3';
    }
    return 'failed';
  }

  private async loadStats(state: GameState): Promise<void> {
    const bucket = this.ownStatBucket(state);
    try {
      const { stats } = await fetchTodayStats();
      if (!this.scene.isActive()) {
        return;
      }
      const total = stats.solved1 + stats.solved2 + stats.solved3 + stats.failed;
      if (total <= 0) {
        return;
      }
      this.drawStats(stats, bucket);
    } catch {
      // No chart on fetch errors; the reserved area just stays empty.
    }
  }

  private drawStats(
    stats: StatsResponse['stats'],
    highlight: keyof StatsResponse['stats'] | null
  ): void {
    const { width } = this.scale;
    const total = stats.solved1 + stats.solved2 + stats.solved3 + stats.failed;
    const max = Math.max(stats.solved1, stats.solved2, stats.solved3, stats.failed, 1);
    const entries: Array<{ key: keyof StatsResponse['stats']; label: string }> = [
      { key: 'solved1', label: '1 try' },
      { key: 'solved2', label: '2 tries' },
      { key: 'solved3', label: '3 tries' },
      { key: 'failed', label: 'Failed' },
    ];

    this.add
      .text(width / 2, STATS_TITLE_Y, `Today: ${total} players`, {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#f2cc8f',
      })
      .setOrigin(0.5);

    const slotWidth = (width - 48) / entries.length;
    entries.forEach((entry, index) => {
      const x = 24 + slotWidth * (index + 0.5);
      const count = stats[entry.key];
      const barHeight =
        count === 0 ? 2 : Math.max(4, Math.round((count / max) * BAR_MAX_HEIGHT));
      const top = BAR_BOTTOM_Y - barHeight;
      const mine = highlight === entry.key;
      const color = mine ? '#f4f1de' : '#a7b1c2';

      this.add
        .rectangle(x, top, 34, barHeight, mine ? 0x81b29a : 0x3d405b)
        .setOrigin(0.5, 1)
        .setStrokeStyle(mine ? 3 : 1, mine ? 0xf4f1de : 0x6b7280);
      this.add
        .text(x, top - 10, String(count), {
          fontFamily: 'monospace',
          fontSize: '11px',
          color,
        })
        .setOrigin(0.5, 1);
      this.add
        .text(x, STATS_LABEL_Y, entry.label, {
          fontFamily: 'monospace',
          fontSize: '10px',
          color,
        })
        .setOrigin(0.5, 0);
    });
  }

  private updateCountdown(): void {
    if (!this.countdownText) {
      return;
    }
    const now = new Date();
    const nextUtcMidnight = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1,
      0,
      0,
      0,
      0
    );
    const diffMs = Math.max(0, nextUtcMidnight - now.getTime());
    const totalSeconds = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const hh = String(hours).padStart(2, '0');
    const mm = String(minutes).padStart(2, '0');
    const ss = String(seconds).padStart(2, '0');
    this.countdownText.setText(`Next puzzle in ${hh}:${mm}:${ss}`);
  }
}

