/**
 * Social Sharing — Share game results via Web Share API or clipboard fallback.
 */

export interface ShareData {
  title: string;
  text: string;
  url?: string;
}

/**
 * Share a result using the native Web Share API (mobile) or copy to clipboard.
 * Returns true if shared successfully, false otherwise.
 */
export async function shareResult(data: ShareData): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const shareUrl = data.url || window.location.href;
  const fullText = `${data.text}\n\n${shareUrl}\n\n#InspiredMile #Shakespeare #SonnetMan`;

  // Try native Web Share API first (available on mobile + some desktop)
  if (navigator.share) {
    try {
      await navigator.share({
        title: data.title,
        text: fullText,
        url: shareUrl,
      });
      return true;
    } catch (e) {
      // User cancelled or share failed — fall through to clipboard
      if ((e as Error).name === 'AbortError') return false;
    }
  }

  // Clipboard fallback
  try {
    await navigator.clipboard.writeText(fullText);
    if (typeof (window as any).showToast === 'function') {
      (window as any).showToast('Copied to clipboard!', 'success', 3000);
    }
    return true;
  } catch {
    return false;
  }
}

/** Share a battle victory */
export function shareBattleWin(score: number, opponentType: string): Promise<boolean> {
  return shareResult({
    title: 'Inspired Mile — Battle Victory!',
    text: `I just won a battle in Inspired Mile with a score of ${score} against ${opponentType}!`,
  });
}

/** Share a trivia result */
export function shareTriviaScore(correct: number, total: number): Promise<boolean> {
  return shareResult({
    title: 'Inspired Mile — Trivia Score',
    text: `I scored ${correct}/${total} on Shakespeare trivia in Inspired Mile!`,
  });
}

/** Share collection progress */
export function shareCollection(owned: number, total: number): Promise<boolean> {
  return shareResult({
    title: 'Inspired Mile — Card Collection',
    text: `I've collected ${owned} out of ${total} cards in Inspired Mile!`,
  });
}
