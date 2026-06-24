import structlog
from sqlalchemy.orm import Session
from core.domain.models import User, Submission, Tag, SubmissionItem
from core.ports.repositories import UserRepository, SubmissionRepository
from infra.database.schema import UserModel, SubmissionModel, SubmissionItemModel

logger = structlog.get_logger()

class SqlAlchemyUserRepository(UserRepository):
    def __init__(self, session: Session):
        self.session = session

    def save(self, user: User) -> None:
        model = UserModel(
            id=user.id,
            google_id=user.google_id,
            email=user.email,
            name=user.name,
            is_active=user.is_active,
            created_at=user.created_at,
            updated_at=user.updated_at
        )
        self.session.merge(model)
        self.session.commit()
        logger.info("user_saved", user_id=user.id)

    def get_by_id(self, user_id: str) -> User | None:
        model = self.session.query(UserModel).filter_by(id=user_id).first()
        if not model:
            return None
        return User(
            id=model.id,
            google_id=model.google_id,
            email=model.email,
            name=model.name,
            is_active=model.is_active,
            created_at=model.created_at,
            updated_at=model.updated_at
        )

    def get_by_email(self, email: str) -> User | None:
        """New method: Required for the authentication login flow."""
        model = self.session.query(UserModel).filter_by(email=email).first()
        if not model:
            return None
        return User(
            id=model.id,
            google_id=model.google_id,
            email=model.email,
            name=model.name,
            is_active=model.is_active,
            created_at=model.created_at,
            updated_at=model.updated_at
        )

    def deactivate(self, user_id: str) -> None:
        """Soft delete implementation."""
        user = self.session.query(UserModel).filter_by(id=user_id).first()
        if user:
            user.is_active = False
            self.session.commit()
            logger.info("user_deactivated", user_id=user_id)


class SqlAlchemySubmissionRepository(SubmissionRepository):
    def __init__(self, session: Session):
        self.session = session

    def save(self, submission: Submission) -> None:
        sub_model = SubmissionModel(
            id=submission.id,
            user_id=submission.user_id,
            latitude=submission.latitude,
            longitude=submission.longitude,
            device_timestamp=submission.device_timestamp,
            server_timestamp=submission.server_timestamp
        )

        for item in submission.items:
            item_model = SubmissionItemModel(
                id=item.id,
                submission_id=item.submission_id,
                tag_id=item.tag_id,
                item_type=item.item_type,
                content_payload=item.content_payload
            )
            sub_model.items.append(item_model)

        self.session.merge(sub_model)
        self.session.commit()
        logger.info("submission_saved", submission_id=submission.id, item_count=len(submission.items))

    def get_recent(self, limit: int = 50) -> list[Submission]:
        # 1. Fetch the ORM models, including their nested items
        models = (
            self.session.query(SubmissionModel)
            .order_by(SubmissionModel.server_timestamp.desc())
            .limit(limit)
            .all()
        )

        # 2. Map ORM models back to pure Domain entities
        submissions = []
        for m in models:
            items = [
                SubmissionItem(
                    id=item.id,
                    submission_id=item.submission_id,
                    tag_id=item.tag_id,
                    item_type=item.item_type,
                    content_payload=item.content_payload
                ) for item in m.items
            ]

            submissions.append(Submission(
                id=m.id,
                user_id=str(m.user_id),
                latitude=m.latitude,
                longitude=m.longitude,
                device_timestamp=m.device_timestamp,
                server_timestamp=m.server_timestamp,
                status="pending",
                items=items
            ))

        return submissions

    def get_by_id(self, submission_id: str) -> Submission | None:
        m = self.session.query(SubmissionModel).filter_by(id=submission_id).first()
        if not m:
            return None

        items = [
            SubmissionItem(
                id=item.id,
                submission_id=item.submission_id,
                tag_id=item.tag_id,
                item_type=item.item_type,
                content_payload=item.content_payload
            ) for item in m.items
        ]

        return Submission(
            id=m.id,
            user_id=str(m.user_id),
            latitude=m.latitude,
            longitude=m.longitude,
            device_timestamp=m.device_timestamp,
            server_timestamp=m.server_timestamp,
            status="pending",
            items=items
        )

    def delete(self, submission_id: str) -> None:
        model = self.session.query(SubmissionModel).filter_by(id=submission_id).first()
        if model:
            self.session.delete(model)
            self.session.commit()
            logger.info("submission_deleted", submission_id=submission_id)
