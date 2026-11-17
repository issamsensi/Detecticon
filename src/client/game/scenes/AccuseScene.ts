import Phaser from 'phaser';
import type { PublicPuzzle, PublicSuspect } from '../../../shared/types';
import { createInitialGameState, type GameState } from '../../../shared/game';
import { ApiError, NetworkError, accuse } from '../api';
import { getSuspectSpriteKey } from '../assets';
import { reloadToday } from '../reload';
import { createInterrogationBackdrop } from '../ui/backdrop';
import { createCharacter, type Character } from '../ui/Character';
import { createSpeechBubble, type SpeechBubble } from '../ui/text';

type SuspectCard = {
  suspect: PublicSuspect;
  container: Phaser.GameObjects.Container;
  character: Character;
};

export class AccuseScene extends Phaser.Scene {
  private puzzle: PublicPuzzle;
  private state!: GameState;
  private cards: SuspectCard[] = [];
  private infoText!: Phaser.GameObjects.Text;
  private attemptsText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private feedbackBubble: SpeechBubble | null = null;
  private pendingAction: (() => void) | null = null;
  private busy = false;

  constructor(puzzle: PublicPuzzle) {
    super('AccuseScene');
    this.puzzle = puzzle;
  }

  public init(data: { state?: GameState; puzzle?: PublicPuzzle }): void {
    if (data.puzzle) {
      this.puzzle = data.puzzle;
    }
    this.state = data.state ?? createInitialGameState(this.puzzle.id, this.puzzle.number);
  }

  public create(): void {
    this.cards = [];
    this.pendingAction = null;
    this.feedbackBubble = null;
    this.busy = false;
    this.cameras.main.setBackgroundColor('#1b1f2a');
    createInterrogationBackdrop(this, this.puzzle.id);

    const { width } = this.scale;

    this.add
      .text(width / 2, 40, 'Who did it?', {
        fontFamily: 'monospace',
        fontSize: '30px',
        color: '#f4f1de',
      })
      .setOrigin(0.5);

    this.attemptsText = this.add
      .text(width / 2, 78, '', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#f2cc8f',
      })
      .setOrigin(0.5);

    this.infoText = this.add
      .text(width / 2, 112, 'Tap a suspect to accuse them', {
        fontFamily: 'monospace',
        fontSize: '15px',
        color: '#a7b1c2',
        align: 'center',
        wordWrap: { width: width - 32 },
      })
      .setOrigin(0.5);

