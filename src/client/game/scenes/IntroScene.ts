import Phaser from 'phaser';
import type { PublicPuzzle } from '../../../shared/types';
import type { GameState } from '../../../shared/game';
import { createTextBlock } from '../ui/text';

export class IntroScene extends Phaser.Scene {
  private readonly puzzle: PublicPuzzle;
  private state: GameState | undefined;

  constructor(puzzle: PublicPuzzle) {
    super('IntroScene');
    this.puzzle = puzzle;
  }

  public init(data: { state?: GameState }): void {
    this.state = data.state;
  }

  public create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#1b1f2a');

    this.add
      .text(width / 2, 72, 'Inspector Quill', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#a7b1c2',
      })
      .setOrigin(0.5);

    createTextBlock(this, {
      x: width / 2,
      y: 150,
      text: this.puzzle.title,
      maxWidth: width - 48,
      style: {
        fontFamily: 'monospace',
        fontSize: '28px',
        color: '#f4f1de',
        align: 'center',
        wordWrap: { width: width - 48 },
      },
      originX: 0.5,
      originY: 0,
    });

    createTextBlock(this, {
      x: 24,
      y: 220,
      text: this.puzzle.scene,
      maxWidth: width - 48,
      style: {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#d9dde7',
        lineSpacing: 6,
        wordWrap: { width: width - 48 },
      },
      originX: 0,
      originY: 0,
    });

    const button = this.add
      .rectangle(width / 2, height - 90, 220, 56, 0xe07a5f)
      .setStrokeStyle(4, 0xf4f1de)
      .setInteractive({ useHandCursor: true });

    const buttonText = this.add
      .text(width / 2, height - 90, 'Start', {
        fontFamily: 'monospace',
        fontSize: '24px',
        color: '#1b1f2a',
      })
      .setOrigin(0.5);

    const start = (): void => {
      if (this.state && (this.state.attemptsUsed > 0 || this.state.finished)) {
        this.scene.start('AccuseScene', { state: this.state });
      } else {
        this.scene.start('TestimonyScene', { state: this.state });
      }
    };

    button.on('pointerdown', start);
    buttonText.setInteractive({ useHandCursor: true });
    buttonText.on('pointerdown', start);

    this.add
      .text(width / 2, height - 40, 'Tap Start to hear testimonies', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#a7b1c2',
      })
      .setOrigin(0.5);
  }
}
