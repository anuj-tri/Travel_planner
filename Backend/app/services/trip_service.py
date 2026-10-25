import json

from datetime import timedelta, datetime
from zoneinfo import ZoneInfo

from app.services.google_places import (get_or_create_place, save_itinerary_place, get_place_coordinates,)

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models import (
    Trip,
    TripPreference,
    Preference,
    Users,
    Itinerary,
    ItineraryPlace,
    Place,
)
from app.Schema.trip import (
    TripCreateRequest,
    SaveItineraryRequest,
    UpdateTripDateRequest,
    PreviewModifiedTripRequest,
)

# it will help trip.py to send the actual trip details from dtatabse to gemini.py .
# then geminin.py to gemnini and return the generated itinerary
from app.services.gemini import generate_itinerary as generate_gemini_itinerary


def update_trip_status(trip):

    if trip.status == "completed":
        return

    today = datetime.now(ZoneInfo("Asia/Kolkata")).date()

    if trip.start_date > today:
        trip.status = "upcoming"

    elif trip.end_date >= today:
        trip.status = "ongoing"

    else:
        trip.status = "missed"


# CREATE TRIP
def create_trip_service(
    request: TripCreateRequest,
    db: Session,
    current_user: Users,
):

    # checking all the selected preferences exist
    preferences = (
        db.query(Preference)
        .filter(Preference.preference_id.in_(request.preference_ids))
        .all()
    )

    if len(preferences) != len(set(request.preference_ids)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="One or more preference IDs are invalid",
        )

    # creating new trip
    new_trip = Trip(
        user_id=current_user.user_id,
        starting_destination=request.starting_destination,
        ending_destination=request.ending_destination,
        start_date=request.start_date,
        end_date=request.end_date,
        no_of_travellers=request.no_of_travellers,
        budget=request.budget,
    )

    db.add(new_trip)
    db.flush()

    # creating TripPreference records
    for preference_id in set(request.preference_ids):
        trip_preference = TripPreference(
            trip_id=new_trip.trip_id, preference_id=preference_id
        )

        db.add(trip_preference)

    db.commit()
    db.refresh(new_trip)

    return {
        "trip_id": new_trip.trip_id,
        "user_id": new_trip.user_id,
        "starting_destination": new_trip.starting_destination,
        "ending_destination": new_trip.ending_destination,
        "start_date": new_trip.start_date,
        "end_date": new_trip.end_date,
        "no_of_travellers": new_trip.no_of_travellers,
        "budget": new_trip.budget,
        "status": new_trip.status,
        "preference_ids": list(set(request.preference_ids)),
    }


# GENERATE ITINERARY
def generate_itinerary_service(
    trip_id: int,
    db: Session,
    current_user: Users,
):

    trip = (
        db.query(Trip)
        .filter(Trip.trip_id == trip_id, Trip.user_id == current_user.user_id)
        .first()
    )

    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Trip not found"
        )

    trip_preferences = (
        db.query(TripPreference).filter(TripPreference.trip_id == trip_id).all()
    )

    preferences = (
        db.query(Preference)
        .filter(
            Preference.preference_id.in_([tp.preference_id for tp in trip_preferences])
        )
        .all()
    )

    itinerary = generate_gemini_itinerary(
        starting_destination=trip.starting_destination,
        ending_destination=trip.ending_destination,
        start_date=trip.start_date,
        end_date=trip.end_date,
        no_of_travellers=trip.no_of_travellers,
        budget=trip.budget,
        preferences=[preference.preference_type for preference in preferences],
    )

    return {"trip_id": trip.trip_id, "itinerary": itinerary}


