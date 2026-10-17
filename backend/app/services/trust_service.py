"""Lightweight MVP trust checks. These checks are advisory, not a guarantee of factuality."""
import re
from typing import Any

EMAIL_RE = re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.I)
PHONE_RE = re.compile(r"(?<!\w)(?:\+?91[\s-]?)?[6-9]\d{9}(?!\w)")
AADHAAR_RE = re.compile(r"(?<!\d)\d{4}[ -]?\d{4}[ -]?\d{4}(?!\d)")


def detect_pii(text: str) -> list[dict[str, str]]:
    """Return only type and masked sample; never return full matched personal data."""
    findings: list[dict[str, str]] = []
    patterns = [("email", EMAIL_RE), ("phone", PHONE_RE), ("possible_id_number", AADHAAR_RE)]
    for kind, pattern in patterns:
        for match in pattern.finditer(text or ""):
            raw = match.group(0)
            masked = (raw[:2] + "***" + raw[-2:]) if len(raw) > 5 else "***"
            findings.append({"type": kind, "masked_sample": masked})
            if len(findings) >= 50:
                return findings
    return findings


def validate_output(content: str, payload: dict[str, Any] | None, valid_chunk_ids: set[str]) -> dict[str, Any]:
    payload = payload or {}
    evidence = payload.get("evidence") if isinstance(payload.get("evidence"), list) else []
    claims = payload.get("claims") if isinstance(payload.get("claims"), list) else []
    cited_ids: set[str] = set()
    invalid_claims = 0
    for claim in claims:
        if not isinstance(claim, dict):
            invalid_claims += 1
            continue
        ids = claim.get("evidence_chunk_ids") if isinstance(claim.get("evidence_chunk_ids"), list) else []
        ids = {str(value) for value in ids}
        if not ids:
            invalid_claims += 1
        cited_ids.update(ids)
    unknown = sorted(cited_ids - valid_chunk_ids)
    pii = detect_pii(content)
    issues: list[str] = []
    if not (content or "").strip():
        issues.append("Output content is empty.")
    if not evidence:
        issues.append("No source evidence references were attached to this output.")
    if not claims:
        issues.append("No claim-level evidence mapping was attached to this output.")
    if invalid_claims:
        issues.append(f"{invalid_claims} claim(s) have no evidence mapping.")
    if unknown:
        issues.append("One or more claim evidence references do not belong to this transformation.")
    if pii:
        issues.append(f"Potential personal data detected ({len(pii)} finding(s)); review before sharing.")
    return {
        "passed": not issues,
        "status": "pass" if not issues else "needs_review",
        "issues": issues,
        "evidence_reference_count": len(cited_ids),
        "invalid_evidence_reference_count": len(unknown),
        "unmapped_claim_count": invalid_claims,
        "pii_findings": pii,
        "pii_scan_scope": "email, phone number, and possible 12-digit ID pattern only; not comprehensive",
        "human_review_required": True,
    }
