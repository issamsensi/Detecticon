import Phaser from 'phaser';
import type { PublicPuzzle, PublicSuspect } from '../../../shared/types';
import type { GameState } from '../../../shared/game';
import { createInitialGameState } from '../../../shared/game';
import { createSpeechBubble, type SpeechBubble } from '../ui/text';

export class TestimonyScene extends Phaser.Scene {
  private puzzle: PublicPuzzle;
  private suspectIndex = 0;
  private bubble: SpeechBubble | null = null;
  private nameText!: Phaser.GameObjects.Text;
  private roleText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private portrait!: Phaser.GameObjects.Rectangle;
  private progressText!: Phaser.GameObjects.Text;
  private done = false;
  private state!: GameState;

  constructor(puzzle: PublicPuzzle) {
    super('TestimonyScene');
    this.puzzle = puzzle;
  }

  public init(data: { state?: GameState; puzzle?: PublicPuzzle }): void {
    if (data.puzzle) {
      this.puzzle = data.puzzle;
    }
    this.state = data.state ?? createInitialGameState(this.puzzle.id, this.puzzle.number);
  }

  public create(): void {
    const { width } = this.scale;
    this.cameras.main.setBackgroundColor('#1b1f2a');

    this.progressText = this.add
      .text(width / 2, 28, '', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#a7b1c2',
      })
      .setOrigin(0.5);

    this.portrait = this.add.rectangle(width / 2, 170, 120, 120, 0xffffff);
    this.portrait.setStrokeStyle(4, 0xf4f1de);

    this.nameText = this.add
      .text(width / 2, 250, '', {
        fontFamily: 'monospace',
        fontSize: '24px',
        color: '#f4f1de',
      })
      .setOrigin(0.5);

    this.roleText = this.add
      .text(width / 2, 280, '', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#a7b1c2',
      })
      .setOrigin(0.5);

    this.hintText = this.add
      .text(width / 2, 610, 'tap to continue', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#f2cc8f',
      })
      .setOrigin(0.5);

    this.tweens.add({
      targets: this.hintText,
      alpha: 0.35,
      duration: 700,
      yoyo: true,
      repeat: -1,
    });

    this.input.on('pointerdown', () => {
      this.handleAdvance();
    });

    this.suspectIndex = 0;
    this.done = false;
    this.showSuspect(this.puzzle.suspects[this.suspectIndex]);
  }

  private handleAdvance(): void {
    if (this.done || !this.bubble) {
      return;
    }

    if (this.bubble.isTyping()) {
      this.bubble.skip();
      return;
    }

    if (this.suspectIndex < this.puzzle.suspects.length - 1) {
      this.suspectIndex += 1;
      this.showSuspect(this.puzzle.suspects[this.suspectIndex]);
      return;
    }

    this.done = true;
    console.log('testimonies done');
    this.scene.start('AccuseScene', { state: this.state });
  }

  private showSuspect(suspect: PublicSuspect | undefined): void {
    if (!suspect) {
      return;
    }

    this.progressText.setText(
      `Suspect ${this.suspectIndex + 1} of ${this.puzzle.suspects.length}`
    );
    this.portrait.setFillStyle(suspect.color);
    this.nameText.setText(suspect.name);
    this.roleText.setText(suspect.role);

    if (this.bubble) {
      this.bubble.destroy();
    }

    this.bubble = createSpeechBubble(this, {
      x: 24,
      y: 320,
      width: this.scale.width - 48,
      height: 220,
      text: suspect.testimony,
      padding: 16,
      textStyle: {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#1b1f2a',
        lineSpacing: 6,
        wordWrap: { width: this.scale.width - 80 },
      },
      typewriter: {
        speedMs: 28,
      },
    });
  }
}
