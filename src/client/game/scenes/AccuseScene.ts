import Phaser from 'phaser';
import type { PublicPuzzle, PublicSuspect } from '../../../shared/types';
import { createInitialGameState, type GameState } from '../../../shared/game';
import { accuse } from '../api';
import { createSpeechBubble, type SpeechBubble } from '../ui/text';

type SuspectCard = {
  suspect: PublicSuspect;
  container: Phaser.GameObjects.Container;
};

export class AccuseScene extends Phaser.Scene {
  private readonly puzzle: PublicPuzzle;
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

  public init(data: { state?: GameState }): void {
    this.state = data.state ?? createInitialGameState(this.puzzle.id, this.puzzle.number);
  }

  public create(): void {
    this.cards = [];
    this.pendingAction = null;
    this.feedbackBubble = null;
    this.busy = false;
    this.cameras.main.setBackgroundColor('#1b1f2a');

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
      card.container.destroy(true);
    }
    this.cards = [];

    const visible = this.puzzle.suspects.filter(
      (suspect) => !this.state.eliminatedIds.includes(suspect.id)
    );

    const { width } = this.scale;
    const cardWidth = 76;
    const gap = 8;
    const totalWidth = visible.length * cardWidth + Math.max(0, visible.length - 1) * gap;
    const startX = (width - totalWidth) / 2 + cardWidth / 2;
    const y = 300;

    visible.forEach((suspect, index) => {
      const x = startX + index * (cardWidth + gap);
      const portrait = this.add.rectangle(0, 0, 64, 80, suspect.color);
      portrait.setStrokeStyle(3, 0xf4f1de);

      const nameText = this.add
        .text(0, 56, suspect.name.split(' ')[0] ?? suspect.name, {
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

      const container = this.add.container(x, y, [hit, portrait, nameText]);
      this.cards.push({ suspect, container });
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

      if (response.correct) {
        this.showFeedback(
          `${suspect.name}'s story falls apart:\n${response.reveal}`,
          'tap to continue',
          () => {
            this.scene.start('ResultScene', { state: this.state });
          }
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
          }
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
        }
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Something went wrong';
      this.infoText.setText(message);
      this.hintText.setText('');
    } finally {
      this.busy = false;
      if (!this.feedbackBubble && !this.state.finished) {
        this.updateHud();
      }
    }
  }

  private showFeedback(text: string, hint: string, onContinue: () => void): void {
    if (this.feedbackBubble) {
      this.feedbackBubble.destroy();
    }
    this.feedbackBubble = createSpeechBubble(this, {
      x: 20,
      y: 380,
      width: this.scale.width - 40,
      height: 210,
      text,
      textStyle: {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#1b1f2a',
        lineSpacing: 5,
        wordWrap: { width: this.scale.width - 72 },
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
    if (!this.feedbackBubble) {
      return;
    }
    if (this.feedbackBubble.isTyping()) {
      this.feedbackBubble.skip();
      this.infoText.setText(this.hintText.text || 'tap to continue');
      return;
    }
    const action = this.pendingAction;
    if (action) {
      action();
    }
  }
}
