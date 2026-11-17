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

type TailOptions = {
  direction?: 'down' | 'up';
  x: number; // absolute scene x for the tail centre
  width?: number;
  height?: number;
};

type SpeechBubbleOptions = {
  x: number;
  y?: number; // top edge; ignored when bottomY is provided
  bottomY?: number; // bottom edge of the bubble body (tail extends below this)
  width: number; // maximum bubble width
  height?: number; // omit to size to the measured text
  minHeight?: number;
  maxHeight?: number;
  minWidth?: number;
  text: string;
  padding?: number;
  backgroundColor?: number;
  borderColor?: number;
  textStyle?: Phaser.Types.GameObjects.Text.TextStyle;
  typewriter?: {
    speedMs: number;
  };
  centerX?: boolean;
  tail?: TailOptions;
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
  const fill = options.backgroundColor ?? 0xf4f1de;
  const border = options.borderColor ?? 0x3d405b;
  const maxWidth = options.width;

  const textObject = scene.add.text(padding, padding, options.text, {
    fontFamily: 'monospace',
    fontSize: '18px',
    color: '#1b1f2a',
    wordWrap: { width: maxWidth - padding * 2 },
    ...options.textStyle,
  });

  // Measure the full wrapped text before the typewriter starts erasing it.
  textObject.setText(options.text);
  const measuredWidth = Math.min(
    maxWidth,
    Math.max(options.minWidth ?? 140, Math.ceil(textObject.width) + padding * 2)
  );
  const measuredHeight =
    options.height ??
    Math.min(
      options.maxHeight ?? 260,
      Math.max(options.minHeight ?? 56, Math.ceil(textObject.height) + padding * 2)
    );

  const rootX = options.centerX
    ? Math.round((scene.scale.width - measuredWidth) / 2)
    : options.x;
  // With bottomY, longer text grows the bubble upward instead of pushing its tail down.
  const rootY =
    options.bottomY != null ? options.bottomY - measuredHeight : (options.y ?? 0);
  const container = scene.add.container(rootX, rootY);

  // Tail first so the bubble background covers its base seam.
  if (options.tail) {
    const tailWidth = options.tail.width ?? 24;
    const tailHeight = options.tail.height ?? 14;
    const tailCenter = Phaser.Math.Clamp(
      options.tail.x - rootX,
      tailWidth / 2 + 4,
      measuredWidth - tailWidth / 2 - 4
    );
    const tailX = tailCenter - tailWidth / 2;
    const down = (options.tail.direction ?? 'down') === 'down';
    const tail = down
      ? scene.add.triangle(
          tailX,
          measuredHeight,
          0,
          0,
          tailWidth,
          0,
          tailWidth / 2,
          tailHeight,
          fill
        )
      : scene.add.triangle(
          tailX,
          -tailHeight,
          0,
          tailHeight,
          tailWidth,
          tailHeight,
          tailWidth / 2,
          0,
          fill
        );
    tail.setStrokeStyle(4, border);
    container.add(tail);
  }

  const background = scene.add.rectangle(0, 0, measuredWidth, measuredHeight, fill);
  background.setOrigin(0, 0);
  background.setStrokeStyle(4, border);
  container.add(background);
  container.add(textObject);

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