# SAVE ITINERARY
def save_itinerary_service(
    trip_id: int,
    request: SaveItineraryRequest,
    db: Session,
    current_user: Users,
):

    trip = (
        db.query(Trip)
        .filter(
            Trip.trip_id == trip_id,
            Trip.user_id == current_user.user_id
        )
        .first()
    )

    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trip not found",
        )

    if not request.itineraries:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail = 'At least one itinerary day is required',
        )
    try:
        new_itineraries = []

        for itinerary_day in request.itineraries:
            new_itinerary = Itinerary(
                trip_id = trip_id,
                day_number = itinerary_day.day_number,
                itinerary_data = json.dumps(
                    itinerary_day.itinerary_data
                ),
            )

            db.add(new_itinerary)
            db.flush()
            new_itineraries.append(new_itinerary)

        for itinerary in new_itineraries:
            print('Day:', itinerary.day_number)

            data = json.loads(itinerary.itinerary_data)
            places = data.get("places", [])

            for visit_order, place in enumerate(places, start =1):
                place_name = place.get("place_name")

                if (
                    not isinstance(place_name,str)
                    or not place_name.strip()
                ):
                    raise HTTPException(
                        status_code = status.HTTP_400_BAD_REQUEST,
                        detail = 'Every place must have a valid place_name',
                    )
                place_name = place_name.strip()
                print(place_name)

                saved_place = get_or_create_place(
                    place_name = place_name,
                    db=db,
                    city = place.get('city'),
                    state = place.get('state'),
                    country = place.get('country'),
                    commit = False,
                )
                print(
                    "saved places:",
                    saved_place.place_name,
                    saved_place.place_latitude,
                    saved_place.place_longitude,
                )

                save_itinerary_place(
                    itinerary_id = itinerary.itinerary_id,
                    place_id = saved_place.place_id,
                    visit_order= visit_order,
                    db=db,
                    commit = False,
                )

        #commit all itinerary, place, and relationship records together.
        db.commit()

        for itinerary in new_itineraries:
            db.refresh(itinerary)

        last_itinerary = new_itineraries[-1]

        return {
            "message": "Itinerary saved successfully",
            "itinerary_id": last_itinerary.itinerary_id,
            "trip_id": last_itinerary.trip_id,
            "day_number": last_itinerary.day_number,
            "itinerary_data": last_itinerary.itinerary_data,
        }
    except Exception:
        db.rollback()
        raise


# VIEW SAVED ITINERARY
def view_saved_itinerary_service(
    trip_id: int,
    db: Session,
    current_user: Users,
):

    trip = (
        db.query(Trip)
        .filter(
            Trip.trip_id == trip_id,
            Trip.user_id == current_user.user_id,
        )
        .first()
    )

    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="trip not found",
        )

    # this gets all saved days for that trip.
    itineraries = (
        db.query(Itinerary)
        .filter(Itinerary.trip_id == trip_id)
        .order_by(
            Itinerary.day_number
        )  # order by day_Number so day 1 comes first then day 2 , day 3....
        .all()
    )

    if not itineraries:
        return []

    # Get all itineraries IDs
    itinerary_ids = [itinerary.itinerary_id for itinerary in itineraries]

    # get places connected to these itineraries
    itinerary_places = (
        db.query(ItineraryPlace, Place)
        .join(Place, ItineraryPlace.place_id == Place.place_id)
        .filter(ItineraryPlace.itinerary_id.in_(itinerary_ids))
        .order_by(ItineraryPlace.itinerary_id, ItineraryPlace.visit_order)
        .all()
    )

    # store coordinates using itineratry_id and visit_order

    place_coordinates = {}

    for itinerary_place, place in itinerary_places:

        place_coordinates[
            (itinerary_place.itinerary_id, itinerary_place.visit_order)
        ] = {
            "latitude": place.place_latitude,
            "longitude": place.place_longitude,
        }
    response = []

    for itinerary in itineraries:
        itinerary_data = json.loads(itinerary.itinerary_data)

        places = itinerary_data.get("places", [])

        # Add coordinates to every place
        for index, place_data in enumerate(places):

            visit_order = index + 1

            coordinates = place_coordinates.get((itinerary.itinerary_id, visit_order))

            if coordinates:

                place_data["latitude"] = coordinates["latitude"]

                place_data["longitude"] = coordinates["longitude"]

        response.append(
            {
                "day_number": itinerary.day_number,
                "itinerary_data": itinerary_data,
            }
        )

    return response


