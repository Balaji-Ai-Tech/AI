import asyncio
from contextlib import asynccontextmanager
from datetime import datetime
from types import SimpleNamespace

from app.api import generation
from app.api.generation import GenerateRequest
from app.db.models import GeneratedOutput
from app.services.ollama_service import OllamaGenerationError


class FakeResult:
    def __init__(self, value):
        self.value = value

    def scalar_one_or_none(self):
        return self.value

    def scalars(self):
        return self

    def all(self):
        return self.value


class FakeSession:
    def __init__(self, transformation, chunks):
        self.transformation = transformation
        self.chunks = chunks
        self.pending = []
        self.saved_outputs = []
        self.commit_count = 0
        self.execute_count = 0

    async def execute(self, _statement):
        self.execute_count += 1
        return FakeResult(self.transformation if self.execute_count == 1 else self.chunks)

    async def commit(self):
        self.commit_count += 1

    def add(self, row):
        self.pending.append(row)

    async def flush(self):
        for row in self.pending:
            if isinstance(row, GeneratedOutput):
                row.id = row.id or f'output-{len(self.saved_outputs) + 1}'
                row.created_at = row.created_at or datetime.now()
                row.updated_at = row.updated_at or row.created_at

    @asynccontextmanager
    async def begin_nested(self):
        original_count = len(self.pending)
        try:
            yield
        except Exception:
            del self.pending[original_count:]
            raise
        else:
            self.saved_outputs.extend(
                row for row in self.pending[original_count:] if isinstance(row, GeneratedOutput)
            )


def test_generation_keeps_successful_outputs_when_another_output_fails(monkeypatch):
    async def run():
        transformation = SimpleNamespace(
            id='tx-1',
            user_id='user-1',
            title='Source update',
            summary='A short source summary.',
            configuration={},
            status='draft',
        )
        chunk = SimpleNamespace(id='chunk-1', chunk_index=0, content='Source evidence.')
        db = FakeSession(transformation, [chunk])

        async def generate_output(output_type, *_args):
            if output_type == 'report':
                raise OllamaGenerationError('Output stopped at the token limit.')
            return {'title': 'Generated advisory', 'content': 'Source-grounded draft.'}

        monkeypatch.setattr(generation, 'generate_grounded_output', generate_output)
        response = await generation.generate(
            'tx-1',
            GenerateRequest(output_types=['advisory', 'report'], languages=['en']),
            SimpleNamespace(id='user-1'),
            db,
        )

        assert response['status'] == 'partial_in_review'
        assert [output['output_type'] for output in response['outputs']] == ['advisory']
        assert response['outputs'][0]['content'] == 'Source-grounded draft.'
        assert response['failed_outputs'] == [{
            'output_type': 'report',
            'language': 'en',
            'error': 'Output stopped at the token limit.',
        }]
        assert transformation.status == 'partial_in_review'
        assert [output.output_type for output in db.saved_outputs] == ['advisory']
        assert db.commit_count == 2

    asyncio.run(run())
