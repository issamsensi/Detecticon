import Phaser from 'phaser';
import { getCompactCreditPages } from '../../../shared/credits';

// Pagination instead of drag-scrolling: in Phaser 4 GeometryMask only works in
// the Canvas renderer, and the WebGL replacement is a shader-based Mask filter.
// Fixed pages keep the Back button clear and never overflow on a phone-sized post.
export class CreditsScene extends Phaser.Scene {
  private pages: string[] = [];
  private pageIndex = 0;
  private pageText!: Phaser.GameObjects.Text;
  private indicatorText!: Phaser.GameObjects.Text;
  private prevButton!: Phaser.GameObjects.Rectangle;
  private prevLabel!: Phaser.GameObjects.Text;
  private nextButton!: Phaser.GameObjects.Rectangle;
  private nextLabel!: Phaser.GameObjects.Text;

  constructor() {
    super('CreditsScene');
  }

  public create(): void {
    const { width } = this.scale;
    this.cameras.main.setBackgroundColor('#1b1f2a');

    this.add
      .text(width / 2, 28, 'Credits', {
        fontFamily: 'monospace',
        fontSize: '28px',
        color: '#f4f1de',
      })
      .setOrigin(0.5);

    // Content panel ends at y=482; controls live below it so nothing can overlap.
    const panelX = 16;
    const panelY = 58;
    const panelW = width - 32;
    const panelH = 424;
    this.add
      .rectangle(panelX, panelY, panelW, panelH, 0x2b3040)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0x3d405b);

    this.pageText = this.add
      .text(panelX + 10, panelY + 10, '', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#d9dde7',
        lineSpacing: 3,
        wordWrap: { width: panelW - 20 },
      })
      .setOrigin(0, 0);

    this.indicatorText = this.add
      .text(width / 2, 504, '', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#f2cc8f',
      })
      .setOrigin(0.5);

    const prev = this.makeButton(78, 548, 104, 44, 'Prev', 0x3d405b, () => this.changePage(-1));
    this.prevButton = prev.rectangle;
    this.prevLabel = prev.label;

    const next = this.makeButton(282, 548, 104, 44, 'Next', 0x81b29a, () => this.changePage(1));
    this.nextButton = next.rectangle;
    this.nextLabel = next.label;

    // Back is always rendered last (on top) and is never disabled by pagination.
    const back = this.makeButton(width / 2, 606, 160, 44, 'Back', 0xe07a5f, () => {
      this.scene.start('IntroScene');
    });
    back.rectangle.setStrokeStyle(3, 0xf4f1de);

    this.pages = getCompactCreditPages();
    this.pageIndex = 0;
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
        fontSize: '18px',
        color: '#1b1f2a',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    rectangle.on('pointerdown', onClick);
    text.on('pointerdown', onClick);
    return { rectangle, label: text };
  }

  private changePage(delta: number): void {
    const nextIndex = this.pageIndex + delta;
    if (nextIndex < 0 || nextIndex >= this.pages.length) return;
    this.pageIndex = nextIndex;
    this.renderPage();
  }

  private renderPage(): void {
    this.pageText.setText(this.pages[this.pageIndex] ?? '');
    this.indicatorText.setText(`${this.pageIndex + 1}/${this.pages.length}`);

    const setEnabled = (
      rectangle: Phaser.GameObjects.Rectangle,
      label: Phaser.GameObjects.Text,
      enabled: boolean
    ): void => {
      if (enabled) {
        rectangle.setInteractive({ useHandCursor: true });
        label.setInteractive({ useHandCursor: true });
      } else {
        rectangle.disableInteractive();
        label.disableInteractive();
      }
      rectangle.setAlpha(enabled ? 1 : 0.4);
      label.setAlpha(enabled ? 1 : 0.4);
    };

    setEnabled(this.prevButton, this.prevLabel, this.pageIndex > 0);
    setEnabled(this.nextButton, this.nextLabel, this.pageIndex < this.pages.length - 1);
  }
}
