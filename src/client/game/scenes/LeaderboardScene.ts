import Phaser from 'phaser';
import type { GameState } from '../../../shared/game';
import type { LeaderboardResponse } from '../../../shared/leaderboard';
import { formatPointsEarned } from '../../../shared/scoring';
import { formatResetsIn } from '../../../shared/week';
import type { PublicPuzzle } from '../../../shared/types';
import { ApiError, NetworkError, fetchLeaderboard } from '../api';
import { createInterrogationBackdrop } from '../ui/backdrop';

type LeaderboardSceneData = {
  from: 'IntroScene' | 'ResultScene';
  puzzleId: string;
  puzzle?: PublicPuzzle;
  state?: GameState;
};

export class LeaderboardScene extends Phaser.Scene {
  private from: 'IntroScene' | 'ResultScene' = 'IntroScene';
  private puzzleId = '';
  private puzzle: PublicPuzzle | undefined;
  private state: GameState | undefined;
  private statusText!: Phaser.GameObjects.Text;
  private countdownText!: Phaser.GameObjects.Text;
  private countdownEvent: Phaser.Time.TimerEvent | undefined;
  private secondsLeft = 0;

  constructor() {
    super('LeaderboardScene');
  }

  public init(data: LeaderboardSceneData): void {
    this.from = data.from;
    this.puzzleId = data.puzzleId;
    this.puzzle = data.puzzle;
    this.state = data.state;
  }

  public create(): void {
    const { width } = this.scale;
    this.cameras.main.setBackgroundColor('#1b1f2a');
    createInterrogationBackdrop(this, this.puzzleId, { simple: true });

    this.add
      .text(width / 2, 28, 'Weekly ranking', {
        fontFamily: 'monospace',
        fontSize: '28px',
        color: '#f4f1de',
      })
      .setOrigin(0.5);

    this.statusText = this.add
      .text(width / 2, 64, 'This week (UTC)', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#a7b1c2',
      })
      .setOrigin(0.5);

    this.add
      .rectangle(16, 84, width - 32, 420, 0x2b3040, 0.92)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0x3d405b);

    this.countdownText = this.add
      .text(width / 2, 556, '', {
        fontFamily: 'monospace',
        fontSize: '15px',
        color: '#f2cc8f',
        align: 'center',
        wordWrap: { width: width - 32 },
      })
      .setOrigin(0.5);

    const backButton = this.add
      .rectangle(width / 2, 606, 180, 44, 0xe07a5f)
      .setStrokeStyle(3, 0xf4f1de)
      .setInteractive({ useHandCursor: true });
    const backLabel = this.add
      .text(width / 2, 606, 'Back', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#1b1f2a',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    const goBack = (): void => {
      if (this.from === 'ResultScene') {
        this.scene.start('ResultScene', { state: this.state });
      } else {
        this.scene.start('IntroScene', { puzzle: this.puzzle, state: this.state });
      }
    };
    backButton.on('pointerdown', goBack);
    backLabel.on('pointerdown', goBack);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.countdownEvent?.remove(false);
      this.countdownEvent = undefined;
    });

    void this.loadLeaderboard();
  }

  private async loadLeaderboard(): Promise<void> {
    this.statusText.setText('Loading rankings...');
    try {
      const board = await fetchLeaderboard();
      this.statusText.setText(`Week of ${board.weekId} (UTC)`);
      this.secondsLeft = board.secondsUntilReset;
      this.renderRows(board);
      this.updateCountdown();
      if (board.secondsUntilReset > 0) {
        this.countdownEvent = this.time.addEvent({
          delay: 1000,
          loop: true,
          callback: () => this.updateCountdown(),
        });
      }
    } catch (error) {
      const message = this.errorMessage(error);
      this.statusText.setText(message);
    }
  }

  private renderRows(board: LeaderboardResponse): void {
    const { width } = this.scale;
    const me = board.me;

    if (board.entries.length === 0) {
      this.add
        .text(width / 2, 280, 'No points yet this week.', {
          fontFamily: 'monospace',
          fontSize: '18px',
          color: '#d9dde7',
        })
        .setOrigin(0.5);
    }

    board.entries.forEach((entry, index) => {
      this.addRow(106 + index * 38, entry.rank, entry.username, entry.points, me?.rank === entry.rank);
    });

    // The API also returns the current player when they fall outside the top 10.
    if (me && !board.entries.some((entry) => entry.rank === me.rank)) {
      this.addRow(522, me.rank, `You (${me.username})`, me.points, true);
    }
  }

  private addRow(
    y: number,
    rank: number,
    username: string,
    points: number,
    highlight: boolean
  ): void {
    const { width } = this.scale;
    const panelX = 16;
    const panelW = width - 32;
    this.add
      .rectangle(panelX + 4, y, panelW - 8, 34, highlight ? 0x3d5a52 : 0x242a3c)
      .setOrigin(0, 0.5)
      .setStrokeStyle(highlight ? 2 : 1, highlight ? 0x81b29a : 0x3d405b);

    const style = {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: highlight ? '#f4f1de' : '#d9dde7',
    };
    this.add.text(panelX + 16, y, String(rank).padStart(2, '0'), style).setOrigin(0, 0.5);
    this.add.text(panelX + 58, y, username, style).setOrigin(0, 0.5);
    this.add
      .text(panelX + panelW - 16, y, formatPointsEarned(points), style)
      .setOrigin(1, 0.5);
  }

  private updateCountdown(): void {
    if (this.secondsLeft <= 0) {
      this.countdownEvent?.remove(false);
      this.countdownEvent = undefined;
      this.countdownText.setText('New week live — tap Back to refresh');
      return;
    }
    this.countdownText.setText(formatResetsIn(this.secondsLeft));
    this.secondsLeft = Math.max(0, this.secondsLeft - 1);
  }

  private errorMessage(error: unknown): string {
    if (error instanceof ApiError && error.status === 401) {
      return 'Log in to Reddit to see your ranking.';
    }
    if (error instanceof NetworkError) {
      return 'Could not load rankings (connection problem). Tap Back to retry.';
    }
    return 'Could not load rankings. Tap Back to retry.';
  }
}
