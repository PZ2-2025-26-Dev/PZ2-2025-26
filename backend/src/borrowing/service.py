from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy.orm import Session

from src.borrowing.models import BorrowRequest, BorrowStatus, Guest
from src.borrowing.schemas import BorrowRequestCreate, BorrowReturnCreate, GuestCreate
from src.equipment.models import Equipment


class BorrowingService:
    def __init__(self, session: Session):
        self.session = session

    def create_guest(self, data: GuestCreate, current_user_id: int) -> Guest:
        guest = Guest(**data.model_dump(), created_by_id=current_user_id)
        self.session.add(guest)
        self.session.commit()
        self.session.refresh(guest)
        return guest

    def request_borrow(self, data: BorrowRequestCreate, current_user) -> BorrowRequest:
        equipment = self.session.get(Equipment, data.equipment_id)
        if not equipment:
            raise HTTPException(status_code=404, detail="Equipment not found")

        borrow_req = BorrowRequest(
            equipment_id=data.equipment_id,
            expected_return_date=data.expected_return_date,
        )

        if data.guest_id:
            # Wypożyczenie dla gościa - tylko właściciel lub admin może to zrobić
            if current_user.id != equipment.owner_id and not getattr(current_user, "is_admin", False):
                raise HTTPException(status_code=403, detail="Only owner can assign to a guest")

            borrow_req.guest_id = data.guest_id
            borrow_req.status = BorrowStatus.APPROVED  # Automatyczna akceptacja
        else:
            # Zwykłe wypożyczenie przez zalogowanego użytkownika
            borrow_req.requester_id = current_user.id
            borrow_req.status = BorrowStatus.PENDING

        self.session.add(borrow_req)
        self.session.commit()
        self.session.refresh(borrow_req)
        return borrow_req

    def approve_borrow(self, request_id: int, current_user) -> BorrowRequest:
        borrow_req = self.session.get(BorrowRequest, request_id)
        if not borrow_req:
            raise HTTPException(status_code=404, detail="Borrow request not found")

        equipment = self.session.get(Equipment, borrow_req.equipment_id)

        # Weryfikacja uprawnień właściciela
        if current_user.id != equipment.owner_id and not getattr(current_user, "is_admin", False):
            raise HTTPException(status_code=403, detail="Only owner can approve")

        if borrow_req.status != BorrowStatus.PENDING:
            raise HTTPException(status_code=400, detail="Only PENDING requests can be approved")

        borrow_req.status = BorrowStatus.APPROVED
        self.session.commit()
        self.session.refresh(borrow_req)
        return borrow_req

    def return_equipment(self, request_id: int, return_data: BorrowReturnCreate, current_user) -> BorrowRequest:
        borrow_req = self.session.get(BorrowRequest, request_id)
        if not borrow_req:
            raise HTTPException(status_code=404, detail="Borrow request not found")

        equipment = self.session.get(Equipment, borrow_req.equipment_id)

        # Tylko właściciel (lub admin) może potwierdzić zwrot i ocenić stan
        if current_user.id != equipment.owner_id and not getattr(current_user, "is_admin", False):
            raise HTTPException(status_code=403, detail="Only owner can confirm return")

        if borrow_req.status != BorrowStatus.APPROVED:
            raise HTTPException(status_code=400, detail="Equipment is not currently borrowed")

        borrow_req.status = BorrowStatus.RETURNED
        borrow_req.actual_return_date = datetime.now(timezone.utc)
        borrow_req.condition_rating = return_data.condition_rating
        borrow_req.return_comment = return_data.return_comment

        self.session.commit()
        self.session.refresh(borrow_req)
        return borrow_req
