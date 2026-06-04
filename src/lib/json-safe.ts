/** PostgreSQL jsonb rejects unpaired UTF-16 surrogates from Kaggle data. */
export function jsonSafeStringify(value: unknown): string {
  const raw = JSON.stringify(value, (_key, v) => {
    if (typeof v !== "string") return v;
    return v.replace(
      /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g,
      "",
    );
  });
  return raw;
}
