import re

# Uzbek Cyrillic to Latin mapping
# Vowels in Uzbek Cyrillic
CYRILLIC_VOWELS = set("аеёиоуўэюяАЕЁИОУЎЭЮЯaeiouAEIOU")

CYRILLIC_TO_LATIN_MAP = {
    "А": "A", "а": "a",
    "Б": "B", "б": "b",
    "В": "V", "в": "v",
    "Г": "G", "г": "g",
    "Д": "D", "д": "d",
    "Ж": "J", "ж": "j",
    "З": "Z", "з": "z",
    "И": "I", "и": "i",
    "Й": "Y", "й": "y",
    "К": "K", "к": "k",
    "Л": "L", "л": "l",
    "М": "M", "м": "m",
    "Н": "N", "н": "n",
    "О": "O", "о": "o",
    "П": "P", "п": "p",
    "Р": "R", "р": "r",
    "С": "S", "с": "s",
    "Т": "T", "т": "t",
    "У": "U", "у": "u",
    "Ф": "F", "ф": "f",
    "Х": "X", "х": "x",
    "Ҳ": "H", "ҳ": "h",
    "Ч": "Ch", "ч": "ch",
    "Ш": "Sh", "ш": "sh",
    "Щ": "Sh", "щ": "sh",
    "Ц": "Ts", "ц": "ts",
    "Ё": "Yo", "ё": "yo",
    "Ю": "Yu", "ю": "yu",
    "Я": "Ya", "я": "ya",
    "Ў": "O'", "ў": "o'",
    "Ғ": "G'", "ғ": "g'",
    "Қ": "Q", "қ": "q",
    "Э": "E", "э": "e",
    "Ъ": "'", "ъ": "'",
    "Ь": "", "ь": "",
}

# Regex to check if text contains Cyrillic characters
CYRILLIC_REGEX = re.compile(r"[\u0400-\u04FF]")


def is_cyrillic(text: str) -> bool:
    """Returns True if the majority of alphabetic characters in the text are Cyrillic."""
    if not text:
        return False
    cyr_count = sum(1 for c in text if "\u0400" <= c <= "\u04ff")
    lat_count = sum(1 for c in text if ("a" <= c <= "z" or "A" <= c <= "Z"))
    return cyr_count > lat_count


def contains_cyrillic(text: str) -> bool:
    """Returns True if text contains at least one Cyrillic character."""
    if not text:
        return False
    return bool(CYRILLIC_REGEX.search(text))


def to_latin(text: str) -> str:
    """
    Transliterates Uzbek Cyrillic text to Uzbek Latin script.
    Follows official Uzbek orthography rules:
    - Е/е at word start or after a vowel/punctuation/apostrophe -> Ye/ye.
    - Е/е after a consonant -> E/e.
    - Preserves case (including ALL CAPS words).
    - Uses standard single quote ' for O', G', and tutuq belgisi (Ъ).
    """
    if not text:
        return text

    result = []
    n = len(text)

    for i, char in enumerate(text):
        if char == "Е" or char == "е":
            # Check previous character
            prev_char = text[i - 1] if i > 0 else ""
            is_start_or_vowel = (
                i == 0
                or prev_char in CYRILLIC_VOWELS
                or prev_char in " \t\n\r\f\v\"'«»—–-([{<"
                or prev_char in "ъЪьЬ’‘`"
            )

            # Check next character for all-caps context
            next_char = text[i + 1] if i + 1 < n else ""
            is_caps_next = next_char.isupper()

            if char == "Е":
                if is_start_or_vowel:
                    result.append("YE" if is_caps_next else "Ye")
                else:
                    result.append("E")
            else:  # char == "е"
                if is_start_or_vowel:
                    result.append("ye")
                else:
                    result.append("e")
            continue

        # Look up in standard map
        if char in CYRILLIC_TO_LATIN_MAP:
            mapped = CYRILLIC_TO_LATIN_MAP[char]
            # Handle title-cased digraphs in all-caps context, e.g. "ЧОП" -> "CHOP"
            next_char = text[i + 1] if i + 1 < n else ""
            if char.isupper() and next_char.isupper() and len(mapped) > 1:
                mapped = mapped.upper()
            result.append(mapped)
        else:
            result.append(char)

    return "".join(result)


