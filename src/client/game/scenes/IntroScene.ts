import Phaser from 'phaser';
import type { PublicPuzzle } from '../../../shared/types';
import type { GameState } from '../../../shared/game';
import { DETECTIVE_KEY } from '../assets';
import { createInterrogationBackdrop } from '../ui/backdrop';
import { createCharacter } from '../ui/Character';
import { createTextBlock } from '../ui/text';
import { fetchHowToSeen, markHowToSeen } from '../api';

const HOW_TO_LINES = [
  '1. Hear 4 testimonies.',
  '2. One suspect is lying.',
  '3. Three tries: 3 points on the 1st, 2 on the 2nd, 1 on the 3rd.',
];

type OverlayObject = Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Depth;

export class IntroScene extends Phaser.Scene {
  private puzzle: PublicPuzzle;
  private state: GameState | undefined;
  private overlayObjects: Phaser.GameObjects.GameObject[] = [];
  private closingHowTo = false;

  constructor(puzzle: PublicPuzzle) {
    super('IntroScene');
    this.puzzle = puzzle;
  }

  public init(data: { state?: GameState; puzzle?: PublicPuzzle }): void {
    if (data.puzzle) {
      this.puzzle = data.puzzle;
    }
    this.state = data.state;
    this.overlayObjects = [];
    this.closingHowTo = false;
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

    // Always-available help button; the overlay itself is on a higher depth.
    const helpButton = this.add
      .rectangle(width - 28, 26, 36, 36, 0x3d405b)
      .setStrokeStyle(2, 0xf4f1de)
      .setInteractive({ useHandCursor: true });
    const helpLabel = this.add
      .text(width - 28, 26, '?', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#f4f1de',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    helpButton.on('pointerdown', () => this.showHowTo());
    helpLabel.on('pointerdown', () => this.showHowTo());

    void this.checkHowTo();
  }

  private async checkHowTo(): Promise<void> {
    try {
      const { seen } = await fetchHowToSeen();
      if (!seen && this.scene.isActive()) {
        this.showHowTo();
      }
    } catch {
      // Treat a failed check as "not seen" so logged-out players still get it.
      if (this.scene.isActive()) {
        this.showHowTo();
      }
    }
  }

  private showHowTo(): void {
    if (this.overlayObjects.length > 0) {
      return;
    }
    const { width, height } = this.scale;
    const addOverlay = (object: OverlayObject, depth: number): void => {
      object.setDepth(depth);
      this.overlayObjects.push(object);
    };

    // Full-screen interactive shade swallows taps meant for the buttons below.
    const shade = this.add
      .rectangle(width / 2, height / 2, width, height, 0x1b1f2a, 0.94)
      .setInteractive();
    shade.on('pointerdown', () => undefined);
    addOverlay(shade, 100);

    addOverlay(
      this.add
        .rectangle(width / 2, 300, width - 24, 280, 0x2b3040)
        .setStrokeStyle(3, 0xf4f1de),
      101
    );
    addOverlay(
      this.add
        .text(width / 2, 196, 'How to play', {
          fontFamily: 'monospace',
          fontSize: '22px',
          color: '#f2cc8f',
        })
        .setOrigin(0.5),
      102
    );

    HOW_TO_LINES.forEach((line, index) => {
      addOverlay(
        this.add
          .text(24, 236 + index * 50, line, {
            fontFamily: 'monospace',
            fontSize: '13px',
            color: '#f4f1de',
            wordWrap: { width: width - 48 },
          })
          .setOrigin(0, 0),
        102
      );
    });

    const dismiss = (): void => {
      if (this.closingHowTo) {
        return;
      }
      this.closingHowTo = true;
      void this.dismissHowTo();
    };
    const gotItButton = this.add
      .rectangle(width / 2, 406, 180, 44, 0xe07a5f)
      .setStrokeStyle(3, 0xf4f1de)
      .setInteractive({ useHandCursor: true });
    const gotItLabel = this.add
      .text(width / 2, 406, 'Got it', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#1b1f2a',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    addOverlay(gotItButton, 102);
    addOverlay(gotItLabel, 103);
    gotItButton.on('pointerdown', dismiss);
    gotItLabel.on('pointerdown', dismiss);
  }

  private async dismissHowTo(): Promise<void> {
    try {
      await markHowToSeen();
    } catch {
      // Closing still works; the flag will be retried next time the overlay opens.
    }
    if (!this.scene.isActive()) {
      return;
    }
    for (const object of this.overlayObjects) {
      object.destroy();
    }
    this.overlayObjects = [];
    this.closingHowTo = false;
  }
}
