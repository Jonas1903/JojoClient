import { useState } from "react";
import { IconInfo } from "../components/icons";

// Supported Minecraft versions (1.14.4+ for Fabric compatibility)
export const MC_VERSIONS = [
  "1.21.11", "1.21.10", "1.21.9", "1.21.8", "1.21.7", "1.21.6", "1.21.5", "1.21.4", "1.21.3", "1.21.2", "1.21.1", "1.21",
  "1.20.6", "1.20.5", "1.20.4", "1.20.3", "1.20.2", "1.20.1", "1.20",
  "1.19.4", "1.19.3", "1.19.2", "1.19.1", "1.19",
  "1.18.2", "1.18.1", "1.18",
  "1.17.1", "1.17",
  "1.16.5", "1.16.4", "1.16.3", "1.16.2", "1.16.1", "1.16",
  "1.15.2", "1.15.1", "1.15",
  "1.14.4",
];

export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isInOrder(text: string, words: string[]): boolean {
  let index = 0;
  for (const word of words) {
    const found = text.indexOf(word, index);
    if (found === -1) return false;
    index = found + word.length;
  }
  return true;
}

export function matchScore(title: string, query: string): number {
  const titleNorm = normalizeText(title);
  const queryNorm = normalizeText(query);
  if (!queryNorm) return 0;

  let score = 0;
  if (titleNorm === queryNorm) score += 1000;
  if (titleNorm.includes(queryNorm)) score += 200;

  const titleWords = titleNorm.split(" ");
  const queryWords = queryNorm.split(" ");

  for (const word of queryWords) {
    if (titleWords.includes(word)) {
      score += 30;
    } else if (titleNorm.includes(word)) {
      score += 12;
    }
  }

  if (isInOrder(titleNorm, queryWords)) {
    score += 40;
  }

  const uniqueChars = new Set(queryNorm.replace(/\s+/g, "").split(""));
  const titleChars = new Set(titleNorm.replace(/\s+/g, "").split(""));
  let commonChars = 0;
  uniqueChars.forEach((ch) => {
    if (titleChars.has(ch)) commonChars += 1;
  });
  score += commonChars;

  return score;
}

// Page Hint System
// First-visit inline callout with localStorage persistence.

export function usePageHint(key: string) {
  const storageKey = `jojoclient_hint_${key}`;
  const [visible, setVisible] = useState(() => localStorage.getItem(storageKey) !== "seen");
  const dismiss = () => {
    localStorage.setItem(storageKey, "seen");
    setVisible(false);
  };
  const show = () => setVisible(true);
  return { visible, dismiss, show };
}

export function PageHintCallout({
  text,
  items,
  onDismiss,
}: {
  text?: string;
  items?: string[];
  onDismiss: () => void;
}) {
  return (
    <div className="page-hint">
      <span className="page-hint-icon"><IconInfo /></span>
      <div className="page-hint-body">
        {text && <p className="page-hint-text">{text}</p>}
        {items && items.length > 0 && (
          <ul className="page-hint-list">
            {items.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        )}
      </div>
      <button className="page-hint-dismiss" onClick={onDismiss} title="Dismiss">×</button>
    </div>
  );
}
