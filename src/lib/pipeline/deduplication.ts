import type { Article } from "@/types/content";

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "at", "beyond", "for", "from", "in", "into", "is", "of", "on", "the", "to",
]);

function stem(token: string) {
  if (token.endsWith("ing") && token.length > 5) {
    const root = token.slice(0, -3);
    return root.endsWith("v") ? `${root}e` : root;
  }
  if (token.endsWith("ies") && token.length > 4) return `${token.slice(0, -3)}y`;
  if (token.endsWith("s") && token.length > 4) return token.slice(0, -1);
  return token;
}

function tokens(value: string) {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((token) => token.length > 2 && !STOP_WORDS.has(token))
      .map(stem),
  );
}

export function titleSimilarity(left: string, right: string) {
  const a = tokens(left);
  const b = tokens(right);
  const intersection = [...a].filter((token) => b.has(token)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : intersection / union;
}

export function findDuplicate(
  candidateTitle: string,
  articles: Pick<Article, "id" | "title" | "slug">[],
  threshold = 0.62,
) {
  return (
    articles
      .map((article) => ({
        article,
        similarity: titleSimilarity(candidateTitle, article.title),
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .find((match) => match.similarity >= threshold) ?? null
  );
}

export function hasSuspiciousPhraseReuse(
  draft: string,
  sourceSnippets: string[],
  phraseLength = 12,
) {
  const normalize = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  const normalizedDraft = normalize(draft);
  return sourceSnippets.some((snippet) => {
    const words = normalize(snippet).split(" ");
    for (let index = 0; index <= words.length - phraseLength; index += 1) {
      if (normalizedDraft.includes(words.slice(index, index + phraseLength).join(" "))) {
        return true;
      }
    }
    return false;
  });
}
