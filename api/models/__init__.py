"""Database tables and API schemas, defined together with SQLModel, one module per subject.

Import from here (`from api.models import Work`): that registers every table for Alembic.

Columns are snake_case. The API uses camelCase (see ApiModel) and readable public ids ("moby-dick"),
and integer ids stay internal. DATAMODEL.md explains the words work, expression and edition.
"""

from api.models.auth import EmailRequest, Message, PasswordReset, Token, TokenRequest, UserRegister
from api.models.authors import Author, AuthorName, AuthorRead
from api.models.base import ApiModel, created_at_field, text_list, updated_at_field
from api.models.expressions import Edition, EditionRead, Expression, ExpressionRead
from api.models.messages import OPENREAD, DirectMessage, MarkRead, MessageRead, MessageWrite
from api.models.reading import (
    FollowRead,
    FollowWrite,
    ImportedStatus,
    Reading,
    ReadingStatus,
    ReadingWrite,
    SkipReason,
    SkipWrite,
    StatusImport,
    TrackFollow,
    TrackFollowState,
    TrackSkip,
)
from api.models.reflections import Reflection, ReflectionRead, ReflectionStatus, ReflectionWrite
from api.models.suggestions import Suggestion, SuggestionDecision, SuggestionRead, SuggestionStatus, SuggestionWrite
from api.models.tracks import (
    OwnTrackRead,
    OwnTrackWrite,
    Source,
    StopRead,
    Track,
    TrackRead,
    TrackStop,
    TrackStopTranslation,
    TrackTranslation,
)
from api.models.users import MeRead, MeUpdate, ProfileFields, ReaderRead, Role, User
from api.models.works import (
    BookToMatch,
    Difficulty,
    OpenLibraryWork,
    Work,
    WorkAuthor,
    WorkMatches,
    WorkRead,
    WorkSource,
)

__all__ = [
    "OPENREAD",
    "ApiModel",
    "Author",
    "AuthorName",
    "AuthorRead",
    "BookToMatch",
    "Difficulty",
    "DirectMessage",
    "Edition",
    "EditionRead",
    "EmailRequest",
    "Expression",
    "ExpressionRead",
    "FollowRead",
    "FollowWrite",
    "ImportedStatus",
    "MarkRead",
    "MeRead",
    "MeUpdate",
    "Message",
    "MessageRead",
    "MessageWrite",
    "OpenLibraryWork",
    "OwnTrackRead",
    "OwnTrackWrite",
    "PasswordReset",
    "ProfileFields",
    "ReaderRead",
    "Reading",
    "ReadingStatus",
    "ReadingWrite",
    "Reflection",
    "ReflectionRead",
    "ReflectionStatus",
    "ReflectionWrite",
    "Role",
    "SkipReason",
    "SkipWrite",
    "Source",
    "StatusImport",
    "StopRead",
    "Suggestion",
    "SuggestionDecision",
    "SuggestionRead",
    "SuggestionStatus",
    "SuggestionWrite",
    "Token",
    "TokenRequest",
    "Track",
    "TrackFollow",
    "TrackFollowState",
    "TrackRead",
    "TrackSkip",
    "TrackStop",
    "TrackStopTranslation",
    "TrackTranslation",
    "User",
    "UserRegister",
    "Work",
    "WorkAuthor",
    "WorkMatches",
    "WorkRead",
    "WorkSource",
    "created_at_field",
    "text_list",
    "updated_at_field",
]
