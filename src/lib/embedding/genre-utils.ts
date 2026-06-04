/** Split Kaggle/Steam genre strings into individual tokens. */
export function splitGenreTokens(genre: string | null | undefined): string[] {
  if (!genre?.trim()) return [];
  return genre
    .split(/[,;/|]/)
    .map((g) => g.trim())
    .filter(Boolean);
}
