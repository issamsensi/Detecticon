import Phaser from 'phaser';

export type CharacterOptions = {
  scene: Phaser.Scene;
  x: number;
  y: number;
  textureKey: string;
  fallbackColor: number;
  width?: number;
  height?: number;
  scale?: number;
  displayWidth?: number;
  displayHeight?: number;
};

export type Character = {
  container: Phaser.GameObjects.Container;
  setTalking: (talking: boolean) => void;
  destroy: () => void;
};

export const createCharacter = (options: CharacterOptions): Character => {
  const {
    scene,
    x,
    y,
    textureKey,
    fallbackColor,
    width = 64,
    height = 80,
    scale,
    displayWidth,
    displayHeight,
  } = options;

  const container = scene.add.container(x, y);
  const baseY = 0;

  if (scene.textures.exists(textureKey)) {
    const image = scene.add.image(0, 0, textureKey);
    if (scale != null) {
      // Integer scaling for crisp pixel-art rendering (no blur).
      image.setScale(Math.round(scale));
    } else if (displayWidth != null && displayHeight != null) {
      image.setDisplaySize(displayWidth, displayHeight);
    } else if (displayWidth != null || displayHeight != null) {
      image.setDisplaySize(displayWidth ?? image.width, displayHeight ?? image.height);
    }
    container.add(image);
  } else {
    const rect = scene.add.rectangle(0, 0, width, height, fallbackColor);
    rect.setStrokeStyle(3, 0xf4f1de);
    container.add(rect);
  }

  let talking = false;
  let elapsed = 0;

  // Idle: gentle 2px bob; Talking: faster/livelier bob while typewriter plays.
  const update = (_time: number, delta: number): void => {
    elapsed += delta;
    if (talking) {
      const step = Math.floor(elapsed / 120) % 2;
      container.y = y + baseY + (step === 0 ? -2 : 0);
    } else {
      const phase = (elapsed / 600) * Math.PI * 2;
      const offset = Math.sin(phase) >= 0 ? 0 : -2;
      container.y = y + baseY + offset;
    }
  };

  scene.events.on(Phaser.Scenes.Events.UPDATE, update);

  const setTalking = (value: boolean): void => {
    if (talking === value) return;
    talking = value;
    elapsed = 0;
    container.y = y + baseY;
  };

  const destroy = (): void => {
    scene.events.off(Phaser.Scenes.Events.UPDATE, update);
    container.destroy(true);
  };

  return { container, setTalking, destroy };
};
