from __future__ import annotations
import hashlib
import math
import re
import httpx
from app.core.config import settings


def _demo_vector(text: str) -> list[float]:
    """Deterministic feature-hash vector for offline smoke tests, not production embeddings."""
    dims = settings.EMBEDDING_DIMENSIONS
    vector = [0.0] * dims
    tokens = re.findall(r"[a-zA-Z0-9_]+", (text or '').lower())
    if not tokens:
        tokens = ['empty']
    for token in tokens:
        digest = hashlib.blake2b(token.encode('utf-8'), digest_size=16).digest()
        index = int.from_bytes(digest[:8], 'big') % dims
        sign = 1.0 if digest[8] & 1 else -1.0
        vector[index] += sign
    norm = math.sqrt(sum(value * value for value in vector)) or 1.0
    return [value / norm for value in vector]


async def embed_texts(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []
    provider = settings.EMBEDDING_PROVIDER.lower()
    if provider == 'demo':
        return [_demo_vector(text) for text in texts]
    if provider == 'ollama':
        results: list[list[float]] = []
        async with httpx.AsyncClient(timeout=120) as client:
            for text in texts:
                response = await client.post(
                    f'{settings.OLLAMA_BASE_URL.rstrip("/")}/api/embeddings',
                    json={'model': settings.EMBEDDING_MODEL, 'prompt': text},
                )
                response.raise_for_status()
                vector = response.json().get('embedding')
                if not vector:
                    raise RuntimeError('Ollama did not return an embedding.')
                if len(vector) != settings.EMBEDDING_DIMENSIONS:
                    raise RuntimeError(f'Embedding size mismatch: got {len(vector)}, expected {settings.EMBEDDING_DIMENSIONS}.')
                results.append(vector)
        return results
    if provider in {'litellm', 'vllm'}:
        from litellm import aembedding
        response = await aembedding(
            model=settings.EMBEDDING_MODEL,
            input=texts,
            api_base=settings.LITELLM_API_BASE,
            api_key=settings.LITELLM_API_KEY,
        )
        vectors = [item['embedding'] for item in response.data]
        if any(len(vector) != settings.EMBEDDING_DIMENSIONS for vector in vectors):
            raise RuntimeError('vLLM embedding dimensions do not match EMBEDDING_DIMENSIONS in backend/.env.')
        return vectors
    raise RuntimeError('Unsupported EMBEDDING_PROVIDER. Use demo, ollama, or litellm.')


async def embed_query(text: str) -> list[float]:
    return (await embed_texts([text]))[0]
