from pydantic import BaseModel, Field

class TransformationCreate(BaseModel):
    title: str = Field(default='New Transformation', max_length=500)
    summary: str = ''
    configuration: dict = Field(default_factory=dict)

class TransformationUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=500)
    summary: str | None = None
    configuration: dict | None = None
    status: str | None = Field(default=None, max_length=50)

class TransformationResponse(BaseModel):
    id: str
    title: str
    summary: str | None
    status: str
    configuration: dict
    created_at: str

class UploadResponse(BaseModel):
    file_id: str
    transformation_id: str
    filename: str
    content_type: str
    object_key: str
    title: str
    summary: str
    text_length: int