# route for trip update (date will update here rest the things will be same)
def update_trip_date_service(
    trip_id: int,
    request: UpdateTripDateRequest,
    db: Session,
    current_user: Users,
):

    trip = (
        db.query(Trip)
        .filter(
            Trip.trip_id == trip_id,
            Trip.user_id == current_user.user_id,
        )
        .first()
    )

    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="trip not found",
        )

    if trip.status == "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Completd trip can not be postponed",
        )

    old_duration = (trip.end_date - trip.start_date).days

    new_end_date = request.new_start_date + timedelta(days=old_duration)

    trip.start_date = request.new_start_date
    trip.end_date = new_end_date

    db.commit()
    db.refresh(trip)

    return {
        "message": "trip dates updated successfully",
        "trip_id": trip.trip_id,
        "start_date": trip.start_date,
        "end_date": trip.end_date,
    }


# to delete the trip


def delete_trip(trip_id: int, user_id: int, db: Session):
    trip = (
        db.query(Trip).filter(Trip.trip_id == trip_id, Trip.user_id == user_id).first()
    )

    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Trip not found"
        )

    itineraries = db.query(Itinerary).filter(Itinerary.trip_id == trip_id).all()

    if itineraries:
        itinerary_ids = [itinerary.itinerary_id for itinerary in itineraries]

        db.query(ItineraryPlace).filter(
            ItineraryPlace.itinerary_id.in_(itinerary_ids)
        ).delete(synchronize_session=False)

        db.query(Itinerary).filter(Itinerary.itinerary_id.in_(itinerary_ids)).delete(
            synchronize_session=False
        )

    db.query(TripPreference).filter(TripPreference.trip_id == trip_id).delete(
        synchronize_session=False
    )

    db.delete(trip)

    db.commit()

    return {"trip_id": trip_id, "message": "Trip deleted successfully"}


# GET SAVED TRIPS


def get_saved_trips_service(
    db: Session,
    current_user: Users,
):
    trips = (
        db.query(Trip)
        .join(Itinerary, Itinerary.trip_id == Trip.trip_id)
        .filter(Trip.user_id == current_user.user_id)
        .distinct()
        .all()
    )

    for trip in trips:
        update_trip_status(trip)

    db.commit()

    saved_trips = []
    for trip in trips:
        db.refresh(trip)

        saved_trips.append(
            {
                "trip_id": trip.trip_id,
                "starting_destination": trip.starting_destination,
                "ending_destination": trip.ending_destination,
                "start_date": trip.start_date,
                "end_date": trip.end_date,
                "no_of_travellers": trip.no_of_travellers,
                "budget": trip.budget,
                "status": trip.status,
            }
        )

    return saved_trips


def mark_trip_completed_service(
    trip_id: int,
    db: Session,
    current_user: Users,
):
    trip = (
        db.query(Trip)
        .filter(
            Trip.trip_id == trip_id,
            Trip.user_id == current_user.user_id,
        )
        .first()
    )

    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detaisl="Trip not found.",
        )

    today = datetime.now(ZoneInfo("Asia/Kolkata")).date()

    if today <= trip.end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Trip only can be marked as completed after the end date.",
        )

    if trip.status == "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Trip is already completed.",
        )

    trip.status = "completed"

    db.commit()
    db.refresh(trip)

    return {
        "trip_id": trip.trip_id,
        "status": trip.status,
        "message": "trip marked as completed successfully",
    }

# getting existinig details (pre filled in db for editing)
def get_trip_edit_details_service(
        trip_id: int,
        db: Session,
        current_user: Users,
):
    trip = (
        db.query(Trip)
        .filter(
            Trip.trip_id == trip_id,
            Trip.user_id == current_user.user_id,

        )
        .first()
    )

    if not trip:
        raise HTTPException(
            status_code= status.HTTP_404_NOT_FOUND,
            detail = 'Trip not found',
        )

    #only upcoming and missed can be modified here.
    if trip.status not in ("upcoming", "missed"):
        raise HTTPException(
            status_code = status.HTTP_400_BAD_REQUEST,
            detail= "only upcoming or missed trips can be modified",
        )

    # get the preference associated with this trip
    trip_preferences = (
        db.query(TripPreference)
        .filter(TripPreference.trip_id == trip_id)
        .all()
    )

    preference_ids = [
        trip_preference.preference_id
        for trip_preference in trip_preferences
    ]

    return {
        "trip_id": trip.trip_id,
        "starting_destination": trip.starting_destination,
        "ending_destination": trip.ending_destination,
        "start_date": trip.start_date,
        "end_date": trip.end_date,
        "no_of_travellers": trip.no_of_travellers,
        'budget': trip.budget,
        "status": trip.status,
        "preference_ids": preference_ids,
    }

