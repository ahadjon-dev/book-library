import re


def normalize(raw: str | None) -> str:
    if not raw:
        return ""
    # Strip whitespace, hyphens, and ensure uppercase (for X check digit)
    cleaned = re.sub(r"[\s\-]", "", str(raw)).upper()
    return cleaned


def is_valid_isbn10(isbn: str) -> bool:
    clean = normalize(isbn)
    if len(clean) != 10:
        return False
    if not (clean[:9].isdigit() and (clean[9].isdigit() or clean[9] == "X")):
        return False
    total = 0
    for i, char in enumerate(clean):
        val = 10 if char == "X" else int(char)
        total += val * (10 - i)
    return total % 11 == 0


def is_valid_isbn13(isbn: str) -> bool:
    clean = normalize(isbn)
    if len(clean) != 13 or not clean.isdigit():
        return False
    if not (clean.startswith("978") or clean.startswith("979")):
        return False
    total = 0
    for i, char in enumerate(clean):
        weight = 1 if i % 2 == 0 else 3
        total += int(char) * weight
    return total % 10 == 0


def is_valid(isbn: str | None) -> bool:
    if not isbn:
        return False
    clean = normalize(isbn)
    if len(clean) == 10:
        return is_valid_isbn10(clean)
    if len(clean) == 13:
        return is_valid_isbn13(clean)
    return False


def to_isbn13(isbn10: str) -> str | None:
    clean = normalize(isbn10)
    if not is_valid_isbn10(clean):
        return None
    core = "978" + clean[:9]
    total = 0
    for i, char in enumerate(core):
        weight = 1 if i % 2 == 0 else 3
        total += int(char) * weight
    check_digit = (10 - (total % 10)) % 10
    return core + str(check_digit)


def to_isbn10(isbn13: str) -> str | None:
    clean = normalize(isbn13)
    if not is_valid_isbn13(clean) or not clean.startswith("978"):
        return None
    core = clean[3:12]
    total = 0
    for i, char in enumerate(core):
        total += int(char) * (10 - i)
    rem = total % 11
    check_val = (11 - rem) % 11
    check_char = "X" if check_val == 10 else str(check_val)
    return core + check_char


def both_forms(isbn: str | None) -> list[str]:
    if not isbn:
        return []
    clean = normalize(isbn)
    if len(clean) == 10:
        c13 = to_isbn13(clean)
        return [clean, c13] if c13 else [clean]
    elif len(clean) == 13:
        c10 = to_isbn10(clean)
        return [clean, c10] if c10 else [clean]
    return [clean] if clean else []
