export type PasswordAnalysis = {
  score: number;
  rating: "No candidate" | "Needs improvement" | "Fair" | "Good" | "Strong heuristic";
  length: number;
  uniqueCharacterRatio: number;
  characterGroups: number;
  predictableExample: boolean;
  repeatedRun: boolean;
  recommendations: string[];
};

const PASSWORD_CHARSETS = {
  lowercase: "abcdefghijkmnopqrstuvwxyz",
  uppercase: "ABCDEFGHJKLMNPQRSTUVWXYZ",
  numbers: "23456789",
  symbols: "!@#$%^&*()-_=+[]{}:,.?",
} as const;

/** Uses rejection sampling so each allowed character has the same probability. */
export function generateSecurePassword(options: {
  length: number;
  lowercase?: boolean;
  uppercase?: boolean;
  numbers?: boolean;
  symbols?: boolean;
}): string {
  const length = Math.max(12, Math.min(64, Math.floor(options.length)));
  const sets = [
    options.lowercase === false ? "" : PASSWORD_CHARSETS.lowercase,
    options.uppercase === false ? "" : PASSWORD_CHARSETS.uppercase,
    options.numbers === false ? "" : PASSWORD_CHARSETS.numbers,
    options.symbols === false ? "" : PASSWORD_CHARSETS.symbols,
  ].filter(Boolean);
  if (!sets.length) throw new Error("Choose at least one character group.");
  const alphabet = sets.join("");
  const randomBelow = (maximum: number) => {
    const ceiling = Math.floor(256 / maximum) * maximum;
    const byte = new Uint8Array(1);
    do { crypto.getRandomValues(byte); } while (byte[0] >= ceiling);
    return byte[0] % maximum;
  };
  const characters = sets.map((set) => set[randomBelow(set.length)]);
  while (characters.length < length) characters.push(alphabet[randomBelow(alphabet.length)]);
  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swapIndex = randomBelow(index + 1);
    [characters[index], characters[swapIndex]] = [characters[swapIndex], characters[index]];
  }
  return characters.join("");
}

export function findPwnedPasswordCount(rangeResponse: string, hashSuffix: string): number {
  const suffix = hashSuffix.toUpperCase();
  if (!/^[A-F0-9]{35}$/.test(suffix)) return 0;
  for (const line of rangeResponse.split(/\r?\n/)) {
    const [candidate, count] = line.trim().split(":");
    if (candidate?.toUpperCase() === suffix && /^\d+$/.test(count ?? "")) return Number(count);
  }
  return 0;
}

const predictableExamples = new Set([
  "password", "password1", "123456", "12345678", "qwerty", "letmein",
  "welcome", "admin", "iloveyou", "changeme", "secret", "abc123",
]);

/** A local heuristic only. The candidate is deliberately never returned or persisted. */
export function analyzePasswordCandidate(candidate: string): PasswordAnalysis {
  if (typeof candidate !== "string" || candidate.length === 0) {
    return {
      score: 0,
      rating: "No candidate",
      length: 0,
      uniqueCharacterRatio: 0,
      characterGroups: 0,
      predictableExample: false,
      repeatedRun: false,
      recommendations: ["Do not enter a password you currently use. Try a new, unique passphrase."],
    };
  }

  const lower = candidate.toLowerCase();
  const uniqueCharacterRatio = new Set(candidate).size / candidate.length;
  const characterGroups = [/[a-z]/.test(candidate), /[A-Z]/.test(candidate), /\d/.test(candidate), /[^A-Za-z0-9]/.test(candidate)].filter(Boolean).length;
  const predictableExample = predictableExamples.has(lower) || ["1234", "abcd", "qwerty"].some((sequence) => lower.includes(sequence));
  const repeatedRun = /(.|\n)\1{3,}/.test(candidate);
  const lengthPoints = Math.min(40, Math.floor((candidate.length / 16) * 40));
  const uniquenessPoints = Math.round(uniqueCharacterRatio * 20);
  const varietyPoints = Math.min(20, characterGroups * 5);
  const score = Math.max(0, Math.min(100, lengthPoints + uniquenessPoints + varietyPoints - (predictableExample ? 35 : 0) - (repeatedRun ? 15 : 0)));
  const recommendations: string[] = [];

  if (candidate.length < 15) recommendations.push("Consider a longer passphrase. Length usually helps more than adding decorative symbols.");
  if (uniqueCharacterRatio < 0.55) recommendations.push("Use less repetition and avoid predictable sequences.");
  if (predictableExample) recommendations.push("This resembles a very predictable example; choose an unrelated phrase.");
  if (repeatedRun) recommendations.push("Avoid long repeated-character runs.");
  if (recommendations.length === 0) recommendations.push("This candidate scores well under the local heuristic. Keep it unique to one account.");
  recommendations.push("This tool cannot detect password reuse. A separate optional lookup can check breach exposure. Never paste a password you currently use for an important account.");

  const rating = score >= 80 ? "Strong heuristic" : score >= 60 ? "Good" : score >= 40 ? "Fair" : "Needs improvement";
  return { score, rating, length: candidate.length, uniqueCharacterRatio, characterGroups, predictableExample, repeatedRun, recommendations };
}
