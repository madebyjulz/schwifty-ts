"""Evaluate the Python schwifty package over a generated corpus.

Called by scripts/parity-upstream.ts, which replays every case against the
TypeScript port. Python is the source of truth, so this side owns the corpus,
the attribute lists and the expected results. Run it through the submodule's
environment:

    uv run --frozen --project schwifty-py python scripts/parity_upstream.py out.json

When upstream adds a public attribute, add it to the lists below: a missing
counterpart in the port then shows up as a mismatch.
"""

from __future__ import annotations

import enum
import json
import random
import sys
import warnings
from collections import defaultdict
from collections.abc import Callable, Iterator
from typing import Any

from schwifty import BIC, IBAN, registry

SEED = 97
SAMPLES_PER_COUNTRY = 25
MUTATIONS_PER_SAMPLE = 2
BANKS_PER_CHECKSUM_METHOD = 4
ACCOUNTS_PER_BANK = 40
MIN_ACCOUNT_DIGITS = 3
GERMAN_ACCOUNT_DIGITS = 10

IBAN_ATTRIBUTES = [
    "compact",
    "formatted",
    "length",
    "is_valid",
    "numeric",
    "country_code",
    "checksum_digits",
    "national_checksum_digits",
    "bank_code",
    "branch_code",
    "account_code",
    "account_id",
    "account_type",
    "account_holder_id",
    "currency_code",
    "in_sepa_zone",
    "bic",
    "bank_name",
    "bank_short_name",
]
BIC_ATTRIBUTES = [
    "compact",
    "formatted",
    "length",
    "is_valid",
    "country_code",
    "bank_code",
    "location_code",
    "branch_code",
    "type",
    "exists",
    "domestic_bank_codes",
    "bank_names",
    "bank_short_names",
]
BANK_ATTRIBUTES = [
    "country_code",
    "bank_code",
    "bic",
    "name",
    "short_name",
    "primary",
    "checksum_algo",
]


def normalize(value: Any) -> Any:
    """Reduce a result to JSON. `IBAN` and `BIC` are `str` subclasses, so test for them first."""
    if hasattr(value, "compact"):
        return value.compact
    if value is None or isinstance(value, bool | str):
        return value
    if isinstance(value, enum.Enum):
        return normalize(value.value)
    if isinstance(value, int):
        return str(value)
    if isinstance(value, list | tuple):
        return [normalize(item) for item in value]
    return str(value)


def error(exception: Exception) -> dict[str, str]:
    return {"error": type(exception).__name__}


def attributes(target: Any, names: list[str]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for name in names:
        try:
            result[name] = normalize(getattr(target, name))
        except Exception as exception:  # noqa: BLE001 - the exception is the result
            result[name] = error(exception)
    return result


def evaluate(build: Callable[[], Any], names: list[str]) -> dict[str, Any]:
    try:
        target = build()
    except Exception as exception:  # noqa: BLE001 - the exception is the result
        return error(exception)
    return attributes(target, names)


def with_check_digits(country_code: str, bban: str) -> str:
    """Build an IBAN with correct check digits, so only the BBAN can fail validation."""
    digits = "".join(str(int(char, 36)) for char in bban + country_code)
    return f"{country_code}{98 - int(f'{digits}00') % 97:02d}{bban}"


def mutate(bban: str) -> str:
    """Replace one digit of the BBAN, which usually breaks a national checksum."""
    positions = [index for index, char in enumerate(bban) if char.isdigit()]
    if not positions:
        return bban
    position = random.choice(positions)
    return f"{bban[:position]}{random.randrange(10)}{bban[position + 1 :]}"


def sample_ibans() -> Iterator[IBAN]:
    for country_code in sorted(registry.get_countries()):
        for _ in range(SAMPLES_PER_COUNTRY):
            try:
                yield IBAN.random(country_code)
            except Exception:  # noqa: BLE001, S112 - not every country supports generation
                continue


def german_account_ibans() -> Iterator[str]:
    """Random account codes for a few banks of every German checksum method."""
    banks_by_method: dict[str, list[str]] = defaultdict(list)
    for bank in registry.get_banks_by_country("DE"):
        codes = banks_by_method[bank.checksum_algo]
        if bank.bank_code not in codes:
            codes.append(bank.bank_code)

    for _, bank_codes in sorted(banks_by_method.items()):
        for bank_code in random.sample(bank_codes, min(BANKS_PER_CHECKSUM_METHOD, len(bank_codes))):
            for _ in range(ACCOUNTS_PER_BANK):
                digits = random.randint(MIN_ACCOUNT_DIGITS, GERMAN_ACCOUNT_DIGITS)
                account = "".join(random.choices("0123456789", k=digits))
                yield with_check_digits("DE", f"{bank_code}{account.zfill(GERMAN_ACCOUNT_DIGITS)}")


def malformed_ibans(value: str) -> Iterator[str]:
    yield value[:-1]
    yield f"{value}0"
    yield value.lower()
    yield f"XX{value[2:]}"
    yield f"{value[:2]}{(int(value[2:4]) + 1) % 100:02d}{value[4:]}"


def iban_case(value: str) -> dict[str, Any]:
    return {
        "kind": "iban",
        "input": value,
        "expected": evaluate(lambda: IBAN(value, validate_bban=True), IBAN_ATTRIBUTES),
    }


def generate_case(iban: IBAN) -> dict[str, Any]:
    arguments = [iban.country_code, iban.bank_code, iban.account_code, iban.branch_code]
    return {
        "kind": "generate",
        "input": arguments,
        "expected": evaluate(lambda: IBAN.generate(*arguments), IBAN_ATTRIBUTES),
    }


def bic_case(value: str) -> dict[str, Any]:
    return {
        "kind": "bic",
        "input": value,
        "expected": evaluate(lambda: BIC(value), BIC_ATTRIBUTES),
    }


def bank_code_cases(country_code: str, bank_code: str) -> Iterator[dict[str, Any]]:
    arguments = [country_code, bank_code]
    yield {
        "kind": "from_bank_code",
        "input": arguments,
        "expected": evaluate(lambda: BIC.from_bank_code(*arguments), BIC_ATTRIBUTES),
    }
    yield {
        "kind": "banks_by_code",
        "input": arguments,
        "expected": [
            attributes(bank, BANK_ATTRIBUTES)
            for bank in registry.get_banks_by_code(country_code, bank_code)
        ],
    }


def build_cases() -> Iterator[dict[str, Any]]:
    for iban in sample_ibans():
        yield iban_case(iban.compact)
        yield generate_case(iban)
        for _ in range(MUTATIONS_PER_SAMPLE):
            yield iban_case(with_check_digits(iban.country_code, mutate(iban.bban)))
        for value in malformed_ibans(iban.compact):
            yield iban_case(value)

    for value in german_account_ibans():
        yield iban_case(value)

    banks = registry.get_all_banks()
    for country_code, bank_code in sorted({(bank.country_code, bank.bank_code) for bank in banks}):
        yield from bank_code_cases(country_code, bank_code)

    for value in sorted({bank.bic for bank in banks if bank.bic}):
        yield bic_case(value)
        yield bic_case(value[:8])
        yield bic_case(f"{value[:8]}XXX")
        yield bic_case(f"{value[:4]}ZZ{value[6:]}")


def main() -> None:
    (output,) = sys.argv[1:]
    random.seed(SEED)
    # The port is silent by default where upstream emits NationalChecksumNotVerified.
    warnings.simplefilter("ignore")
    with open(output, "w", encoding="utf-8") as file:
        json.dump(list(build_cases()), file, ensure_ascii=False)


if __name__ == "__main__":
    main()
