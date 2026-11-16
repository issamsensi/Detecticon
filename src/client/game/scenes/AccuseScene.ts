import Phaser from 'phaser';
import type { Puzzle, Suspect } from '../../../shared/types';
import { createSpeechBubble, type SpeechBubble } from '../ui/text';
import { createInitialGameState, type GameState } from '../state';

type SuspectCard = {
  suspect: Suspect;
  container: Phaser.GameObjects.Container;
  portrait: Phaser.GameObjects.Rectangle;
  nameText: Phaser.GameObjects.Text;
};

export class AccuseScene extends Phaser.Scene {
  private readonly puzzle: Puzzle;
  private state!: GameState;
  private cards: SuspectCard[] = [];
  private infoText!: Phaser.GameObjects.Text;
  private attemptsText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private feedbackBubble: SpeechBubble | null = null;
  private pendingAction: (() => void) | null = null;

  constructor(puzzle: Puzzle) {
    super('AccuseScene');
    this.puzzle = puzzle;
  }

  public create(data: { state?: GameState }): void {
    this.state = data.state ?? createInitialGameState(this.puzzle.id, this.puzzle.number);
    this.cards = [];
    this.pendingAction = null;
    this.feedbackBubble = null;
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
      portrait.setInteractive({ useHandCursor: true });
      portrait.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        pointer.event?.stopPropagation?.();
        this.accuse(suspect);
      });

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
        this.accuse(suspect);
      });

      const container = this.add.container(x, y, [hit, portrait, nameText]);
      this.cards.push({ suspect, container, portrait, nameText });
    });
  }

  private accuse(suspect: Suspect): void {
    if (this.feedbackBubble || this.pendingAction || this.state.attemptsLeft <= 0) {
      return;
    }

    if (suspect.isKiller) {
      this.state.attemptsUsed += 1;
      this.state.attemptsLeft -= 1;
      this.state.results.push('correct');
      this.state.solved = true;
      this.updateHud();
      this.showFeedback(
        `${suspect.name}'s story falls apart:\n${suspect.contradiction ?? 'Their contradiction is revealed.'}`,
        'tap to continue',
        () => {
          this.scene.start('ResultScene', { puzzle: this.puzzle, state: this.state });
        }
      );
      return;
    }

    this.state.attemptsUsed += 1;
    this.state.attemptsLeft -= 1;
    this.state.results.push('wrong');
    if (!this.state.eliminatedIds.includes(suspect.id)) {
      this.state.eliminatedIds.push(suspect.id);
    }
    this.updateHud();

    if (this.state.attemptsLeft <= 0) {
      const killer = this.puzzle.suspects.find((s) => s.isKiller);
      if (killer) {
        this.state.revealedKillerId = killer.id;
      }
      this.showFeedback(
        `${suspect.name} has an alibi:\n${suspect.alibiProof ?? 'They are cleared.'}\n\nNo attempts left. ${
          killer ? `${killer.name} was the culprit.` : 'The culprit is revealed.'
        }`,
        'tap to see result',
        () => {
          this.scene.start('ResultScene', { puzzle: this.puzzle, state: this.state });
        }
      );
      return;
    }

    this.showFeedback(
      `${suspect.name} has an alibi:\n${suspect.alibiProof ?? 'They are cleared.'}`,
      'tap to continue',
      () => {
        this.clearFeedback();
        this.renderSuspects();
        this.infoText.setText('Not them. Tap another suspect.');
        this.hintText.setText('');
      }
    );
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
