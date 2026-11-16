import Phaser from 'phaser';

type TextBlockOptions = {
  x: number;
  y: number;
  text: string;
  maxWidth: number;
  style: Phaser.Types.GameObjects.Text.TextStyle;
  originX?: number;
  originY?: number;
};

type SpeechBubbleOptions = {
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  padding?: number;
  backgroundColor?: number;
  borderColor?: number;
  textStyle?: Phaser.Types.GameObjects.Text.TextStyle;
  typewriter?: {
    speedMs: number;
  };
};

export type SpeechBubble = {
  container: Phaser.GameObjects.Container;
  background: Phaser.GameObjects.Rectangle;
  textObject: Phaser.GameObjects.Text;
  setText: (text: string, animate?: boolean) => void;
  skip: () => void;
  isTyping: () => boolean;
  destroy: () => void;
};

export const createTextBlock = (
  scene: Phaser.Scene,
  options: TextBlockOptions
): Phaser.GameObjects.Text => {
  const text = scene.add.text(options.x, options.y, options.text, options.style);
  text.setOrigin(options.originX ?? 0, options.originY ?? 0);
  if (options.style.wordWrap?.width == null) {
    text.setWordWrapWidth(options.maxWidth);
  }
  return text;
};

export const createSpeechBubble = (
  scene: Phaser.Scene,
  options: SpeechBubbleOptions
): SpeechBubble => {
  const padding = options.padding ?? 16;
  const background = scene.add.rectangle(
    0,
    0,
    options.width,
    options.height,
    options.backgroundColor ?? 0xf4f1de
  );
  background.setOrigin(0, 0);
  background.setStrokeStyle(4, options.borderColor ?? 0x3d405b);

  const textObject = scene.add.text(padding, padding, '', {
    fontFamily: 'monospace',
    fontSize: '18px',
    color: '#1b1f2a',
    wordWrap: { width: options.width - padding * 2 },
    ...options.textStyle,
  });

  const container = scene.add.container(options.x, options.y, [background, textObject]);

  let timer: Phaser.Time.TimerEvent | null = null;
  let fullText = '';
  let charIndex = 0;

  const stopTimer = (): void => {
    if (timer) {
      timer.remove(false);
      timer = null;
    }
  };

  const isTyping = (): boolean => timer !== null;

  const setText = (text: string, animate = true): void => {
    stopTimer();
    fullText = text;
    charIndex = 0;
    textObject.setText('');

    if (!animate || !options.typewriter || text.length === 0) {
      textObject.setText(text);
      charIndex = text.length;
      return;
    }

    timer = scene.time.addEvent({
      delay: options.typewriter.speedMs,
      loop: true,
      callback: () => {
        charIndex += 1;
        textObject.setText(fullText.slice(0, charIndex));
        if (charIndex >= fullText.length) {
          stopTimer();
        }
      },
    });
  };

  const skip = (): void => {
    if (!isTyping()) {
      return;
    }
    stopTimer();
    charIndex = fullText.length;
    textObject.setText(fullText);
  };

  const destroy = (): void => {
    stopTimer();
    container.destroy(true);
  };

  setText(options.text, true);

  return {
    container,
    background,
    textObject,
    setText,
    skip,
    isTyping,
    destroy,
  };
};
