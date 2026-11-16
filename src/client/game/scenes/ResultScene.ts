import Phaser from 'phaser';
import { buildShareText, type GameState } from '../../../shared/game';

export class ResultScene extends Phaser.Scene {
  private countdownText: Phaser.GameObjects.Text | undefined;
  private countdownEvent: Phaser.Time.TimerEvent | undefined;

  constructor() {
    super('ResultScene');
  }

  public create(data: { state: GameState }): void {
    const { state } = data;
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#1b1f2a');

    const solved = state.solved;
    const shareText = state.shareText ?? buildShareText(state);

    this.add
      .text(width / 2, 60, solved ? 'Case Solved' : 'Case Closed', {
        fontFamily: 'monospace',
        fontSize: '34px',
        color: solved ? '#81b29a' : '#e07a5f',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, 112, `Attempts used: ${state.attemptsUsed} / 3`, {
        fontFamily: 'monospace',
        fontSize: '22px',
        color: '#f4f1de',
      })
      .setOrigin(0.5);

    if (state.culprit) {
      this.add
        .text(width / 2, 150, `Culprit: ${state.culprit.name}`, {
          fontFamily: 'monospace',
          fontSize: '18px',
          color: '#a7b1c2',
          align: 'center',
          wordWrap: { width: width - 40 },
        })
        .setOrigin(0.5);
    }

    this.add
      .rectangle(width / 2, 250, width - 48, 90, 0xf4f1de)
      .setStrokeStyle(4, 0x3d405b);

    this.add
      .text(width / 2, 250, shareText, {
        fontFamily: 'monospace',
        fontSize: '22px',
        color: '#1b1f2a',
        align: 'center',
        wordWrap: { width: width - 72 },
      })
      .setOrigin(0.5);

    this.countdownText = this.add
      .text(width / 2, 330, '', {
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
      .text(width / 2, height - 150, '', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#81b29a',
      })
      .setOrigin(0.5);

    const button = this.add
      .rectangle(width / 2, height - 90, 240, 56, 0x81b29a)
      .setStrokeStyle(4, 0xf4f1de)
      .setInteractive({ useHandCursor: true });

    this.add
      .text(width / 2, height - 90, 'Copy result', {
        fontFamily: 'monospace',
        fontSize: '22px',
        color: '#1b1f2a',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        void copyResult(shareText, feedback);
      });

    button.on('pointerdown', () => {
      void copyResult(shareText, feedback);
    });

    this.add
      .text(width / 2, height - 36, solved ? 'Nice work, Inspector.' : 'Better luck next case.', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#a7b1c2',
      })
      .setOrigin(0.5);
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

const copyResult = async (
  shareText: string,
  feedback: Phaser.GameObjects.Text
): Promise<void> => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(shareText);
      feedback.setColor('#81b29a');
      feedback.setText('Copied!');
      return;
    }
  } catch {
    // fall through to fallback message
  }
  feedback.setColor('#f2cc8f');
  feedback.setText('Copy not available here');
};
