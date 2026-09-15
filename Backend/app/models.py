from app.database import Base
from sqlalchemy import String, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column


class Users(Base):
    __tablename__ = "users"

    user_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    first_name: Mapped[str] = mapped_column(String(30), nullable=False)
    last_name: Mapped[str] = mapped_column(String(30), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)


class Trip(Base):
    __tablename__ = "trips"

    trip_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.user_id"))
    starting_destination: Mapped[str] = mapped_column(String(100))
    ending_destination: Mapped[str] = mapped_column(String(100))
    start_date: Mapped[str] = mapped_column(String(20))
    end_date: Mapped[str] = mapped_column(String(20))
    no_of_travellers: Mapped[int] = mapped_column(Integer)
    budget: Mapped[float] = mapped_column()
    status: Mapped[str] = mapped_column(String(20), default="incoming")


class Preference(Base):
    __tablename__ = "preferences"

    preference_id: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True
    )
    preference_type: Mapped[str] = mapped_column(String(50))


class TripPreference(Base):
    __tablename__ = "trip_preferences"

    trip_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("trips.trip_id"), primary_key=True
    )

    preference_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("preferences.preference_id"), primary_key=True
    )


class Itinerary(Base):
    __tablename__ = "itineraries"

    itinerary_id: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True
    )
    trip_id: Mapped[int] = mapped_column(Integer, ForeignKey("trips.trip_id"))
    day_number: Mapped[int] = mapped_column(Integer)
    itinerary_data: Mapped[str] = mapped_column(String(500))


class Place(Base):
    __tablename__ = "places"

    place_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    place_name: Mapped[str] = mapped_column(String(100))
    place_longitude: Mapped[float] = mapped_column()
    place_latitude: Mapped[float] = mapped_column()


class ItineraryPlace(Base):
    __tablename__ = "itinerary_places"

    itinerary_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("itineraries.itinerary_id"), primary_key=True
    )
    place_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("places.place_id"), primary_key=True
    )
    visit_order: Mapped[int] = mapped_column(Integer)
