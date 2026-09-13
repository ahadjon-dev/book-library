import pytest
from app.services.translit import (
    contains_cyrillic,
    get_search_variants,
    is_cyrillic,
    to_cyrillic,
    to_latin,
)


def test_cyrillic_to_latin_famous_books():
    assert to_latin("Саодат асри") == "Saodat asri"
    assert to_latin("Руҳий тарбия") == "Ruhiy tarbiya"
    assert to_latin("Тафсири Ҳилол") == "Tafsiri Hilol"
    assert to_latin("Кифоя") == "Kifoya"
    assert to_latin("Шайх Муҳаммад Содиқ Муҳаммад Юсуф") == "Shayx Muhammad Sodiq Muhammad Yusuf"
    assert to_latin("Ўзбекистон") == "O'zbekiston"
    assert to_latin("Ғафур Ғулом") == "G'afur G'ulom"
    assert to_latin("Қуръони Карим") == "Qur'oni Karim"
    assert to_latin("Чўлпон") == "Cho'lpon"


def test_ye_and_e_rules():
    # Word initial: Ye
    assert to_latin("Ер юзи") == "Yer yuzi"
    assert to_latin("Етти") == "Yetti"
    # After vowel: ye
    assert to_latin("Кийиниш") == "Kiyinish"
    assert to_latin("Океан") == "Okean"
    # After consonant: e
    assert to_latin("Керак") == "Kerak"
    assert to_latin("Бер") == "Ber"
    assert to_latin("Шер") == "Sher"
    assert to_latin("Менинг кутубхонам") == "Mening kutubxonam"


def test_latin_to_cyrillic():
    assert to_cyrillic("Saodat asri") == "Саодат асри"
    assert to_cyrillic("Ruhiy tarbiya") == "Руҳий тарбия"
    assert to_cyrillic("Kifoya") == "Кифоя"
    assert to_cyrillic("O'zbekiston") == "Ўзбекистон"
    assert to_cyrillic("G'afur G'ulom") == "Ғафур Ғулом"
    assert to_cyrillic("Cho'lpon") == "Чўлпон"
    assert to_cyrillic("Shayx") == "Шайх"
    assert to_cyrillic("Eshik") == "Эшик"
    assert to_cyrillic("Kerak") == "Керак"


def test_is_and_contains_cyrillic():
    assert is_cyrillic("Саодат асри") is True
    assert is_cyrillic("Saodat asri") is False
    assert is_cyrillic("") is False

    assert contains_cyrillic("Саодат") is True
    assert contains_cyrillic("Book Саодат") is True
    assert contains_cyrillic("Book in English") is False


def test_search_variants():
    v1 = get_search_variants("Saodat")
    assert "Saodat" in v1
    assert "Саодат" in v1

    v2 = get_search_variants("Саодат")
    assert "Саодат" in v2
    assert "Saodat" in v2

    v3 = get_search_variants("O'zbek")
    assert "O'zbek" in v3
    assert "Ўзбек" in v3
