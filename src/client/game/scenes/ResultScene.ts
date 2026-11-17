import Phaser from 'phaser';
import { buildShareText, type GameState } from '../../../shared/game';
import { ApiError, NetworkError, shareResult } from '../api';
import { DETECTIVE_KEY } from '../assets';
import { createInterrogationBackdrop } from '../ui/backdrop';
import { createCharacter } from '../ui/Character';

export class ResultScene extends Phaser.Scene {
  private countdownText: Phaser.GameObjects.Text | undefined;
  private countdownEvent: Phaser.Time.TimerEvent | undefined;

  constructor() {
    super('ResultScene');
  }

  public create(data: { state: GameState }): void {
    let currentState = data.state;
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#1b1f2a');
    createInterrogationBackdrop(this, currentState.puzzleId, { simple: true });

    const solved = currentState.solved;
    const shareText = currentState.shareText ?? buildShareText(currentState);

    createCharacter({
      scene: this,
      x: width / 2,
      y: 50,
      textureKey: DETECTIVE_KEY,
      fallbackColor: 0x81b29a,
      width: 48,
      height: 56,
      scale: 1,
    });

    this.add
      .text(width / 2, 95, solved ? 'Case Solved' : 'Case Closed', {
        fontFamily: 'monospace',
        fontSize: '32px',
        color: solved ? '#81b29a' : '#e07a5f',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, 135, `Attempts used: ${currentState.attemptsUsed} / 3`, {
        fontFamily: 'monospace',
        fontSize: '22px',
        color: '#f4f1de',
      })
      .setOrigin(0.5);

    if (currentState.culprit) {
      this.add
        .text(width / 2, 170, `Culprit: ${currentState.culprit.name}`, {
          fontFamily: 'monospace',
          fontSize: '18px',
          color: '#a7b1c2',
          align: 'center',
          wordWrap: { width: width - 40 },
        })
        .setOrigin(0.5);
    }

    this.add
      .rectangle(width / 2, 245, width - 48, 80, 0xf4f1de)
      .setStrokeStyle(4, 0x3d405b);

    this.add
      .text(width / 2, 245, shareText, {
        fontFamily: 'monospace',
        fontSize: '22px',
        color: '#1b1f2a',
        align: 'center',
        wordWrap: { width: width - 72 },
      })
      .setOrigin(0.5);

    this.countdownText = this.add
      .text(width / 2, 312, '', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#f2cc8f',
        align: 'center',
        wordWrap: { width: width - 40 },
      })
      .setOrigin(0.5);
    this.updateCountdown();
    this.countdownEvent = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => this.updateCountdown(),
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.countdownEvent?.remove(false);
      this.countdownEvent = undefined;
    });

    const feedback = this.add
      .text(width / 2, 352, '', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#81b29a',
        align: 'center',
        wordWrap: { width: width - 32 },
      })
      .setOrigin(0.5);

    // Copy result (always available fallback)
    const copyButton = this.add
      .rectangle(width / 2, height - 150, 240, 48, 0x81b29a)
      .setStrokeStyle(4, 0xf4f1de)
      .setInteractive({ useHandCursor: true });
    const copyLabel = this.add
      .text(width / 2, height - 150, 'Copy result', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#1b1f2a',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    const doCopy = (): void => {
      void copyResult(shareText, feedback);
    };
    copyButton.on('pointerdown', doCopy);
    copyLabel.on('pointerdown', doCopy);

    // Post to comments (share text only: attempts + puzzle number). One post per player per puzzle.
    const postButton = this.add
      .rectangle(width / 2, height - 94, 240, 48, 0xe07a5f)
      .setStrokeStyle(4, 0xf4f1de);
    const postLabel = this.add
      .text(width / 2, height - 94, 'Post to comments', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#1b1f2a',
      })
      .setOrigin(0.5);
    const cancelText = this.add
      .text(width / 2, height - 56, '', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#a7b1c2',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    let posting = false;
    let confirming = false;

    const setPostEnabled = (enabled: boolean): void => {
      if (enabled) {
        postButton.setInteractive({ useHandCursor: true });
        postLabel.setInteractive({ useHandCursor: true });
        postButton.setAlpha(1);
        postLabel.setAlpha(1);
      } else {
        postButton.disableInteractive();
        postLabel.disableInteractive();
        postButton.setAlpha(0.7);
        postLabel.setAlpha(0.7);
      }
    };

    const markPosted = (): void => {
      confirming = false;
      cancelText.setText('');
      postLabel.setText('Posted to comments');
      postButton.setFillStyle(0x6b7280);
      setPostEnabled(false);
    };

    const resetPostButton = (): void => {
      confirming = false;
      cancelText.setText('');
      postLabel.setText('Post to comments');
      postButton.setFillStyle(0xe07a5f);
      setPostEnabled(!currentState.sharedToComments && !posting);
    };

    if (currentState.sharedToComments) {
      markPosted();
    } else {
      setPostEnabled(true);
    }

    const cancelConfirm = (): void => {
      if (posting) return;
      resetPostButton();
      feedback.setText('');
    };
    cancelText.on('pointerdown', cancelConfirm);

    const handlePostTap = async (): Promise<void> => {
      if (posting || currentState.sharedToComments) return;
      if (!confirming) {
        confirming = true;
        postLabel.setText('Confirm post');
        cancelText.setText('Tap here to cancel');
        feedback.setColor('#f2cc8f');
        feedback.setText(`Post "${shareText}" as a comment?`);
        return;
      }

      posting = true;
      confirming = false;
      cancelText.setText('');
      setPostEnabled(false);
      postLabel.setText('Posting...');
      feedback.setColor('#a7b1c2');
      feedback.setText('Posting to comments...');

      try {
        const response = await shareResult(currentState.puzzleId);
        currentState = response.state;
        markPosted();
        feedback.setColor('#81b29a');
        feedback.setText('Posted to comments!');
      } catch (error) {
        posting = false;
        resetPostButton();
        if (error instanceof ApiError && error.status === 401) {
          feedback.setColor('#f2cc8f');
          feedback.setText('Log in to Reddit to post. You can still copy your result.');
        } else if (error instanceof ApiError && error.status === 409) {
          // Already posted (e.g. from another session) - disable to enforce once per player per puzzle.
          markPosted();
          feedback.setColor('#81b29a');
          feedback.setText('Result already posted to comments.');
        } else if (error instanceof NetworkError || error instanceof TypeError) {
          feedback.setColor('#e07a5f');
          feedback.setText('Could not post (connection problem). Tap to try again or copy result.');
        } else {
          const message = error instanceof Error ? error.message : 'Could not post to comments';
          feedback.setColor('#e07a5f');
          feedback.setText(`${message}. You can still copy your result.`);
        }
      }
    };

    const onPostTap = (): void => {
      void handlePostTap();
    };
    postButton.on('pointerdown', onPostTap);
    postLabel.on('pointerdown', onPostTap);

    this.add
      .text(width / 2, height - 20, solved ? 'Nice work, Inspector.' : 'Better luck next case.', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#a7b1c2',
      })
      .setOrigin(0.5);
  }

  private updateCountdown(): void {
    if (!this.countdownText) {
      return;
    }
    const now = new Date();
    const nextUtcMidnight = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1,
      0,
      0,
      0,
      0
    );
    const diffMs = Math.max(0, nextUtcMidnight - now.getTime());
    const totalSeconds = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const hh = String(hours).padStart(2, '0');
    const mm = String(minutes).padStart(2, '0');
    const ss = String(seconds).padStart(2, '0');
    this.countdownText.setText(`Next puzzle in ${hh}:${mm}:${ss}`);
  }
}

const copyResult = async (
  shareText: string,
  feedback: Phaser.GameObjects.Text
): Promise<void> => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(shareText);
      feedback.setColor('#81b29a');
      feedback.setText('Copied! (You can also post to comments)');
      return;
    }
  } catch {
    // fall through to fallback message
  }
  feedback.setColor('#f2cc8f');
  feedback.setText('Copy not available here. Try posting to comments.');
};