#preview modified itineraey - no datatbase changes
def preview_modified_itinerary_service(
        trip_id: int,
        request: PreviewModifiedTripRequest,
        db: Session,
        current_user: Users,
):
    #1.checking that the trip exists and belongs to the logged-in user
    trip = (
        db.query(Trip)
        .filter(
            Trip.trip_id == trip_id,
            Trip.user_id == current_user.user_id,
        )
        .first()
    )
    if not trip:
        raise HTTPException(
            status_code= status.HTTP_404_NOT_FOUND,
            detail = 'Trip not found',
        )

    if trip.status not in ("upcoming", "missed"):
        raise HTTPException(
            status_code= status.HTTP_400_BAD_REQUEST,
            detail = 'Only upcoming or missed trips can be modified',
        )

    if request.end_date< request.start_date:
        raise HTTPException(
            status_code= status.HTTP_400_BAD_REQUEST,
            detail= "End date cannot be before start date",
        )

    preference_ids = set(request.preference_ids)

    preferences = (
        db.query(Preference)
        .filter(Preference.preference_id.in_(preference_ids))
        .all()
    )

    if len(preferences) != len(preference_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail = "One or more prefrence IDs are invalid",
        )

    itinerary = generate_gemini_itinerary(
        starting_destination= request.starting_destination,
        ending_destination=request.ending_destination,
        start_date=request.start_date,
        end_date = request.end_date,
        no_of_travellers= request.no_of_travellers,
        budget = request.budget,
        preferences=[
            preference.preference_type
            for preference in preferences
        ],
    )
    return {
        "trip_id": trip.trip_id,
        "itinerary": itinerary
    }

