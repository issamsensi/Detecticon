import Phaser from 'phaser';
import type { PublicPuzzle } from '../../../shared/types';
import type { GameState } from '../../../shared/game';
import { DETECTIVE_KEY } from '../assets';
import { createInterrogationBackdrop } from '../ui/backdrop';
import { createCharacter } from '../ui/Character';
import { createTextBlock } from '../ui/text';

export class IntroScene extends Phaser.Scene {
  private puzzle: PublicPuzzle;
  private state: GameState | undefined;

  constructor(puzzle: PublicPuzzle) {
    super('IntroScene');
    this.puzzle = puzzle;
  }

  public init(data: { state?: GameState; puzzle?: PublicPuzzle }): void {
    if (data.puzzle) {
      this.puzzle = data.puzzle;
    }
    this.state = data.state;
  }

  public create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#1b1f2a');
    createInterrogationBackdrop(this, this.puzzle.id, { simple: true });

    // Detective sprite: 64x64 at integer 2x scale (128px) for crisp pixel art in 360x640.
    createCharacter({
      scene: this,
      x: width / 2,
      y: 72,
      textureKey: DETECTIVE_KEY,
      fallbackColor: 0x81b29a,
      width: 56,
      height: 64,
      scale: 2,
    });

    this.add
      .text(width / 2, 150, 'Inspector Quill', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#a7b1c2',
      })
      .setOrigin(0.5);

    createTextBlock(this, {
      x: width / 2,
      y: 175,
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
      y: 245,
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

    const rankingButton = this.add
      .rectangle(width / 2, 470, 220, 40, 0x3d405b)
      .setStrokeStyle(2, 0xf4f1de)
      .setInteractive({ useHandCursor: true });
    const rankingText = this.add
      .text(width / 2, 470, 'Weekly ranking', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#f4f1de',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    const openLeaderboard = (): void => {
      this.scene.start('LeaderboardScene', {
        from: 'IntroScene',
        puzzleId: this.puzzle.id,
        puzzle: this.puzzle,
        state: this.state,
      });
    };
    rankingButton.on('pointerdown', openLeaderboard);
    rankingText.on('pointerdown', openLeaderboard);

    const button = this.add
      .rectangle(width / 2, height - 110, 220, 52, 0xe07a5f)
      .setStrokeStyle(4, 0xf4f1de)
      .setInteractive({ useHandCursor: true });

    const buttonText = this.add
      .text(width / 2, height - 110, 'Start', {
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

    const creditsButton = this.add
      .rectangle(width / 2, height - 58, 160, 36, 0x3d405b)
      .setStrokeStyle(2, 0xf4f1de)
      .setInteractive({ useHandCursor: true });
    const creditsText = this.add
      .text(width / 2, height - 58, 'Credits', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#f4f1de',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    const openCredits = (): void => {
      this.scene.start('CreditsScene');
    };
    creditsButton.on('pointerdown', openCredits);
    creditsText.on('pointerdown', openCredits);

    this.add
      .text(width / 2, height - 20, 'Tap Start to hear testimonies', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#a7b1c2',
      })
      .setOrigin(0.5);
  }
}
