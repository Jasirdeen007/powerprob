from fastapi import APIRouter

from models.profile import DroneProfile

router = APIRouter(tags=["profiles"])


PROFILES = [
    DroneProfile(
        id="agri",
        name="AGRI",
        description="Agriculture drone discharge profile. Hardware command data pending.",
    ),
    DroneProfile(
        id="surveillance",
        name="SURVEILLANCE",
        description="Surveillance drone discharge profile. Hardware command data pending.",
    ),
    DroneProfile(
        id="fpv",
        name="FPV",
        description="FPV drone discharge profile. Hardware command data pending.",
    ),
]


@router.get("/profiles")
def get_profiles():
    return {"profiles": [profile.model_dump() for profile in PROFILES]}
