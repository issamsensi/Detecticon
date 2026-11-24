import Phaser from 'phaser';
import { buildShareText, type GameState } from '../../../shared/game';
import { formatPointsEarned } from '../../../shared/scoring';
import { ApiError, NetworkError, fetchTodayStats, shareResult, type StatsResponse } from '../api';
import { DETECTIVE_KEY } from '../assets';
import { createInterrogationBackdrop } from '../ui/backdrop';
import { createCharacter } from '../ui/Character';

/**
 * Fixed 360x640 layout. Every `y` below is a vertical centre unless its name
 * says "top" or "baseline". Panels are stacked with at least a 6px gap, so
 * wrapped text and long values cannot push into the next section.
 */
const Y = {
  headerTop: 8,
  headerHeight: 150,
  detective: 38,
  title: 80,
  culprit: 105,
  attempts: 128,
  badges: 148,

  shareCard: 186,
  shareCardHeight: 44,

  statsBox: 260,
  statsHeight: 86,
  statsHeading: 230,
  barBaseline: 278,
  statsLabels: 284,

  countdown: 322,
  feedback: 352,

  rankingButton: 404,
  postButton: 460,
  cancelHint: 498,
  footer: 620,
} as const;

const PANEL_WIDTH = 312;
const PANEL_PADDING = 24;
const BAR_WIDTH = 36;
const BAR_MAX_HEIGHT = 38;
const BUTTON_WIDTH = 250;
const BUTTON_HEIGHT = 44;
const SHARE_TEXT_WIDTH = PANEL_WIDTH - 2 * (PANEL_PADDING + 4);

export class ResultScene extends Phaser.Scene {
  private countdownText: Phaser.GameObjects.Text | undefined;
  private countdownEvent: Phaser.Time.TimerEvent | undefined;
  private statsTitleText: Phaser.GameObjects.Text | undefined;

  constructor() {
    super('ResultScene');
  }

  public create(data: { state: GameState }): void {
    let currentState = data.state;
    const { width } = this.scale;
    const centerX = width / 2;

    this.cameras.main.setBackgroundColor('#1b1f2a');
    createInterrogationBackdrop(this, currentState.puzzleId, { simple: true });

    const solved = currentState.solved;
    const shareText = currentState.shareText ?? buildShareText(currentState);

    this.addPanel(centerX, Y.headerTop, Y.headerHeight, 0x141926, 0x3d405b);

    // Only draw the detective sprite when it loaded: no green fallback square.
    if (this.textures.exists(DETECTIVE_KEY)) {
      createCharacter({
        scene: this,
        x: centerX,
        y: Y.detective,
        textureKey: DETECTIVE_KEY,
        fallbackColor: 0x141926,
        width: 48,
        height: 48,
        displayWidth: 48,
        displayHeight: 48,
      });
    }

    this.add
      .text(centerX, Y.title, solved ? 'Case Solved' : 'Case Closed', {
        fontFamily: 'monospace',
        fontSize: '26px',
        color: solved ? '#81b29a' : '#e07a5f',
      })
      .setOrigin(0.5);

    if (currentState.culprit) {
      this.add
        .text(centerX, Y.culprit, `Culprit: ${currentState.culprit.name}`, {
          fontFamily: 'monospace',
          fontSize: '14px',
          color: '#a7b1c2',
          align: 'center',
          wordWrap: { width: PANEL_WIDTH - 2 * PANEL_PADDING },
        })
        .setOrigin(0.5);
    }

    // One line, always in the same slot: attempts used and points earned.
    this.add
      .text(
        centerX,
        Y.attempts,
        `Attempts ${currentState.attemptsUsed}/3 · +${formatPointsEarned(currentState.pointsEarned)}`,
        {
          fontFamily: 'monospace',
          fontSize: '17px',
          color: '#f4f1de',
          align: 'center',
          wordWrap: { width: PANEL_WIDTH - 16 },
        }
      )
      .setOrigin(0.5);

    const noPoints = currentState.practice || currentState.devOverride;
    const badges = [
      currentState.practice ? 'Practice: no points' : null,
      currentState.devOverride ? 'Dev: test puzzle · no points' : null,
    ].filter((badge): badge is string => badge !== null);
    if (badges.length > 0) {
      this.add
        .text(centerX, Y.badges, badges.join(' · '), {
          fontFamily: 'monospace',
          fontSize: '12px',
          color: '#e07a5f',
          align: 'center',
          wordWrap: { width: PANEL_WIDTH - 16 },
        })
        .setOrigin(0.5);
    }

    this.addPanel(centerX, Y.shareCard, Y.shareCardHeight, 0xf4f1de, 0x3d405b);
    this.add
      .text(centerX, Y.shareCard, shareText, {
        fontFamily: 'monospace',
        fontSize: '17px',
        color: '#1b1f2a',
        align: 'center',
        wordWrap: { width: SHARE_TEXT_WIDTH },
      })
      .setOrigin(0.5);

    this.addPanel(centerX, Y.statsBox, Y.statsHeight, 0x141926, 0x6b7280);
    this.statsTitleText = this.add
      .text(centerX, Y.statsHeading, 'Detectives today: —', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#f2cc8f',
      })
      .setOrigin(0.5);
    void this.loadStats(currentState);

