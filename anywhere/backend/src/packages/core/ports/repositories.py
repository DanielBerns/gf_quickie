from abc import ABC, abstractmethod
from typing import List, Optional
from core.domain.models import User, Submission, Tag

class UserRepository(ABC):
    @abstractmethod
    def save(self, user: User) -> None:
        pass

    @abstractmethod
    def get_by_id(self, user_id: str) -> User | None:
        pass

    @abstractmethod
    def get_by_email(self, email: str) -> User | None:
        pass

    @abstractmethod
    def deactivate(self, user_id: str) -> None:
        """Soft deletes the user."""
        pass

class TagRepository(ABC):
    @abstractmethod
    def get_active_tags(self) -> List[Tag]:
        pass

class SubmissionRepository(ABC):
    @abstractmethod
    def save(self, submission: Submission) -> None:
        pass

    @abstractmethod
    def get_recent(self, limit: int = 50) -> List[Submission]:
        pass