    this.infoText.setInteractive({ useHandCursor: true });
    this.infoText.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.pendingAction && !this.feedbackBubble && !this.busy) {
        pointer.event?.stopPropagation?.();
        const action = this.pendingAction;
        this.pendingAction = null;
        action();
      }
    });

    this.hintText = this.add
      .text(width / 2, 610, '', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#f2cc8f',
      })
      .setOrigin(0.5);

    this.input.on('pointerdown', () => {
      this.handleGlobalTap();
    });

    this.renderSuspects();
    this.updateHud();

    if (this.state.finished) {
      this.scene.start('ResultScene', { state: this.state });
    }
  }

  private updateHud(): void {
    this.attemptsText.setText(`Attempts left: ${this.state.attemptsLeft}`);
  }

  private renderSuspects(): void {
    for (const card of this.cards) {
      card.character.destroy();
      // The container owns the name text and tap target. Without this they stay
      // on screen after a wrong accusation, so old names/hitboxes pile up.
      card.container.destroy();
    }
    this.cards = [];

    const visible = this.puzzle.suspects
      .map((suspect, originalIndex) => ({ suspect, originalIndex }))
      .filter(({ suspect }) => !this.state.eliminatedIds.includes(suspect.id));

    const { width } = this.scale;
    const cardWidth = 76;
    const gap = 8;
    const totalWidth = visible.length * cardWidth + Math.max(0, visible.length - 1) * gap;
    const startX = (width - totalWidth) / 2 + cardWidth / 2;
    const y = 300;

    visible.forEach(({ suspect, originalIndex }, index) => {
      const x = startX + index * (cardWidth + gap);

      const nameText = this.add
        .text(0, 48, suspect.name.split(' ')[0] ?? suspect.name, {
          fontFamily: 'monospace',
          fontSize: '14px',
          color: '#f4f1de',
          align: 'center',
        })
        .setOrigin(0.5);

      const hit = this.add.rectangle(0, 10, 76, 120, 0x000000, 0);
      hit.setInteractive({ useHandCursor: true });
      hit.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        pointer.event?.stopPropagation?.();
        void this.accuse(suspect);
      });

      const container = this.add.container(x, y, [hit, nameText]);
      // 64x64 sprite at integer 1x scale so 4 suspects fit across 360x640 without blur.
      const character = createCharacter({
        scene: this,
        x,
        y,
        textureKey: getSuspectSpriteKey(this.puzzle.id, originalIndex),
        fallbackColor: suspect.color,
        width: 64,
        height: 64,
        scale: 1,
      });
      // Keep name/hit in container, character manages its own container with idle animation.
      this.cards.push({ suspect, container, character });
    });
  }

  private async accuse(suspect: PublicSuspect): Promise<void> {
    if (this.feedbackBubble || this.pendingAction || this.busy || this.state.finished) {
      return;
    }

    this.busy = true;
    this.infoText.setText('Checking...');
    try {
      const response = await accuse(this.puzzle.id, suspect.id);
      this.state = response.state;
      this.updateHud();

      // Aim the bubble tail at the accused suspect's column in the lineup.
      const tailX =
        this.cards.find((card) => card.suspect.id === suspect.id)?.character.container.x ??
        this.scale.width / 2;

      if (response.correct) {
        this.showFeedback(
          `${suspect.name}'s story falls apart:\n${response.reveal}`,
          'tap to continue',
          () => {
            this.scene.start('ResultScene', { state: this.state });
          },
          tailX
        );
        return;
      }

      if (this.state.finished) {
        const culpritName = this.state.culprit?.name ?? 'The culprit';
        this.showFeedback(
          `${suspect.name} has an alibi:\n${response.reveal}\n\nNo attempts left. ${culpritName} was the culprit.`,
          'tap to see result',
          () => {
            this.scene.start('ResultScene', { state: this.state });
          },
          tailX
        );
        return;
      }

      this.showFeedback(
        `${suspect.name} has an alibi:\n${response.reveal}`,
        'tap to continue',
        () => {
          this.clearFeedback();
          this.renderSuspects();
          this.infoText.setText('Not them. Tap another suspect.');
          this.hintText.setText('');
        },
        tailX
      );
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        // Keep flow intact: show clear login message without changing game state.
        this.infoText.setColor('#f2cc8f');
        this.infoText.setText('Log in to Reddit to play');
        this.hintText.setText('');
      } else if (
        error instanceof ApiError &&
        (error.status === 400 || error.status === 404)
      ) {
        // State/puzzle may have changed (finished, eliminated, or new day): reload and route.
        this.infoText.setText('Syncing latest puzzle...');
        this.hintText.setText('');
        try {
          await reloadToday(this.game);
          return;
        } catch {
          this.infoText.setColor('#e07a5f');
          this.infoText.setText('Could not sync. Tap to retry.');
          this.hintText.setText('tap to continue');
          this.pendingAction = () => {
            this.pendingAction = null;
            this.hintText.setText('');
            void this.accuse(suspect);
          };
        }
      } else if (error instanceof NetworkError || error instanceof TypeError) {
        this.infoText.setColor('#e07a5f');
        this.infoText.setText('Connection problem, tap to retry');
        this.hintText.setText('tap to continue');
        this.pendingAction = () => {
          this.pendingAction = null;
          this.hintText.setText('');
          void this.accuse(suspect);
        };
      } else {
        const message = error instanceof Error ? error.message : 'Something went wrong';
        this.infoText.setColor('#e07a5f');
        this.infoText.setText(message);
        this.hintText.setText('');
      }
    } finally {
      this.busy = false;
      if (!this.feedbackBubble && !this.state.finished && !this.pendingAction) {
        this.updateHud();
      }
    }
  }

  private showFeedback(
    text: string,
    hint: string,
    onContinue: () => void,
    tailX: number
  ): void {
    if (this.feedbackBubble) {
      this.feedbackBubble.destroy();
    }
    const maxWidth = this.scale.width - 40;
    const padding = 14;
    // Sits below the lineup (sprites end at y=332) with a small upward tail.
    this.feedbackBubble = createSpeechBubble(this, {
      x: 20,
      y: 356,
      width: maxWidth,
      centerX: true,
      padding,
      minHeight: 80,
      maxHeight: 210,
      text,
      tail: { direction: 'up', x: tailX, width: 24, height: 14 },
      textStyle: {
        fontFamily: 'monospace',
        fontSize: '15px',
        color: '#1b1f2a',
        lineSpacing: 4,
        wordWrap: { width: maxWidth - padding * 2 },
      },
      typewriter: { speedMs: 18 },
    });
    this.pendingAction = onContinue;
    this.hintText.setText(hint);
    this.infoText.setText(this.feedbackBubble.isTyping() ? 'tap to skip' : hint);
  }

  private clearFeedback(): void {
    if (this.feedbackBubble) {
      this.feedbackBubble.destroy();
      this.feedbackBubble = null;
    }
    this.pendingAction = null;
  }

  private handleGlobalTap(): void {
    if (this.feedbackBubble) {
      if (this.feedbackBubble.isTyping()) {
        this.feedbackBubble.skip();
        this.infoText.setText(this.hintText.text || 'tap to continue');
        return;
      }
      const action = this.pendingAction;
      if (action) {
        action();
      }
      return;
    }

    // Handle tap-to-retry actions when no feedback bubble is shown (e.g. network/sync errors).
    if (this.pendingAction && !this.busy) {
      const action = this.pendingAction;
      this.pendingAction = null;
      action();
    }
  }
}
