import Phaser from 'phaser';
import type { GameState } from '../../../shared/game';
import type { PublicPuzzle, PublicSuspect } from '../../../shared/types';

type CaseFileSceneData = {
  puzzle: PublicPuzzle;
  state: GameState;
};

const CONTENT_X = 28;
const CONTENT_TOP = 78;
const CONTENT_BOTTOM = 510;
const INDICATOR_Y = 538;
const BUTTONS_Y = 594;

// Pagination instead of scrolling: GeometryMask is Canvas-only in Phaser 4, and
// fixed pages keep every control clear of the content on a 360x640 post.
export class CaseFileScene extends Phaser.Scene {
  private puzzle!: PublicPuzzle;
  private state!: GameState;
  private pageIndex = 0;
  private contentY = CONTENT_TOP;
  private pageObjects: Phaser.GameObjects.GameObject[] = [];
  private prevButton!: Phaser.GameObjects.Rectangle;
  private prevLabel!: Phaser.GameObjects.Text;
  private nextButton!: Phaser.GameObjects.Rectangle;
  private nextLabel!: Phaser.GameObjects.Text;
  private indicator!: Phaser.GameObjects.Text;

  constructor() {
    super('CaseFileScene');
  }

  public init(data: CaseFileSceneData): void {
    this.puzzle = data.puzzle;
    this.state = data.state;
    this.pageIndex = 0;
  }

  public create(): void {
    const { width } = this.scale;
    this.cameras.main.setBackgroundColor('#1b1f2a');

    this.add
      .text(width / 2, 24, 'Case file', {
        fontFamily: 'monospace',
        fontSize: '26px',
        color: '#f4f1de',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, 46, `Puzzle #${this.state.puzzleNumber} - ${this.puzzle.title}`, {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#a7b1c2',
        align: 'center',
        wordWrap: { width: width - 32 },
      })
      .setOrigin(0.5, 0);

    this.add
      .rectangle(16, 68, width - 32, 452, 0x2b3040, 0.92)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0x3d405b);

    this.indicator = this.add
      .text(width / 2, INDICATOR_Y, '', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#f2cc8f',
      })
      .setOrigin(0.5);

    const prev = this.makeButton(78, BUTTONS_Y, 92, 44, 'Prev', 0x3d405b, () =>
      this.changePage(-1)
    );
    this.prevButton = prev.rectangle;
    this.prevLabel = prev.label;

    const next = this.makeButton(282, BUTTONS_Y, 92, 44, 'Next', 0x81b29a, () =>
      this.changePage(1)
    );
    this.nextButton = next.rectangle;
    this.nextLabel = next.label;

    // Close is always rendered last (on top) and is never disabled by pagination.
    this.makeButton(width / 2, BUTTONS_Y, 120, 44, 'Close', 0xe07a5f, () => {
      this.scene.start('AccuseScene', { puzzle: this.puzzle, state: this.state });
    });

    this.renderPage();
  }

  private makeButton(
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    color: number,
    onClick: () => void
  ): { rectangle: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text } {
    const rectangle = this.add
      .rectangle(x, y, w, h, color)
      .setStrokeStyle(2, 0xf4f1de)
      .setInteractive({ useHandCursor: true });
    const text = this.add
      .text(x, y, label, {
        fontFamily: 'monospace',
        fontSize: '17px',
        color: '#1b1f2a',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    rectangle.on('pointerdown', onClick);
    text.on('pointerdown', onClick);
    return { rectangle, label: text };
  }

  private changePage(delta: number): void {
    const target = this.pageIndex + delta;
    if (target < 0 || target > 1) {
      return;
    }
    this.pageIndex = target;
    this.renderPage();
  }

  private renderPage(): void {
    for (const object of this.pageObjects) {
      object.destroy();
    }
    this.pageObjects = [];
    this.contentY = CONTENT_TOP;

    if (this.pageIndex === 0) {
      this.addContent('Scene', '#f2cc8f', true);
      this.addContent(this.puzzle.scene, '#d9dde7');
      this.addContent('Suspects 1-2', '#f2cc8f', true);
      this.addSuspect(0);
      this.addSuspect(1);
    } else {
      this.addContent('Suspects 3-4', '#f2cc8f', true);
      this.addSuspect(2);
      this.addSuspect(3);
    }

    this.indicator.setText(`Page ${this.pageIndex + 1}/2`);
    this.setEnabled(this.prevButton, this.prevLabel, this.pageIndex > 0);
    this.setEnabled(this.nextButton, this.nextLabel, this.pageIndex === 0);
  }

  private addSuspect(index: number): void {
    const suspect: PublicSuspect | undefined = this.puzzle.suspects[index];
    if (!suspect) {
      return;
    }
    this.addContent(`${index + 1}. ${suspect.name} - ${suspect.role}`, '#f4f1de', true);
    this.addContent(`Testimony: ${suspect.testimony}`, '#d9dde7');

    // Only cleared suspects have a proof in the server state; non-cleared
    // suspects never expose one here (or after a page reload).
    const proof = this.state.eliminatedAlibis?.[suspect.id];
    if (proof) {
      this.addContent('CLEARED', '#81b29a', true);
      this.addContent(`Alibi proof: ${proof}`, '#a7b1c2');
    }
    this.contentY += 4;
  }

  private addContent(text: string, color: string, bold = false): void {
    const line = this.add.text(CONTENT_X, this.contentY, text, {
      fontFamily: 'monospace',
      fontSize: '12px',
      color,
      fontStyle: bold ? 'bold' : 'normal',
      wordWrap: { width: this.scale.width - CONTENT_X * 2 },
    });
    this.pageObjects.push(line);
    this.contentY += Math.ceil(line.height) + 2;
    if (this.contentY > CONTENT_BOTTOM) {
      console.warn('Case file content exceeds panel');
    }
  }

  private setEnabled(
    rectangle: Phaser.GameObjects.Rectangle,
    label: Phaser.GameObjects.Text,
    enabled: boolean
  ): void {
    if (enabled) {
      rectangle.setInteractive({ useHandCursor: true });
      label.setInteractive({ useHandCursor: true });
    } else {
      rectangle.disableInteractive();
      label.disableInteractive();
    }
    rectangle.setAlpha(enabled ? 1 : 0.4);
    label.setAlpha(enabled ? 1 : 0.4);
  }
}
