// Uzbek Latin <-> Cyrillic Transliteration Engine

const CYRILLIC_VOWELS = new Set("аеёиоуўэюяАЕЁИОУЎЭЮЯaeiouAEIOU");

const CYRILLIC_TO_LATIN_MAP: Record<string, string> = {
  А: "A", а: "a",
  Б: "B", б: "b",
  В: "V", в: "v",
  Г: "G", г: "g",
  Д: "D", д: "d",
  Ж: "J", ж: "j",
  З: "Z", з: "z",
  И: "I", и: "i",
  Й: "Y", й: "y",
  К: "K", к: "k",
  Л: "L", л: "l",
  М: "M", м: "m",
  Н: "N", н: "n",
  О: "O", о: "o",
  П: "P", п: "p",
  Р: "R", р: "r",
  С: "S", с: "s",
  Т: "T", т: "t",
  У: "U", у: "u",
  Ф: "F", ф: "f",
  Х: "X", х: "x",
  Ҳ: "H", ҳ: "h",
  Ч: "Ch", ч: "ch",
  Ш: "Sh", ш: "sh",
  Щ: "Sh", щ: "sh",
  Ц: "Ts", ц: "ts",
  Ё: "Yo", ё: "yo",
  Ю: "Yu", ю: "yu",
  Я: "Ya", я: "ya",
  Ў: "O'", ў: "o'",
  Ғ: "G'", ғ: "g'",
  Қ: "Q", қ: "q",
  Э: "E", э: "e",
  Ъ: "'", ъ: "'",
  Ь: "", ь: "",
};

const LATIN_DIGRAPHS: [string, string][] = [
  ["SH", "Ш"], ["Sh", "Ш"], ["sh", "ш"],
  ["CH", "Ч"], ["Ch", "Ч"], ["ch", "ч"],
  ["YO", "Ё"], ["Yo", "Ё"], ["yo", "ё"],
  ["YU", "Ю"], ["Yu", "Ю"], ["yu", "ю"],
  ["YA", "Я"], ["Ya", "Я"], ["ya", "я"],
  ["YE", "Е"], ["Ye", "Е"], ["ye", "е"],
  ["O'", "Ў"], ["o'", "ў"],
  ["G'", "Ғ"], ["g'", "ғ"],
  ["TS", "Ц"], ["Ts", "Ц"], ["ts", "ц"],
];

const SINGLE_LATIN_TO_CYRILLIC: Record<string, string> = {
  A: "А", a: "а",
  B: "Б", b: "б",
  D: "Д", d: "д",
  F: "Ф", f: "ф",
  G: "Г", g: "г",
  H: "Ҳ", h: "ҳ",
  I: "И", i: "и",
  J: "Ж", j: "ж",
  K: "К", k: "к",
  L: "Л", l: "л",
  M: "М", m: "м",
  N: "Н", n: "н",
  O: "О", o: "о",
  P: "П", p: "п",
  Q: "Қ", q: "қ",
  R: "Р", r: "р",
  S: "С", s: "с",
  T: "Т", t: "т",
  U: "У", u: "у",
  V: "В", v: "в",
  X: "Х", x: "х",
  Y: "Й", y: "й",
  Z: "З", z: "з",
};

const CYRILLIC_CHAR_REGEX = /[\u0400-\u04FF]/;

/**
 * Returns true if text contains at least one Cyrillic character.
 */
export function containsCyrillic(text?: string | null): boolean {
  if (!text) return false;
  return CYRILLIC_CHAR_REGEX.test(text);
}

/**
 * Returns true if majority of alphabetic letters in text are Cyrillic.
 */
export function isCyrillic(text?: string | null): boolean {
  if (!text) return false;
  let cyr = 0;
  let lat = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= 0x0400 && code <= 0x04ff) cyr++;
    else if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122)) lat++;
  }
  return cyr > lat;
}

/**
 * Transliterates Uzbek Cyrillic text to Uzbek Latin script.
 * Preserves casing, applies initial/post-vowel "Ye" vs post-consonant "E".
 */
export function toLatin(text?: string | null): string {
  if (!text) return "";

  const result: string[] = [];
  const n = text.length;

  for (let i = 0; i < n; i++) {
    const char = text[i];

    if (char === "Е" || char === "е") {
      const prevChar = i > 0 ? text[i - 1] : "";
      const isStartOrVowel =
        i === 0 ||
        CYRILLIC_VOWELS.has(prevChar) ||
        " \t\n\r\f\v\"'«»—–-([{<ъЪьЬ’‘`".includes(prevChar);

      const nextChar = i + 1 < n ? text[i + 1] : "";
      const isCapsNext = nextChar >= "A" && nextChar <= "Z";

      if (char === "Е") {
        result.push(isStartOrVowel ? (isCapsNext ? "YE" : "Ye") : "E");
      } else {
        result.push(isStartOrVowel ? "ye" : "e");
      }
      continue;
    }

    if (char in CYRILLIC_TO_LATIN_MAP) {
      let mapped = CYRILLIC_TO_LATIN_MAP[char];
      const nextChar = i + 1 < n ? text[i + 1] : "";
      if (char === char.toUpperCase() && nextChar === nextChar.toUpperCase() && mapped.length > 1) {
        mapped = mapped.toUpperCase();
      }
      result.push(mapped);
    } else {
      result.push(char);
    }
  }

  return result.join("");
}

/**
 * Transliterates Uzbek Latin text to Uzbek Cyrillic script.
 */
export function toCyrillic(text?: string | null): string {
  if (!text) return "";

  // Normalize quotes
  let s = text.replace(/[‘’ʻ`]/g, "'");

  // Multi-character digraphs
  for (const [lat, cyr] of LATIN_DIGRAPHS) {
    s = s.split(lat).join(cyr);
  }

  const result: string[] = [];
  const n = s.length;
  const cyrVowels = new Set("аоуиэеёюяўАОУИЭЕЁЮЯЎ");

  for (let i = 0; i < n; i++) {
    const char = s[i];

    if (char === "E" || char === "e") {
      const prevChar = i > 0 ? s[i - 1] : "";
      const isStartOrVowel =
        i === 0 ||
        cyrVowels.has(prevChar) ||
        " \t\n\r\f\v\"'«»—–-([{<".includes(prevChar);

      if (isStartOrVowel) {
        result.push(char === "E" ? "Э" : "э");
      } else {
        result.push(char === "E" ? "Е" : "е");
      }
      continue;
    }

    if (char === "'") {
      const prevChar = i > 0 ? s[i - 1] : "";
      const nextChar = i + 1 < n ? s[i + 1] : "";
      if (prevChar && !cyrVowels.has(prevChar) && cyrVowels.has(nextChar)) {
        result.push("ъ");
      } else {
        result.push("'");
      }
      continue;
    }

    if (char in SINGLE_LATIN_TO_CYRILLIC) {
      result.push(SINGLE_LATIN_TO_CYRILLIC[char]);
    } else {
      result.push(char);
    }
  }

  return result.join("");
}

/**
 * Smart transliteration helper based on target script.
 */
export function transliterateText(text?: string | null, targetScript: "latn" | "cyrl" = "latn"): string {
  if (!text) return "";
  if (targetScript === "latn") {
    return containsCyrillic(text) ? toLatin(text) : text;
  } else {
    return !containsCyrillic(text) ? toCyrillic(text) : text;
  }
}
