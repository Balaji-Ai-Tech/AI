#!/usr/bin/env python3
"""Authenticated end-to-end smoke checks for a running TransformHub API.

Usage: python scripts/smoke_test.py [base_url]
The default demo provider supports this offline workflow without a model download.
"""
import json
import sys
import urllib.error
import urllib.request
import uuid

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000").rstrip("/")


AUTH_TOKEN = None


def request(path, method="GET", payload=None, expected=(200,), timeout=240):
    data = None if payload is None else json.dumps(payload).encode()
    headers = {"Accept": "application/json"}
    if AUTH_TOKEN:
        headers["Authorization"] = f"Bearer {AUTH_TOKEN}"
    if data is not None:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(BASE + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            status, body = response.status, response.read()
    except urllib.error.HTTPError as exc:
        status, body = exc.code, exc.read()
    if status not in expected:
        detail = body.decode(errors="replace")
        raise RuntimeError(f"{method} {path}: expected {expected}, got {status}: {detail[:400]}")
    try:
        return status, json.loads(body) if body else {}
    except json.JSONDecodeError:
        return status, body


def main():
    passed = []

    _, health = request("/health")
    assert health.get("status") == "healthy", health
    passed.append("liveness health")

    _, ready = request("/health/ready")
    assert ready.get("status") == "ready", ready
    passed.append("database readiness")

    global AUTH_TOKEN
    _, session = request("/api/auth/guest", "POST", {}, expected=(200,))
    AUTH_TOKEN = session.get("access_token")
    assert AUTH_TOKEN, session
    _, account = request("/api/auth/me")
    assert account.get("role") == "guest", account
    passed.append("private guest authentication")

    _, transformation = request(
        "/api/transformations",
        "POST",
        {"title": f"Smoke test {uuid.uuid4().hex[:8]}", "summary": "", "configuration": {}},
        expected=(201,),
    )
    transformation_id = transformation.get("id")
    assert transformation_id, transformation
    passed.append("create transformation in isolated account")

    source = (
        "TransformHub smoke-test source. "
        "The service reduced processing time by 30 percent during the April pilot. "
        "Teams should verify this result against the original operational report."
    )
    _, uploaded = request(
        "/api/uploads/text",
        "POST",
        {"transformation_id": transformation_id, "filename": "smoke-source.txt", "content": source},
        expected=(201,),
    )
    assert uploaded.get("text_length", 0) > 0, uploaded
    passed.append("text ingestion and indexing")

    _, generated = request(
        f"/api/transformations/{transformation_id}/generate",
        "POST",
        {"output_types": ["executive_summary"], "languages": ["en"]},
    )
    outputs = generated.get("outputs", [])
    assert len(outputs) == 1 and outputs[0].get("content"), generated
    output_id = outputs[0]["id"]
    passed.append("source-grounded output generation")

    _, reviewed = request(
        f"/api/transformations/{transformation_id}/outputs/{output_id}/review",
        "POST",
        {"decision": "approve", "comment": "Smoke test approval"},
    )
    assert reviewed.get("output", {}).get("status") == "approved", reviewed
    passed.append("human review and approval")

    _, export = request(
        f"/api/transformations/{transformation_id}/outputs/{output_id}/export?format=md",
        timeout=30,
    )
    assert isinstance(export, bytes) and export, "Markdown export was empty."
    passed.append("approved Markdown export")

    print("PASS: " + "; ".join(passed))
    print(f"Completed {len(passed)} smoke checks against {BASE}")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        sys.exit(1)
