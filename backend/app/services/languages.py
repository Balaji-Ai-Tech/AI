from __future__ import annotations

from collections.abc import Iterable
import unicodedata


OUTPUT_LANGUAGES = {
    'en': 'English',
    'te': 'Telugu',
    'ta': 'Tamil',
    'hi': 'Hindi',
    'kn': 'Kannada',
    'ml': 'Malayalam',
    'mr': 'Marathi',
    'bn': 'Bengali',
    'gu': 'Gujarati',
    'pa': 'Punjabi',
    'ur': 'Urdu',
    'or': 'Odia',
    'es': 'Spanish',
    'fr': 'French',
    'de': 'German',
    'ja': 'Japanese',
    'zh': 'Chinese',
    'ko': 'Korean',
    'ar': 'Arabic',
    'pt': 'Portuguese',
}

LANGUAGE_CODES_BY_NAME = {
    name.casefold(): code for code, name in OUTPUT_LANGUAGES.items()
}
SCRIPT_RANGES = {
    'te': ((0x0C00, 0x0C7F),),
    'ta': ((0x0B80, 0x0BFF),),
    'hi': ((0x0900, 0x097F),),
    'mr': ((0x0900, 0x097F),),
    'kn': ((0x0C80, 0x0CFF),),
    'ml': ((0x0D00, 0x0D7F),),
    'bn': ((0x0980, 0x09FF),),
    'gu': ((0x0A80, 0x0AFF),),
    'pa': ((0x0A00, 0x0A7F),),
    'ur': ((0x0600, 0x06FF), (0x0750, 0x077F), (0x08A0, 0x08FF)),
    'or': ((0x0B00, 0x0B7F),),
    'ar': ((0x0600, 0x06FF), (0x0750, 0x077F), (0x08A0, 0x08FF)),
    'ja': ((0x3040, 0x30FF), (0x4E00, 0x9FFF)),
    'zh': ((0x4E00, 0x9FFF),),
    'ko': ((0x1100, 0x11FF), (0x3130, 0x318F), (0xAC00, 0xD7AF)),
}


def language_output_requirements(language_name: str, language_code: str) -> str:
    return (
        f'Write all user-facing text only in {language_name}; do not translate it into another language. '
        f'A request for several languages is handled as separate generations; this response is only for {language_name} ({language_code}). '
        'Avoid English except for proper names, numbers, and technical terms that should remain unchanged. '
        'Do not add parenthetical English glosses or bilingual restatements. '
        'Preserve facts, names, dates, numbers, security terminology, and technical meaning exactly. '
        'Preserve whether a value increased or decreased and whether an outcome improved or worsened; '
        'do not infer direction or replace one with another. Do not add or reinterpret security concepts. '
        'In software content, interpret "request" as a software or network request, not a personal request or prayer. '
        'If unsure about a technical or security term, keep the original source term verbatim instead of guessing a translation. '
        'Before responding, silently compare every claim against the source and correct any change in meaning.'
    )


def normalize_language_code(value: str) -> str:
    normalized = value.strip().casefold()
    if normalized in OUTPUT_LANGUAGES:
        return normalized
    code = LANGUAGE_CODES_BY_NAME.get(normalized)
    if code:
        return code
    allowed = ', '.join(OUTPUT_LANGUAGES)
    raise ValueError(f'Unsupported target language: {value}. Use one of these language codes: {allowed}.')


def resolve_output_language_codes(requested: list[str] | None, config: dict) -> list[str]:
    selected: Iterable[str] = requested if requested is not None else (
        config.get('languages') or [config.get('language', 'English')]
    )
    result = list(dict.fromkeys(normalize_language_code(value) for value in selected))
    if not result:
        raise ValueError('Select at least one target language.')
    return result


def response_uses_requested_script(text: str, language_code: str) -> bool:
    letters = [character for character in text if character.isalpha()]
    if language_code == 'en':
        latin_letters = sum('LATIN' in unicodedata.name(character, '') for character in letters)
        return latin_letters >= max(3, int(len(letters) * 0.5))

    ranges = SCRIPT_RANGES.get(language_code)
    if not ranges:
        return True

    matching = sum(
        any(start <= ord(character) <= end for start, end in ranges)
        for character in letters
    )
    return matching >= max(3, int(len(letters) * 0.2))