def save_modified_trip_service(
        trip_id: int,
        request,
        db: Session,
        current_user: Users,
):
    trip = (
        db.query(Trip)
        .filter(
            Trip.trip_id == trip_id,
            Trip.user_id == current_user.user_id,
        )
        .first()
    )

    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail = 'Trip not found',
        )

    if trip.status not in ("upcoming", "missed"):
        raise HTTPException(
            status_code = status.HTTP_400_BAD_REQUEST,
            detail ="only upcoming or missed trips can be modified",
        )

    if request.end_date < request.start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail = "End date can not be before the start date"
        )
    if not request.itineraries:
        raise HTTPException(
            status_code = status.HTTP_400_BAD_REQUEST,
            detail = 'At least one itinerary day is required',
        )
    day_number = [
        day.day_number for day in request.itineraries
    ]

    if len(day_number) != len(set(day_number)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Duplicate itinerary day number are not allowed",
        )

    if sorted (day_number) != list(range(1, len(day_number) +1)):
        raise HTTPException(
            status_code = status.HTTP_400_BAD_REQUEST,
            detail = "Itinerary days must be numbered consecutively from 1",
        )

    preference_ids = set(request.preference_ids)

    preferences = (
        db.query(Preference)
        .filter(Preference.preference_id.in_(preference_ids))
        .all()
        if preference_ids
        else[]
    )

    if len(preferences) != len(preference_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail= "one or more prefrences IDs are invalid",
        )

    try:
        trip.starting_destination = request.starting_destination
        trip.ending_destination = request.ending_destination
        trip.start_date = request.start_date
        trip.end_date = request.end_date
        trip.no_of_travellers = request.no_of_travellers
        trip.budget = request.budget

        update_trip_status(trip)

        db.query(TripPreference).filter(
            TripPreference.trip_id == trip_id
        ).delete(synchronize_session=False)

        for preference_id in preference_ids:
            db.add(
                TripPreference(
                    trip_id= trip_id,
                    preference_id = preference_id,
                )
            )
        old_itineraries = (
            db.query(Itinerary)
            .filter(Itinerary.trip_id == trip_id)
            .all()
        )

        old_itinerary_ids =[
            itinerary.itinerary_id
            for itinerary in old_itineraries
        ]

        if old_itinerary_ids:
            db.query(ItineraryPlace).filter(
                ItineraryPlace.itinerary_id.in_(old_itinerary_ids)
            ).delete(synchronize_session=False)

            db.query(Itinerary).filter(
                Itinerary.itinerary_id.in_(old_itinerary_ids)
            ).delete(synchronize_session=False)

        #save the newly selected itinerary for each day.
        for itinerary_day in request.itineraries:
            selected_data = itinerary_day.itinerary_data

            if not isinstance(selected_data, dict):
                raise HTTPException(
                    status_code = status.HTTP_400_BAD_REQUEST,
                    detail ="Each itinerary slesction must be an objevct",
                )

            places = selected_data.get('places',[])

            if not isinstance(places, list):
                raise HTTPException(
                        status_code = status.HTTP_400_BAD_REQUEST,
                        detail ="The place field must be a list",
                )
            print(
                f"Saving day {itinerary_day.day_number}:"
                f"{len(places)} places found"
            )

            new_itinerary = Itinerary(
                trip_id = trip_id,
                day_number = itinerary_day.day_number,
                itinerary_data = json.dumps(selected_data),
            )

            db.add(new_itinerary)
            db.flush()

            #save the places for this itinerary day.
            for visit_order, place_data in enumerate(places, start=1):

                if not isinstance(place_data, dict):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail ='Every place must be a object',
                    )
                place_name = place_data.get("place_name")

                if (
                    not isinstance(place_name, str)
                    or not place_name.strip()
                ):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail ="every place must have a valid place_name",
                    )
                place_name = place_name.strip()

                #get attraction actual location from gemini.
                city = place_data.get("city")
                state = place_data.get("state")
                country = place_data.get("country")

                #validate location details before calling google.
                if not all (
                    isinstance (value, str) and value.strip()
                    for value in (city, state, country)
                ):
                    raise HTTPException(
                        status_code =status.HTTP_400_BAD_REQUEST,
                        detail = (
                            f"City, State, and country are required"
                            f" for the place: {place_name}"
                        ),
                    )
                city = city.strip()
                state = state.strip()
                country = country.strip()
                try:
                    coordinates = get_place_coordinates(
                        place_name =place_name,
                        city=city.strip(),
                        state= state.strip(),
                        country = country.strip(),
                        )
                except Exception as exc:
                    raise HTTPException(
                        status_code=status.HTTP_502_BAD_GATEWAY,
                        detail= (
                            f"Could not retrieve coordinates"
                            f"for {place_name}"
                        ),
                    )from exc

                latitude = coordinates.get("latitude")
                longitude = coordinates.get("longitude")


                if (
                    latitude is None
                    or longitude is None
                    or (latitude == 0 and longitude == 0)
                ):
                    raise HTTPException(
                        status_code = status.HTTP_502_BAD_GATEWAY,
                        detail = (
                            f"Could not verify the location"
                            f"of {place_name} in {city}, {state}, {country}"
                        ),
                    )

                print(
                     "Verified place:",
                    place_name,
                    city,
                    state,
                    country,
                    latitude,
                    longitude,
                )

                # reuse the place swhich are vailable in
                # table only when its coordinates match.
                tolerance = 0.000001

                saved_place = (
                    db.query(Place)
                    .filter(
                        Place.place_latitude.between(
                            latitude - tolerance,
                            latitude + tolerance,
                        ),
                        Place .place_longitude.between(
                            longitude - tolerance,
                            longitude + tolerance,
                        ),
                    )
                    .first()
                )

                #if not create a new place then
                if not saved_place:
                    saved_place = Place(
                        place_name = place_name,
                        place_latitude = latitude,
                        place_longitude = longitude,
                    )

                    db.add(saved_place)
                    db.flush()

                db.add(
                    ItineraryPlace(
                        itinerary_id = new_itinerary.itinerary_id,
                        place_id = saved_place.place_id,
                        visit_order = visit_order,
                    )
                )
        db.commit()
        db.refresh(trip)

        return {
            "message": "Trip and itinerary updated successfully",
            "trip_id": trip.trip_id,
            "starting_destination": trip.starting_destination,
            "ending_destination": trip.ending_destination,
            "start_date": trip.start_date,
            "end_date": trip.end_date,
            "no_of_travellers": trip.no_of_travellers,
            "budget": trip.budget,
            "status": trip.status,
            "preference_ids": sorted(preference_ids),
            "itinerary_days_saved": len(request.itineraries),
        }

    except Exception:
        db.rollback()
        raise
