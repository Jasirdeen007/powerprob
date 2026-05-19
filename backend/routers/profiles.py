from fastapi import APIRouter

from services.profile_commands import list_profiles

router = APIRouter(tags=["profiles"])


@router.get("/profiles")
def get_profiles():
    return {"profiles": list_profiles()}
