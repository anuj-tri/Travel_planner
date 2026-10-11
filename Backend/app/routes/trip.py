from fastapi import APIRouter, status, Depends
from sqlalchemy.orm import Session

from app.database import get_db

from app.models import Users

from app.Schema.trip import (
    TripCreateRequest,
    TripCreateResponse,
    SaveItineraryRequest,
    SavedItinerary,
    UpdateTripDateRequest,
    DeleteTripResponse,
)

# for having the curent user who login
from app.security import get_current_user

from app.services.trip_service import (
    create_trip_service,
    generate_itinerary_service,
    save_itinerary_service,
    view_saved_itinerary_service,
    update_trip_date_service,
    delete_trip,
    get_saved_trips_service,
    mark_trip_completed_service,
)

router = APIRouter(prefix="/trips", tags=["Trips"])


@router.post("", response_model=TripCreateResponse, status_code=status.HTTP_201_CREATED)
def create_trip(
    request: TripCreateRequest,
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):

    return create_trip_service(
        request,
        db,
        current_user,
    )


@router.post("/{trip_id}/generate-itinerary")
def generate_itinerary(
    trip_id: int,
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):

    return generate_itinerary_service(
        trip_id,
        db,
        current_user,
    )


@router.post("/{trip_id}/save-itinerary")
def save_itinerary(
    trip_id: int,
    request: SaveItineraryRequest,
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):

    return save_itinerary_service(
        trip_id,
        request,
        db,
        current_user,
    )


@router.get(
    "/{trip_id}/View-saved-itinerary",
    response_model=list[SavedItinerary],
)
def view_saved_itinerary(
    trip_id: int,
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):

    return view_saved_itinerary_service(
        trip_id,
        db,
        current_user,
    )


# route for tripupdate (date will update here rest the things will be same)
@router.patch("/{trip_id}/update-date")
def update_trip_date(
    trip_id: int,
    request: UpdateTripDateRequest,
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):

    return update_trip_date_service(
        trip_id,
        request,
        db,
        current_user,
    )


@router.delete("/{trip_id}", response_model=DeleteTripResponse)
def delete_trip_response(
    trip_id: int,
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):

    return delete_trip(trip_id=trip_id, user_id=current_user.user_id, db=db)


# route for making tripas completd.


@router.patch("/{trip_id}/complete")
def mark_trip_completed(
    trip_id: int,
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):

    return mark_trip_completed_service(
        trip_id,
        db,
        current_user,
    )


@router.get("")
def get_saved_trips(
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    return get_saved_trips_service(
        db,
        current_user,
    )
