from datetime import date
from pydantic import BaseModel, Field
from typing import Any


# trip Details
class TripCreateRequest(BaseModel):
    starting_destination: str = Field(min_length = 1)
    ending_destination: str = Field(min_length = 1)
    start_date: date
    end_date: date
    no_of_travellers: int = Field(gt=0)
    budget: float = Field(ge=2000)
    preference_ids: list[int]


class TripCreateResponse(BaseModel):
    trip_id: int
    user_id: int
    starting_destination: str
    ending_destination: str
    start_date: date
    end_date: date
    no_of_travellers: int
    budget: float
    status: str
    preference_ids: list[int]

#to save itineray
class ItineraryDay(BaseModel):                         #this work foir extracting 1 day data
    day_number: int
    itinerary_data: dict[str,Any]

class SaveItineraryRequest(BaseModel):                  # this conatisns all the days (list) which came from the frontend. conaysins all 3 days.
    itineraries: list[ItineraryDay]

#to VIEW saved itinerary
class SavedItinerary(BaseModel):                       # for one day an dfor n no of days
    day_number: int
    itinerary_data: dict[str, Any]



#update strip
class UpdateTripDateRequest(BaseModel):
    new_start_date: date


#to delete the trip
class DeleteTripResponse(BaseModel):
    trip_id: int
    message: str
