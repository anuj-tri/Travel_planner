import os  # os is a py library which let us intract with thigs related to os like we are reading the gemeni key from env .
import requests  # request is py lib used to make http request.
from dotenv import (
    load_dotenv,
)  # it also allows py to read variable from your .env file.

load_dotenv()  # it looks for file .env and and load tenh variable inside it.

from app.models import Place, ItineraryPlace
from app.database import get_db

GOOGLE_MAPS_API_KEY = os.getenv(
    "GOOGLE_MAPS_API_KEY"
)  # it request python to give me the value stored under GOOGLE_MAPS_API_KEY

url = "https://places.googleapis.com/v1/places:searchText"

# https://→ Protocol used to securely communicate with Google's server
# places.googleapis.com → Google's server/domain for the Places API
# /v1/ → Version 1 of the API
# /places → Specifies that we are working with the Places API
#:searchText→ Tells the API to perform a text-based place search


headers = {
    "Content-Type": "application/json",  # The data I'm sending in the request body is JSON.
    "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,  # This is where we give Google our API key.
    "X-Goog-FieldMask": "places.displayName,places.location",  # this the header name Google expects.
}


def get_or_create_place(place_name: str, db):
    place = find_place_in_db(place_name, db)

    if place:
        return place
    place_data = get_place_coordinates(place_name)

    if place_data["latitude"] is not None and place_data["longitude"] is not None:
        place = find_place_by_coordinates(
            place_data["latitude"], place_data["longitude"], db
        )

        if place:
            return place

    place = save_place_to_db(place_data, db)

    return place


def find_place_in_db(place_name: str, db):
    place = db.query(Place).filter(Place.place_name == place_name).first()
    return place


def find_place_by_coordinates(latitude, longitude, db):
    tolerance = 0.000001

    place = (
        db.query(Place).filter(
            Place.place_latitude.between(latitude - tolerance, latitude + tolerance),
            Place.place_longitude.between(longitude - tolerance, longitude + tolerance),
        )
    ).first()

    return place


def get_place_coordinates(place_name: str):
    data = {"textQuery": place_name}

    response = requests.post(url, headers=headers, json=data)
    result = response.json()

    for place in result["places"]:

        google_place_name = place["displayName"][
            "text"
        ]  # Original name returned by Google

        print("Google result", google_place_name)

        latitude = place["location"]["latitude"]
        longitude = place["location"]["longitude"]

        print("latitude:", latitude)
        print("longitude:", longitude)

        return {
            "place_name": google_place_name,
            "latitude": latitude,
            "longitude": longitude,
        }
    print(f"Location Not found: {place_name}")

    return {
        "place_name": place_name,
        "latitude": None,
        "longitude": None,
    }


def save_place_to_db(place_data, db):
    place = Place(
        place_name=place_data["place_name"],
        place_latitude=place_data["latitude"],
        place_longitude=place_data["longitude"],
    )
    db.add(place)
    db.commit()
    db.refresh(place)

    return place


def save_itinerary_place(itinerary_id, place_id, visit_order, db):
    itinerary_place = ItineraryPlace(
        itinerary_id=itinerary_id,
        place_id=place_id,
        visit_order=visit_order,
    )

    db.add(itinerary_place)
    db.commit()
    db.refresh(itinerary_place)

    return itinerary_place
