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
  headerTop: 26,
  headerHeight: 158,
  detective: 56,
  title: 99,
  culprit: 125,
  attempts: 148,
  badges: 170,

  shareCard: 222,
  shareCardHeight: 48,

  statsBox: 308,
  statsHeight: 96,
  statsHeading: 278,
  statsCounts: 318,
  barBaseline: 325,
  statsLabels: 333,

  countdown: 382,

  rankingButton: 433,
  postButton: 489,
  feedback: 520,
  cancelHint: 556,
  footer: 548,
  footerExpanded: 590,
} as const;

const PANEL_WIDTH = 312;
const PANEL_PADDING = 24;
const BAR_WIDTH = 36;
const BUTTON_WIDTH = 250;
const BUTTON_HEIGHT = 44;
const SHARE_TEXT_WIDTH = PANEL_WIDTH - 2 * (PANEL_PADDING + 4);

export class ResultScene extends Phaser.Scene {
  private countdownText: Phaser.GameObjects.Text | undefined;
  private countdownEvent: Phaser.Time.TimerEvent | undefined;
  private targetResetMs: number | undefined;
  private statsCountText: Phaser.GameObjects.Text | undefined;

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

    this.addPanel(centerX, Y.headerTop + Y.headerHeight / 2, Y.headerHeight, 0x141926, 0x3d405b);

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
    const statsLeft = centerX - PANEL_WIDTH / 2 + PANEL_PADDING;
    const statsRight = centerX + PANEL_WIDTH / 2 - PANEL_PADDING;
    const statsHeadingStyle = {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#f2cc8f',
    };

    this.add.text(statsLeft, Y.statsHeading, 'Detectives today', statsHeadingStyle).setOrigin(0, 0.5);
    this.statsCountText = this.add
      .text(statsRight, Y.statsHeading, '', statsHeadingStyle)
      .setOrigin(1, 0.5);
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

    if (currentState.practice) {
      this.targetResetMs = undefined;
      this.countdownText.setText('Archive case');
    } else {
      const now = new Date();
      this.targetResetMs = Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + 1,
        0,
        0,
        0,
        0
      );
      this.updateCountdown();
      if (Date.now() < this.targetResetMs) {
        this.countdownEvent = this.time.addEvent({
          delay: 1000,
          loop: true,
          callback: () => this.updateCountdown(),
        });
      }
    }
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
      .setOrigin(0.5, 0);

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
      .setOrigin(0.5, 0)
      .setInteractive({ useHandCursor: true });

    const footerText = this.add
      .text(centerX, Y.footer, solved ? 'Nice work, Inspector.' : 'Better luck next case.', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#a7b1c2',
      })
      .setOrigin(0.5);

    const setFeedback = (text: string, color?: string): void => {
      if (color) {
        feedback.setColor(color);
      }
      feedback.setText(text);
      footerText.setY(text.length > 0 ? Y.footerExpanded : Y.footer);
    };

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
      setFeedback('');
    };
    cancelText.on('pointerdown', cancelConfirm);

    const handlePostTap = async (): Promise<void> => {
      if (posting || noPoints || currentState.sharedToComments) return;
      if (!confirming) {
        confirming = true;
        postLabel.setText('Confirm post');
        cancelText.setText('Tap here to cancel');
        setFeedback(`Post "${shareText}" as a comment?`, '#f2cc8f');
        return;
      }

      posting = true;
      confirming = false;
      cancelText.setText('');
      setPostEnabled(false);
      postLabel.setText('Posting...');
      setFeedback('Posting to comments...', '#a7b1c2');

      try {
        const response = await shareResult(currentState.puzzleId);
        currentState = response.state;
        markPosted();
        setFeedback('Posted to comments!', '#81b29a');
      } catch (error) {
        posting = false;
        resetPostButton();
        if (error instanceof ApiError && error.status === 401) {
          setFeedback('Log in to Reddit to post your result.', '#f2cc8f');
        } else if (error instanceof ApiError && error.status === 409) {
          // Already posted from another session - keep it one per player per puzzle.
          markPosted();
          setFeedback('Result already posted to comments.', '#81b29a');
        } else if (error instanceof NetworkError || error instanceof TypeError) {
          setFeedback('Could not post (connection problem). Tap to try again.', '#e07a5f');
        } else {
          const message = error instanceof Error ? error.message : 'Could not post to comments';
          setFeedback(`${message}.`, '#e07a5f');
        }
      }
    };

    const onPostTap = (): void => {
      void handlePostTap();
    };
    postButton.on('pointerdown', onPostTap);
    postLabel.on('pointerdown', onPostTap);
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
      if (!this.scene.isActive()) {
        return;
      }
      this.add
        .text(this.scale.width / 2, Y.barBaseline, 'Stats unavailable', {
          fontFamily: 'monospace',
          fontSize: '12px',
          color: '#a7b1c2',
        })
        .setOrigin(0.5);
    }
  }

  private drawStats(
    stats: StatsResponse['stats'],
    highlight: keyof StatsResponse['stats'] | null
  ): void {
    const { width } = this.scale;
    const total = stats.solved1 + stats.solved2 + stats.solved3 + stats.failed;
    const entries: Array<{ key: keyof StatsResponse['stats']; label: string }> = [
      { key: 'solved1', label: '1 try' },
      { key: 'solved2', label: '2 tries' },
      { key: 'solved3', label: '3 tries' },
      { key: 'failed', label: 'Failed' },
    ];

    this.statsCountText?.setText(String(total));

    const slotWidth = (PANEL_WIDTH - 2 * PANEL_PADDING) / entries.length;
    const firstX = width / 2 - PANEL_WIDTH / 2 + PANEL_PADDING;
    entries.forEach((entry, index) => {
      const x = firstX + slotWidth * (index + 0.5);
      const count = stats[entry.key];
      const mine = highlight === entry.key;
      const labelColor = mine ? '#f4f1de' : '#a7b1c2';

      this.add
        .text(x, Y.statsCounts, String(count), {
          fontFamily: 'monospace',
          fontSize: '12px',
          color: mine ? '#f4f1de' : '#d9dde7',
        })
        .setOrigin(0.5, 1);
      this.add
        .rectangle(x, Y.barBaseline, BAR_WIDTH, mine ? 3 : 2, mine ? 0xf4f1de : 0x6b7280)
        .setOrigin(0.5, 0.5);
      this.add
        .text(x, Y.statsLabels, entry.label, {
          fontFamily: 'monospace',
          fontSize: '10px',
          color: labelColor,
        })
        .setOrigin(0.5, 0);
    });
  }

  private updateCountdown(): void {
    if (!this.countdownText || this.targetResetMs === undefined) {
      return;
    }
    const diffMs = this.targetResetMs - Date.now();
    if (diffMs <= 0) {
      this.countdownEvent?.remove(false);
      this.countdownEvent = undefined;
      this.countdownText.setText('New puzzle is live in the subreddit!');
      return;
    }
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
