"""Vietnamese text processing utilities"""
import re
import unicodedata

# Vietnamese teencode and abbreviations
TEENCODE_MAP = {
    "k": "không",
    "ko": "không",
    "k0": "không",
    "dc": "được",
    "đc": "được",
    "vs": "với",
    "j": "gì",
    "z": "vậy",
    "r": "rồi",
    "m": "mình",
    "b": "bạn",
    "a": "anh",
    "e": "em",
    "cf": "cafe",
    "coffe": "coffee",
    "cofee": "coffee",
}

# Common typos
TYPO_MAP = {
    "grap": "grab",
    "grabs": "grab",
    "shoppee": "shopee",
    "lazda": "lazada",
    "netfix": "netflix",
    "spotifi": "spotify",
    "hoá đơn": "hóa đơn",
    "điện thoai": "điện thoại",
    "cà fê": "cà phê",
    "ca phe": "cà phê",
    "tra sua": "trà sữa",
}


def normalize_unicode(text: str) -> str:
    """Normalize unicode characters"""
    # NFC normalization for Vietnamese
    return unicodedata.normalize("NFC", text)


def remove_special_chars(text: str) -> str:
    """Remove special characters but keep Vietnamese diacritics"""
    # Keep alphanumeric, spaces, and Vietnamese characters
    pattern = r"[^\w\sàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]"
    return re.sub(pattern, " ", text, flags=re.IGNORECASE)


def normalize_whitespace(text: str) -> str:
    """Normalize whitespace"""
    return re.sub(r"\s+", " ", text).strip()


def apply_teencode_map(text: str) -> str:
    """Replace teencode with full words"""
    words = text.split()
    result = []
    for word in words:
        lower_word = word.lower()
        if lower_word in TEENCODE_MAP:
            result.append(TEENCODE_MAP[lower_word])
        else:
            result.append(word)
    return " ".join(result)


def apply_typo_corrections(text: str) -> str:
    """Fix common typos"""
    result = text
    for typo, correction in TYPO_MAP.items():
        pattern = re.compile(re.escape(typo), re.IGNORECASE)
        result = pattern.sub(correction, result)
    return result


def preprocess_text(text: str) -> str:
    """
    Full preprocessing pipeline for Vietnamese text

    1. Normalize unicode
    2. Lowercase
    3. Apply typo corrections
    4. Apply teencode mapping
    5. Remove special characters
    6. Normalize whitespace
    """
    if not text:
        return ""

    # Step 1: Normalize unicode
    text = normalize_unicode(text)

    # Step 2: Lowercase
    text = text.lower()

    # Step 3: Apply typo corrections
    text = apply_typo_corrections(text)

    # Step 4: Apply teencode mapping
    text = apply_teencode_map(text)

    # Step 5: Remove special characters
    text = remove_special_chars(text)

    # Step 6: Normalize whitespace
    text = normalize_whitespace(text)

    return text


def tokenize_vietnamese(text: str) -> list[str]:
    """
    Simple Vietnamese tokenizer
    For better results, use underthesea.word_tokenize
    """
    try:
        from underthesea import word_tokenize
        return word_tokenize(text)
    except ImportError:
        # Fallback to simple split
        return text.split()


if __name__ == "__main__":
    # Test preprocessing
    test_cases = [
        "Ăn phở 50k",
        "đi grap 30k",
        "cf vs bạn 25k",
        "mua shoppee 100k",
        "tiền điện tháng 12",
    ]

    print("Text preprocessing tests:")
    for text in test_cases:
        processed = preprocess_text(text)
        print(f"  {text!r} -> {processed!r}")
