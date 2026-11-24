import Phaser from 'phaser';
import type { PublicPuzzle, PublicSuspect } from '../../../shared/types';
import type { GameState } from '../../../shared/game';
import { createInitialGameState } from '../../../shared/game';
import { getSuspectSpriteKey } from '../assets';
import { createInterrogationBackdrop } from '../ui/backdrop';
import { createCharacter, type Character } from '../ui/Character';
import { createSpeechBubble, type SpeechBubble } from '../ui/text';

// Fixed 360x640 layout. The bubble is anchored to the sprite's visible head:
// its bottom stays put and longer text grows the bubble upward toward the counter.
const COUNTER_Y = 26;
const COUNTER_PLATE_HEIGHT = 26;
const BUBBLE_MAX_WIDTH = 320;
const BUBBLE_PADDING = 14;
const BUBBLE_MIN_HEIGHT = 84;
const TAIL_HEIGHT = 14;
const SPRITE_X = 150;
const SPRITE_Y = 440;
const SPRITE_SCALE = 3;
const SPRITE_FRAME = 64;
const HEAD_PADDING = 12; // transparent pixels above the head in each 64x64 frame
const HEAD_GAP = 6; // gap between tail tip and the visible head
const MIN_COUNTER_GAP = 50; // minimum space between counter plate and bubble top
const HEIGHT_SAFETY = 8; // margin for stroke/rounding when enforcing MIN_COUNTER_GAP
const PLATE_Y = 570;
const HINT_Y = 618;

const SPRITE_TOP = SPRITE_Y - (SPRITE_FRAME * SPRITE_SCALE) / 2; // 344
const VISIBLE_HEAD_TOP = SPRITE_TOP + HEAD_PADDING * SPRITE_SCALE; // 380
const TAIL_TIP_Y = VISIBLE_HEAD_TOP - HEAD_GAP; // 374
const BUBBLE_BOTTOM_Y = TAIL_TIP_Y - TAIL_HEIGHT; // 360
const COUNTER_PLATE_BOTTOM = COUNTER_Y + COUNTER_PLATE_HEIGHT / 2; // 39
const BUBBLE_MAX_HEIGHT =
  BUBBLE_BOTTOM_Y - (COUNTER_PLATE_BOTTOM + MIN_COUNTER_GAP) - HEIGHT_SAFETY; // 263

export class TestimonyScene extends Phaser.Scene {
  private puzzle: PublicPuzzle;
  private suspectIndex = 0;
  private bubble: SpeechBubble | null = null;
  private nameText!: Phaser.GameObjects.Text;
  private roleText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private portrait: Character | null = null;
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
    createInterrogationBackdrop(this, this.puzzle.id);

    // Small "Suspect N of 4" counter at the top, on its own plate for legibility.
    this.add.rectangle(width / 2, COUNTER_Y, 164, 26, 0x1b1f2a).setStrokeStyle(2, 0x3d405b);
    this.progressText = this.add
      .text(width / 2, COUNTER_Y, '', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#f2cc8f',
      })
      .setOrigin(0.5);

    // Name/role plate just under the sprite.
    this.add.rectangle(SPRITE_X, PLATE_Y, 216, 46, 0x1b1f2a).setStrokeStyle(3, 0x3d405b);
    this.nameText = this.add
      .text(SPRITE_X, PLATE_Y - 8, '', {
        fontFamily: 'monospace',
        fontSize: '17px',
        color: '#f4f1de',
      })
      .setOrigin(0.5);
    this.roleText = this.add
      .text(SPRITE_X, PLATE_Y + 12, '', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#a7b1c2',
      })
      .setOrigin(0.5);

    this.hintText = this.add
      .text(width / 2, HINT_Y, 'tap to continue', {
        fontFamily: 'monospace',
        fontSize: '13px',
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

    this.events.on(Phaser.Scenes.Events.UPDATE, this.syncTalking, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off(Phaser.Scenes.Events.UPDATE, this.syncTalking, this);
      if (this.bubble) {
        this.bubble.destroy();
        this.bubble = null;
      }
      if (this.portrait) {
        this.portrait.destroy();
        this.portrait = null;
      }
    });

    this.suspectIndex = 0;
    this.done = false;
    this.showSuspect(this.puzzle.suspects[this.suspectIndex]);
  }

  private syncTalking = (): void => {
    if (!this.portrait) return;
    this.portrait.setTalking(!!this.bubble?.isTyping());
  };

  private handleAdvance(): void {
    if (this.done || !this.bubble) {
      return;
    }

    if (this.bubble.isTyping()) {
      this.bubble.skip();
      this.portrait?.setTalking(false);
      return;
    }

    if (this.suspectIndex < this.puzzle.suspects.length - 1) {
      this.suspectIndex += 1;
      this.showSuspect(this.puzzle.suspects[this.suspectIndex]);
      return;
    }

    this.done = true;
    this.portrait?.setTalking(false);
    this.scene.start('AccuseScene', { state: this.state });
  }

  private showSuspect(suspect: PublicSuspect | undefined): void {
    if (!suspect) {
      return;
    }

    this.progressText.setText(
      `Suspect ${this.suspectIndex + 1} of ${this.puzzle.suspects.length}`
    );
    this.nameText.setText(suspect.name);
    this.roleText.setText(suspect.role);

    if (this.portrait) {
      this.portrait.destroy();
    }
    // 64x64 sprite at integer 3x scale (192px) in the lower scene area.
    this.portrait = createCharacter({
      scene: this,
      x: SPRITE_X,
      y: SPRITE_Y,
      textureKey: getSuspectSpriteKey(this.puzzle.id, this.suspectIndex, suspect.name),
      fallbackColor: suspect.color,
      width: 64 * SPRITE_SCALE,
      height: 64 * SPRITE_SCALE,
      scale: SPRITE_SCALE,
    });

    if (this.bubble) {
      this.bubble.destroy();
    }

    // Auto-sized bubble anchored to the sprite's visible head: its bottom (and
    // tail tip) stay put while longer text grows the bubble upward.
    this.bubble = createSpeechBubble(this, {
      x: (this.scale.width - BUBBLE_MAX_WIDTH) / 2,
      bottomY: BUBBLE_BOTTOM_Y,
      width: BUBBLE_MAX_WIDTH,
      centerX: true,
      padding: BUBBLE_PADDING,
      minHeight: BUBBLE_MIN_HEIGHT,
      maxHeight: BUBBLE_MAX_HEIGHT,
      text: suspect.testimony,
      tail: {
        direction: 'down',
        x: SPRITE_X,
        width: 26,
        height: TAIL_HEIGHT,
      },
      textStyle: {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#1b1f2a',
        lineSpacing: 4,
        wordWrap: { width: BUBBLE_MAX_WIDTH - BUBBLE_PADDING * 2 },
      },
      typewriter: {
        speedMs: 28,
      },
    });
    this.portrait.setTalking(true);
  }
}
