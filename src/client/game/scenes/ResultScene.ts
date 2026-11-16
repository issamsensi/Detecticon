import Phaser from 'phaser';
import { buildShareText, type GameState } from '../../../shared/game';

export class ResultScene extends Phaser.Scene {
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
      .text(width / 2, 70, solved ? 'Case Solved' : 'Case Closed', {
        fontFamily: 'monospace',
        fontSize: '34px',
        color: solved ? '#81b29a' : '#e07a5f',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, 130, `Attempts used: ${state.attemptsUsed} / 3`, {
        fontFamily: 'monospace',
        fontSize: '22px',
        color: '#f4f1de',
      })
      .setOrigin(0.5);

    if (state.culprit) {
      this.add
        .text(width / 2, 175, `Culprit: ${state.culprit.name}`, {
          fontFamily: 'monospace',
          fontSize: '18px',
          color: '#a7b1c2',
          align: 'center',
          wordWrap: { width: width - 40 },
        })
        .setOrigin(0.5);
    }

    this.add
      .rectangle(width / 2, 290, width - 48, 90, 0xf4f1de)
      .setStrokeStyle(4, 0x3d405b);

    this.add
      .text(width / 2, 290, shareText, {
        fontFamily: 'monospace',
        fontSize: '22px',
        color: '#1b1f2a',
        align: 'center',
        wordWrap: { width: width - 72 },
      })
      .setOrigin(0.5);

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
