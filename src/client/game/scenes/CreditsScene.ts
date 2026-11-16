import Phaser from 'phaser';
import { EXTRA_CREDITS_TEXT, LPC_CREDITS_TEXT } from '../../../shared/credits';

export class CreditsScene extends Phaser.Scene {
  constructor() {
    super('CreditsScene');
  }

  public create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#1b1f2a');

    this.add
      .text(width / 2, 28, 'Credits', {
        fontFamily: 'monospace',
        fontSize: '28px',
        color: '#f4f1de',
      })
      .setOrigin(0.5);

    const viewX = 16;
    const viewY = 60;
    const viewW = width - 32;
    const viewH = height - 130;

    // Background panel for readability
    this.add.rectangle(viewX, viewY, viewW, viewH, 0x2b3040).setOrigin(0, 0).setStrokeStyle(2, 0x3d405b);

    const content = `${LPC_CREDITS_TEXT}\n\n---\n${EXTRA_CREDITS_TEXT}`;
    const textStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#d9dde7',
      lineSpacing: 4,
      wordWrap: { width: viewW - 20 },
    };

    const creditsText = this.add.text(viewX + 10, viewY + 10, content, textStyle).setOrigin(0, 0);

    // Simple scroll: drag content vertically within a mask.
    const bounds = creditsText.getBounds();
    const contentHeight = bounds.height + 20;
    const minY = viewY + 10 - Math.max(0, contentHeight - viewH);

    const maskGraphics = this.add.graphics();
    maskGraphics.setVisible(false);
    maskGraphics.fillStyle(0xffffff);
    maskGraphics.fillRect(viewX, viewY, viewW, viewH);
    const mask = maskGraphics.createGeometryMask();
    creditsText.setMask(mask);

    let dragging = false;
    let dragStartY = 0;
    let textStartY = 0;

    const clampY = (y: number): number => Math.max(minY, Math.min(viewY + 10, y));

    const hitZone = this.add.zone(viewX, viewY, viewW, viewH).setOrigin(0, 0).setInteractive();
    hitZone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      dragging = true;
      dragStartY = pointer.y;
      textStartY = creditsText.y;
    });
    this.input.on('pointerup', () => {
      dragging = false;
    });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!dragging || !pointer.isDown) return;
      const dy = pointer.y - dragStartY;
      creditsText.y = clampY(textStartY + dy);
    });

    this.add
      .text(width / 2, height - 52, 'Drag to scroll', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#a7b1c2',
      })
      .setOrigin(0.5);

    const backButton = this.add
      .rectangle(width / 2, height - 22, 160, 34, 0xe07a5f)
      .setStrokeStyle(3, 0xf4f1de)
      .setInteractive({ useHandCursor: true });
    const backText = this.add
      .text(width / 2, height - 22, 'Back', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#1b1f2a',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    const goBack = (): void => {
      this.scene.start('IntroScene');
    };
    backButton.on('pointerdown', goBack);
    backText.on('pointerdown', goBack);
  }
}