    this.countdownText = this.add
      .text(centerX, Y.countdown, '', {
        fontFamily: 'monospace',
        fontSize: '15px',
        color: '#f2cc8f',
        align: 'center',
        wordWrap: { width: PANEL_WIDTH },
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
      .text(centerX, Y.feedback, '', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#81b29a',
        align: 'center',
        wordWrap: { width: PANEL_WIDTH },
      })
      .setOrigin(0.5);

    const rankingButton = this.add
      .rectangle(centerX, Y.rankingButton, BUTTON_WIDTH, BUTTON_HEIGHT, 0x3d405b)
      .setStrokeStyle(2, 0xf4f1de)
      .setInteractive({ useHandCursor: true });
    const rankingLabel = this.add
      .text(centerX, Y.rankingButton, 'Weekly ranking', {
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

    // No "Copy result" button: the clipboard API is not reliable in the Reddit
    // webview, so "Post to comments" is the only sharing action offered.
    const postButton = this.add
      .rectangle(centerX, Y.postButton, BUTTON_WIDTH, BUTTON_HEIGHT, 0xe07a5f)
      .setStrokeStyle(3, 0xf4f1de);
    const postLabel = this.add
      .text(centerX, Y.postButton, 'Post to comments', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#1b1f2a',
      })
      .setOrigin(0.5);
    const cancelText = this.add
      .text(centerX, Y.cancelHint, '', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#a7b1c2',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    let posting = false;
    let confirming = false;
    const idlePostLabel = currentState.practice
      ? 'Practice: sharing off'
      : currentState.devOverride
        ? 'Dev: sharing off'
        : 'Post to comments';

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
      postLabel.setText(idlePostLabel);
      postButton.setFillStyle(0xe07a5f);
      setPostEnabled(!currentState.sharedToComments && !posting && !noPoints);
    };

    if (noPoints) {
      postLabel.setText(idlePostLabel);
      setPostEnabled(false);
    } else if (currentState.sharedToComments) {
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
      if (posting || noPoints || currentState.sharedToComments) return;
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
          // Already posted from another session - keep it one per player per puzzle.
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
      .text(centerX, Y.footer, solved ? 'Nice work, Inspector.' : 'Better luck next case.', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#a7b1c2',
      })
      .setOrigin(0.5);
  }

  private addPanel(
    centerX: number,
    centerY: number,
    height: number,
    fill: number,
    stroke: number
  ): Phaser.GameObjects.Rectangle {
    return this.add
      .rectangle(centerX, centerY, PANEL_WIDTH, height, fill)
      .setStrokeStyle(2, stroke);
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
      this.drawStats(stats, bucket);
    } catch {
      // No chart on fetch errors; the fixed box keeps its placeholder.
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

    this.statsTitleText?.setText(`Detectives today: ${total}`);

    const slotWidth = (PANEL_WIDTH - 2 * PANEL_PADDING) / entries.length;
    const firstX = width / 2 - PANEL_WIDTH / 2 + PANEL_PADDING;
    entries.forEach((entry, index) => {
      const x = firstX + slotWidth * (index + 0.5);
      const count = stats[entry.key];
      const barHeight = count === 0 ? 2 : Math.max(4, Math.round((count / max) * BAR_MAX_HEIGHT));
      const top = Y.barBaseline - barHeight;
      const mine = highlight === entry.key;
      const color = mine ? '#f4f1de' : '#a7b1c2';

      this.add
        .rectangle(x, top, BAR_WIDTH, barHeight, 0x3d405b)
        .setOrigin(0.5, 1)
        .setStrokeStyle(mine ? 2 : 1, mine ? 0xf4f1de : 0x6b7280);
      this.add
        .text(x, Math.max(top + 2, Y.barBaseline - 15), String(count), {
          fontFamily: 'monospace',
          fontSize: '10px',
          color: '#f4f1de',
        })
        .setOrigin(0.5, 0);
      this.add
        .text(x, Y.statsLabels, entry.label, {
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
