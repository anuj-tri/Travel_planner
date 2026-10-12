import os
import requests
from dotenv import load_dotenv

load_dotenv()

GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")

url = "https://places.googleapis.com/v1/places:searchText"

headers = {
    "Content-Type": "application/json",
    "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
    "X-Goog-FieldMask": "places.displayName,places.location",
}

places = [
    "Abbey Falls",
    "Raja's Seat",
    "Dubare Elephant Camp",
    "Kaveri Nisargadhama",
    "Mullayanagiri Peak",
    "Bababudangiri Hills",
    "Bhadra Wildlife Sanctuary",
    "Hebbe Falls",
]

for place_name in places:

    data = {"textQuery": place_name}

    response = requests.post(url, headers=headers, json=data)

    result = response.json()

    print("\n====================================")
    print("Searching:", place_name)

    if "places" in result and result["places"]:

        first_place = result["places"][0]

        google_name = first_place["displayName"]["text"]
        latitude = first_place["location"]["latitude"]
        longitude = first_place["location"]["longitude"]

        print("Google result:", google_name)
        print("Latitude:", latitude)
        print("Longitude:", longitude)

    else:
        print("Google returned NO results ❌")
