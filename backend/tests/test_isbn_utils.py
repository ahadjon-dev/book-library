import pytest
from app.services.isbn_utils import (
    both_forms,
    is_valid,
    is_valid_isbn10,
    is_valid_isbn13,
    normalize,
    to_isbn10,
    to_isbn13,
)


def test_normalize():
    assert normalize("978-0-306-40615-7") == "9780306406157"
    assert normalize("0-306-40615-2") == "0306406152"
    assert normalize(" 0 306 40615 2 ") == "0306406152"
    assert normalize("0-19-853453-1") == "0198534531"
    assert normalize("0-8044-2957-x") == "080442957X"
    assert normalize(None) == ""


def test_isbn10_validation():
    # Valid ISBN-10 with numeric check digit
    assert is_valid_isbn10("0-306-40615-2") is True
    # Valid ISBN-10 with X check digit
    assert is_valid_isbn10("0-8044-2957-X") is True
    # Invalid check digit
    assert is_valid_isbn10("0-306-40615-3") is False
    # Invalid length
    assert is_valid_isbn10("030640615") is False


def test_isbn13_validation():
    # Valid ISBN-13
    assert is_valid_isbn13("978-0-306-40615-7") is True
    assert is_valid_isbn13("9780201616224") is True
    # Invalid check digit
    assert is_valid_isbn13("978-0-306-40615-8") is False
    # Doesn't start with 978 or 979
    assert is_valid_isbn13("1234567890128") is False


def test_generic_is_valid():
    assert is_valid("0-306-40615-2") is True
    assert is_valid("978-0-306-40615-7") is True
    assert is_valid("080442957X") is True
    assert is_valid("12345") is False
    assert is_valid("") is False
    assert is_valid(None) is False


def test_conversion_between_forms():
    # 0306406152 <-> 9780306406157
    isbn10 = "0306406152"
    isbn13 = "9780306406157"
    assert to_isbn13(isbn10) == isbn13
    assert to_isbn10(isbn13) == isbn10

    # 080442957X <-> 9780804429573
    assert to_isbn13("080442957X") == "9780804429573"
    assert to_isbn10("9780804429573") == "080442957X"


def test_both_forms():
    assert set(both_forms("0306406152")) == {"0306406152", "9780306406157"}
    assert set(both_forms("9780306406157")) == {"0306406152", "9780306406157"}
    assert both_forms("") == []
