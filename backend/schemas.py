"""
SENTRY-IR API Schemas
Pydantic models for request validation and response serialization.
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, field_validator


class EntityResponse(BaseModel):
    """Extracted security entities from alert text."""
    host: Optional[str] = Field(default=None, description="Target or compromised hostname")
    process: Optional[str] = Field(default=None, description="Malicious or involved process/binary")
    technique: Optional[str] = Field(default=None, description="MITRE ATT&CK technique ID (e.g. T1003.001)")
    severity: Optional[str] = Field(default=None, description="Alert severity level (critical, high, medium, low, informational)")


class SearchResult(BaseModel):
    """Individual ranked mitigation step result matching the query."""
    id: str = Field(..., description="Mitigation chunk identifier")
    step_title: str = Field(..., description="Actionable step title")
    title: str = Field(..., description="Actionable step title (compatible alias)")
    step_text: str = Field(..., description="Full mitigation step instruction")
    description: str = Field(..., description="Full mitigation step instruction (compatible alias)")
    phase: str = Field(..., description="Incident response phase (IMMEDIATE, INVESTIGATE, RECOVER)")
    document_id: str = Field(..., description="Source document identifier")
    doc_id: str = Field(..., description="Source document identifier (compatible alias)")
    doc_title: str = Field(..., description="Source document title")
    citation: str = Field(..., description="Specific runbook/advisory citation")
    techniques: List[str] = Field(default_factory=list, description="Associated MITRE technique IDs")
    score: float = Field(..., description="Relevance and confidence score (0.0 - 1.0)")


class SearchRequest(BaseModel):
    """Search request payload."""
    query: str = Field(..., min_length=1, description="Security alert or incident response query")
    top_k: Optional[int] = Field(default=5, ge=1, le=20, description="Maximum number of mitigation results to return")

    @field_validator("query")
    @classmethod
    def validate_non_empty_query(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Query must not be empty or whitespace only")
        return v.strip()


class SearchResponse(BaseModel):
    """Standardized search response format."""
    status: str = Field(..., description="Outcome status: 'success' or 'no_result'")
    query: str = Field(..., description="Original search query")
    entities: Optional[EntityResponse] = Field(default=None, description="Extracted security entities")
    total_matches: int = Field(default=0, description="Total number of chunks passing the relevance threshold")
    results: List[SearchResult] = Field(default_factory=list, description="Ranked mitigation chunk results")
    latency_ms: float = Field(default=0.0, description="Search retrieval latency in milliseconds")


class DocumentSummary(BaseModel):
    """Summary metadata for document list view."""
    id: str
    title: str
    type: str
    version: str
    updated: str
    published: str
    chunks: int
    status: str
    flagged: bool
    owner: str
    techniques: List[str] = Field(default_factory=list)
    summary: str


class DocumentListResponse(BaseModel):
    """Response containing list of all ingested documents."""
    documents: List[DocumentSummary]
    total: int


class DocumentDetail(BaseModel):
    """Complete document detail including raw content and steps."""
    id: str
    title: str
    type: str
    version: str
    updated: str
    published: str
    chunks: int
    status: str
    flagged: bool
    owner: str
    techniques: List[str] = Field(default_factory=list)
    summary: str
    content: str
    steps: List[Dict[str, Any]] = Field(default_factory=list)