def to_cyrillic(text: str) -> str:
    """
    Transliterates Uzbek Latin text to Uzbek Cyrillic script.
    Handles multi-character sequences (ch, sh, yo, yu, ya, ye, o', g')
    and vowels like e/э appropriately.
    """
    if not text:
        return text

    # Normalize various apostrophes
    s = text.replace("‘", "'").replace("’", "'").replace("ʻ", "'").replace("`", "'")

    # Multi-character replacements (case-sensitive)
    # Order matters: longer combinations first
    replacements = [
        # Digraphs
        ("SH", "Ш"), ("Sh", "Ш"), ("sh", "ш"),
        ("CH", "Ч"), ("Ch", "Ч"), ("ch", "ч"),
        ("YO", "Ё"), ("Yo", "Ё"), ("yo", "ё"),
        ("YU", "Ю"), ("Yu", "Ю"), ("yu", "ю"),
        ("YA", "Я"), ("Ya", "Я"), ("ya", "я"),
        ("YE", "Е"), ("Ye", "Е"), ("ye", "е"),
        ("O'", "Ў"), ("o'", "ў"),
        ("G'", "Ғ"), ("g'", "ғ"),
        ("TS", "Ц"), ("Ts", "Ц"), ("ts", "ц"),
    ]

    for lat, cyr in replacements:
        s = s.replace(lat, cyr)

    # Now single letters
    single_latin_to_cyrillic = {
        "A": "А", "a": "а",
        "B": "Б", "b": "б",
        "D": "Д", "d": "д",
        "F": "Ф", "f": "ф",
        "G": "Г", "g": "г",
        "H": "Ҳ", "h": "ҳ",
        "I": "И", "i": "и",
        "J": "Ж", "j": "ж",
        "K": "К", "k": "к",
        "L": "Л", "l": "л",
        "M": "М", "m": "м",
        "N": "Н", "n": "н",
        "O": "О", "o": "о",
        "P": "П", "p": "п",
        "Q": "Қ", "q": "қ",
        "R": "Р", "r": "р",
        "S": "С", "s": "с",
        "T": "Т", "t": "т",
        "U": "У", "u": "у",
        "V": "В", "v": "в",
        "X": "Х", "x": "х",
        "Y": "Й", "y": "й",
        "Z": "З", "z": "з",
    }

    result = []
    n = len(s)
    vowels = set("аоуиэеёюяўАОУИЭЕЁЮЯЎ")

    for i, char in enumerate(s):
        if char == "E" or char == "e":
            prev_char = s[i - 1] if i > 0 else ""
            is_start_or_vowel = (
                i == 0
                or prev_char in vowels
                or prev_char in " \t\n\r\f\v\"'«»—–-([{<"
            )
            if is_start_or_vowel:
                result.append("Э" if char == "E" else "э")
            else:
                result.append("Е" if char == "E" else "е")
            continue

        if char == "'":
            # If after a consonant and before a vowel, convert to Ъ (tutuq)
            prev_char = s[i - 1] if i > 0 else ""
            next_char = s[i + 1] if i + 1 < n else ""
            if prev_char and prev_char not in vowels and next_char in vowels:
                result.append("ъ")
            else:
                result.append("'")
            continue

        if char in single_latin_to_cyrillic:
            result.append(single_latin_to_cyrillic[char])
        else:
            result.append(char)

    return "".join(result)


def get_search_variants(term: str) -> list[str]:
    """
    Given a search term, returns variants in both scripts so queries match
    regardless of whether the book or the user's input is in Latin or Cyrillic.
    Includes case variations (lower, title, upper) for database backends like SQLite
    where LIKE/ILIKE on non-ASCII characters is case-sensitive.
    """
    if not term or not term.strip():
        return []

    clean = term.strip()
    base_variants = [clean]

    if contains_cyrillic(clean):
        lat = to_latin(clean)
        if lat and lat != clean:
            base_variants.append(lat)
            if "'" in lat:
                base_variants.append(lat.replace("'", "‘"))
    else:
        cyr = to_cyrillic(clean)
        if cyr and cyr != clean:
            base_variants.append(cyr)

    # Expand case variations for each base variant
    all_variants = []
    for b in base_variants:
        all_variants.extend([b, b.lower(), b.capitalize(), b.title(), b.upper()])

    # Deduplicate preserving order
    seen = set()
    deduped = []
    for v in all_variants:
        if v not in seen:
            seen.add(v)
            deduped.append(v)

    return deduped
