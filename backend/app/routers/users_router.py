from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.schemas import UserOut
from app.auth import get_current_user, require_admin, create_audit_log

router = APIRouter(prefix="/api/users", tags=["Users"])

@router.get("", response_model=List[UserOut])
def list_users(db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    return db.query(User).order_by(User.id.asc()).all()

@router.put("/{user_id}/role")
def update_user_role(user_id: int, role: str, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    if role not in ["Admin", "Procurement Officer", "Viewer/Auditor"]:
        raise HTTPException(status_code=400, detail="Invalid role specified.")
    
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found.")

    old_role = target_user.role
    target_user.role = role
    db.commit()

    create_audit_log(
        db,
        actor_id=current_user.id,
        actor_email=current_user.email,
        action_type="USER_ROLE_MUTATION",
        entity_type="User",
        entity_id=str(target_user.id),
        details_json=f"Role changed from '{old_role}' to '{role}'"
    )
    return {"message": f"User role updated to '{role}'."}

@router.put("/{user_id}/status")
def toggle_user_status(user_id: int, is_active: bool, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found.")

    target_user.is_active = is_active
    db.commit()

    create_audit_log(
        db,
        actor_id=current_user.id,
        actor_email=current_user.email,
        action_type="USER_STATUS_TOGGLE",
        entity_type="User",
        entity_id=str(target_user.id),
        details_json=f"Active status changed to {is_active}"
    )
    return {"message": f"User active status set to {is_active}."}
