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
    "X-Goog-FieldMask": (
        "places.id,"
        "places.displayName,"
        "places.location,"
        "places.formattedAddress,"  # this the header name Google expects.
        "places.addressComponents"
    ),
}


def get_or_create_place(
    place_name: str,
    db,
    city: str = None,
    state: str = None,
    country: str = None,
    commit: bool = True,
):
    place = find_place_in_db(place_name, db)

    if place and place.place_latitude is not None and place.place_longitude is not None:
        return place

    place_data = get_place_coordinates(
        place_name = place_name,
        city = city,
        state = state,
        country = country,
    )

    latitude = place_data.get("latitude")
    longitude = place_data.get("longitude")

    # never resuse a same-named place if its location
    # could not be resolved

    if (
        latitude is None
        or longitude is None
        or (latitude == 0 and longitude ==0)
    ):
        raise ValueError(
            f"Could not verify coordinates for "
            f"{place_name}, {city}, {country}"
        )

    #reuse a record only if its coordinates match
    existing_place = find_place_by_coordinates(
        latitude,
        longitude,
        db,
    )

    if existing_place:
        return existing_place

    #same name in a different city? Save a seprate record.
    place_data["place_name"] = place_name

    return save_place_to_db(
        place_data,
        db,
        commit=commit,
    )

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


def get_place_coordinates(
    place_name: str,
    city: str = None,
    state: str = None,
    country: str = None,
):
    location_parts = [part for part in (city, state, country) if part]

    search_query = ", ".join([place_name, *location_parts])
    data = {"textQuery": search_query}

    try:
        response = requests.post(
            url,
            headers=headers,
            json=data,
            timeout=15
        )
        response.raise_for_status()
        result = response.json()

        print("SEARCH QUERY:", search_query)
        print("GOOGLE API RESPONSE:", result)

    except (requests.RequestException, ValueError) as exc:
        print(f"Google Places lookup failed for'{place_name}': {exc}")

        return {
            "place_name": place_name,
            "latitude": None,
            "longitude": None,
        }

    places = result.get("places", [])

    if not places:
        print(f"No Google Places match found for: {search_query}")

        if "error" in result:
            print("Google Places API Error:", result["error"])

        return {
            "place_name": place_name,
            "latitude": None,
            "longitude": None,
        }

    # inspect the returned result before accepting its coordinates.

    for place in places:
        google_place_name = place.get("displayName", {}).get("text", place_name)
        address = place.get("formattedAddress", "")
        location = place.get("location", {})

        latitude = location.get("latitude")
        longitude = location.get("longitude")

        print("Google candidates:", google_place_name)
        print("Google address:", address)

        if latitude is None or longitude is None:
            continue

        if latitude == 0 and longitude == 0:
            print("Rejected zero coordinates:", google_place_name)
            continue

        if country:
            address_components = place.get("addressComponents", [])

            country_component = next(
                (
                    component
                    for component in address_components
                    if "country" in component.get('types', [])
                ),
                None,
            )
            if country_component is None:
                print("Rejected reult: country could not be verified:",
                      address,
                )
                continue
            requested_country = country.strip().casefold()

            country_aliases = {
                "india": {"india", "in"},
                "united states":{
                    "united states",
                    "us",
                    "usa"
                },
                "united kingdom": {
                    "united kingdom",
                    "uk",
                    "gb",
                },
            }
            accepted_country_names = country_aliases.get(
                requested_country,
                {requested_country},
            )

            returned_country_names = {
                country_component.get("longText", "").strip().casefold(),
                country_component.get("shortText", "").strip().casefold(),
            }

            if not accepted_country_names.intersection(
                returned_country_names
            ):
                print(
                    "Rejected result outside requested country:",
                    address,
                )
                continue

        #rule 4 : Preserve your existing city behaviour/
        # amistmaatch produces a warning but does not reject
        # the result, just as in your original function.
        if city and city.casefold() not in address.casefold():
            print(
                "Rejected result outside requested city; "
                "checking state and country validation:",
                address,
            )


        print("Accepted Google result:", google_place_name)
        print("Latitude:", latitude)
        print("Longitude:", longitude)

        return {
            "place_name": google_place_name,
            "latitude": latitude,
            "longitude": longitude,
        }

    print(f"No verified location found for: {search_query}")
    return {
        "place_name": place_name,
        "latitude": None,
        "longitude": None,
    }


def save_place_to_db(place_data, db, commit: bool = True):
    place = Place(
        place_name=place_data["place_name"],
        place_latitude=place_data["latitude"],
        place_longitude=place_data["longitude"],
    )
    db.add(place)
    db.flush()

    if commit:
        db.commit()
        db.refresh(place)

    return place


def save_itinerary_place(
    itinerary_id,
    place_id,
    visit_order,
    db,
    commit: bool = True,
):
    itinerary_place = ItineraryPlace(
        itinerary_id=itinerary_id,
        place_id=place_id,
        visit_order=visit_order,
    )

    db.add(itinerary_place)

    db.flush()

    if commit:
        db.commit()
        db.refresh(itinerary_place)

    return itinerary_place
