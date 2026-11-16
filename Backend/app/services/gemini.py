import os
import json
import time
import logging

from dotenv import load_dotenv
from google import genai
from fastapi import HTTPException, status

load_dotenv()

logger = logging.getLogger(__name__)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    raise RuntimeError("GEMINI_API_KEY is not configured.")

client = genai.Client(api_key=GEMINI_API_KEY)


def validate_itinerary(itinerary: dict) -> None:

    if not isinstance(itinerary, dict):
        raise ValueError("Gemini response must be a JSON object.")

    # Validate trip summary
    summary = itinerary.get("trip_summary")

    if not isinstance(summary, dict):
        raise ValueError("Missing or invalid trip_summary.")

    required_summary_fields = [
        "starting_destination",
        "ending_destination",
        "start_date",
        "end_date",
        "number_of_travellers",
        "budget",
        "preferences",
    ]

    for field in required_summary_fields:
        if field not in summary:
            raise ValueError(f"Missing trip_summary field: {field}")

    # Validate days
    days = itinerary.get("days")

    if not isinstance(days, list) or not days:
        raise ValueError("Days must be a non-empty list.")

    day_numbers = set()

    for day in days:

        if not isinstance(day, dict):
            raise ValueError("Each day must be a JSON object.")

        # validate day number
        day_number = day.get("day_number")

        if type(day_number) is not int or day_number < 1:
            raise ValueError("Invalid day_number.")

        if day_number in day_numbers:
            raise ValueError(f"Duplicate day_number: {day_number}")

        day_numbers.add(day_number)

        # validate options
        options = day.get("options")

        if not isinstance(options, list) or len(options) != 3:
            raise ValueError(f"Day {day_number} must contain exactly 3 options.")

        option_numbers = set()

        for option in options:

            if not isinstance(option, dict):
                raise ValueError("Each option must be a JSON object.")

            option_number = option.get("option_number")

            if type(option_number) is not int or option_number not in (1, 2, 3):
                raise ValueError("Invalid option_number.")

            option_numbers.add(option_number)

            if (
                not isinstance(option.get("option_name"), str)
                or not option["option_name"].strip()
            ):
                raise ValueError("Invalid option_name.")

            # validate places
            places = option.get("places")

            if not isinstance(places, list) or not places:
                raise ValueError("Each option must contain places.")

            for place in places:

                if not isinstance(place, dict):
                    raise ValueError("Each place must be a JSON object.")

                required_place_fields = [
                    "place_name",
                    "city",
                    "state",
                    "country",
                    "activity",
                    "approximate_time",
                ]

                for field in required_place_fields:
                    value = place.get(field)

                    if not isinstance(value, str) or not value.strip():
                        raise ValueError(f"Invalid or missing place field: {field}")

                fee = place.get("entry_fee_per_person")

                if type(fee) not in (int, float) or fee < 0:
                    raise ValueError("Invalid entry_fee_per_person.")

            # Validate option duration
            value = option.get("estimated_duration")

            if not isinstance(value, str) or not value.strip():
                raise ValueError("Invalid estimated_duration.")

            # validate totral entry fees
            total_fee = option.get("total_entry_fee")

            if type(total_fee) not in (int, float) or total_fee < 0:
                raise ValueError("Invalid total_entry_fee.")

        if option_numbers != {1, 2, 3}:
            raise ValueError(f"Day {day_number} must have option numbers 1, 2 and 3.")

        # Validate optional suggestions
    suggestions = itinerary.get("optional_suggestions")

    if not isinstance(suggestions, list):
        raise ValueError("Invalid optional_suggestions.")

    for suggestion in suggestions:

        if not isinstance(suggestion, dict):
            raise ValueError("Each optional suggestion must be an object.")

        required_fields = [
            "recommended_day",
            "place_name",
            "city",
            "state",
            "country",
            "reason",
            "approximate_time",
        ]

        for field in required_fields:
            value = suggestion.get(field)

            if not isinstance(value, str) or not value.strip():
                raise ValueError(
                    f"Invalid or missing optional suggestion field: {field}"
                )

        fee = suggestion.get("entry_fee_per_person")

        if type(fee) not in (int, float) or fee < 0:
            raise ValueError("Invalid optional suggestion entry fee.")


def generate_itinerary(
    starting_destination,
    ending_destination,
    start_date,
    end_date,
    no_of_travellers,
    budget,
    preferences,
    starting_day_number: int = 1,
):
    prompt = f"""
You are an AI travel planner for a Smart Travel Planner application.

Your job is to create practical, personalized travel itinerary options
based on the trip information provided by the user.


========================
TRIP INFORMATION
========================

Starting destination: {starting_destination}
Ending destination: {ending_destination}
Start date: {start_date}
End date: {end_date}
Number of travellers: {no_of_travellers}
Budget: ₹{budget}
Preferences: {preferences}


========================
MAIN ITINERARY REQUIREMENTS
========================

1. Generate an itinerary for every day between the start date and end date.

2. Start itinerary day numbering from {starting_day_number}.
   The first generated day must have day_number = {starting_day_number}.
   Increment day_number sequentially for each subsequent day.
   Do not restart numbering from Day 1 unless starting_day_number is 1.

3. Generate EXACTLY 3 different itinerary options for EACH day.

4. The 3 options for the same day should be meaningfully different.
   Do not simply rearrange the same places.

5. The itinerary should primarily focus on the user's starting and
   ending destinations.

6. If the starting and ending destinations are the same, treat the trip
   as a destination-based trip and focus on attractions within and
   around that destination.

7. If the starting and ending destinations are different, create the
   main itinerary around the provided starting and ending destinations.

8. IMPORTANT LOCATION RULE:
   Every place included in the MAIN itinerary must be reasonably close
   to the starting destination, ending destination, or the practical
   travel route between them.

   Do NOT select places simply because they are famous or because they
   are located somewhere in the same state.

   Prefer places that are approximately within 65 km of the relevant
   starting destination, ending destination, or practical route.

   A distance slightly above 65 km is acceptable ONLY when the place is
   a very practical and realistic destination for the user's trip and
   can reasonably be visited without making the day's travel
   impractical.

   Do NOT recommend a place that is 150 km or more away from both the
   starting and ending destinations for a normal day's itinerary.

9. The itinerary must be geographically practical.

   Before including a place, consider:
   - distance from the starting destination
   - distance from the ending destination
   - distance from other places selected for that day
   - realistic travel time between places
   - total time available that day

   Places that are geographically far away or require an unrealistic
   detour must NOT be included in the main itinerary.

10. Do NOT automatically add intermediate cities to the main itinerary
   simply because they are geographically between the starting and
   ending destinations.

11. If the starting and ending destinations are the same, keep the
    itinerary focused on that destination and nearby attractions.
    Do not select attractions from distant cities.


12. Every itinerary day must have a clear intended city, state, and country.

13. Every place in every itinerary option must include these fields:
    - place_name
    - city
    - state
    - country

14. The city, state, and country must identify the actual location
    of the attraction, not merely the trip's starting or ending
    destination.

15. For trips involving different cities, assign attractions to
    the city where they are actually located. Do not mix distant
    cities in one day's itinerary unless the travel plan realistically
    accounts for the journey.

16. Use the official or commonly recognized attraction name.
    Do not append the city or country to place_name itself.
    Return location information in separate fields.

17. If the exact city, state, or country is uncertain, do not invent
    a location. Use the most reliable location information available.

    17A. Every place object must contain non-empty values for
    "place_name", "city", "state", and "country".

    17B. Every object in "optional_suggestions" must also contain
     non-empty values for "place_name", "city", "state", and "country".

    17C. If the location of an attraction cannot be confidently determined,
      choose another attraction whose location can be identified reliably.

    17D. Before returning the JSON, verify that every place in all three
    options and every optional suggestion contains all required location fields.

18. The trip duration must be considered when planning the itinerary.
    Do not suggest an unrealistic number of places for a single day.

19. Consider the user's selected preferences when choosing places and
    activities.

20. Avoid unnecessary repetition of the same attraction across options
    and days.

21. Each day's 3 options must represent different budget levels:

    OPTION 1:
    The most expensive / premium option of the three.
    Prefer better-known or premium attractions and activities when
    appropriate.

    OPTION 2:
    A moderate / mid-budget option.
    It should provide a good balance between experience and cost.

    OPTION 3:
    A low-budget / economical option.
    Prefer free or low-entry-fee attractions and activities while still
    providing a useful and enjoyable itinerary.

22. The budget difference between the three options should be
    meaningful.

    Do not make all three options almost identical in total cost.

23. Consider the user's TOTAL trip budget across ALL days.

    The selected options across multiple days should remain reasonably
    aligned with the user's total budget.

    If the user selects the expensive option across all days, the
    resulting total entry-fee cost may be close to the user's budget,
    but should not unnecessarily exceed it.

    If the user selects the mid-budget option across all days, the
    resulting total should generally consume a moderate portion of the
    user's budget.

    If the user selects the low-budget option across all days, the
    resulting total should consume only a smaller portion of the user's
    budget.

24. The three options are independent choices for each day.

    Consider the combined cost if the same option level is selected
    across all days.

25. Also account for mixed selections across days.

    For example:

    Day 1 → Option 2
    Day 2 → Option 1
    Day 3 → Option 3

    Such a combination should still remain reasonably appropriate for
    the user's total budget.

26. NEVER force an expensive activity into an option merely to make that
    option expensive.

    The activities and attractions must still be relevant to the user's
    preferences and destination.

27. Activities involving special experiences must have realistic
   estimated prices.

    For example, if an option includes scuba diving, do not assume an
    unrealistically low entry fee merely because a generic activity
    price is available.

    Scuba diving, adventure activities, water sports and similar
    activities may have significantly higher costs depending on the
    package and location.

    Use a realistic estimated cost per person when such an activity is
    included.

28. When an activity has a variable or package-based price, provide a
    reasonable estimated price per person rather than an obviously
    unrealistic price.

29. Weekend and high-demand activities may cost more than normal.
    Consider this when estimating prices for activities such as scuba
    diving, adventure activities, water sports and similar experiences.

30. Do not recommend an expensive activity when a suitable lower-cost
    alternative can provide a similar experience and the user's budget
    is limited.


=============================
INFORMATION TO SHOW THE USER
============================

Each itinerary option must provide enough information for the user to
compare the options and decide which one they prefer.

For every option provide:

- option number
- option name
- places to visit
- activity at each place
- approximate time required for each place
- total estimated duration for the option
- entry fee per person for each place
- total estimated entry fee for the option for the given number of travellers


========================
BUDGET RULES
========================

The user's budget applies ONLY to entry fees and activity/attraction
costs included in the itinerary.

DO NOT include:

- Food
- Accommodation
- Transportation
- Shopping
- Personal expenses
- Other miscellaneous expenses

For every place or activity that requires payment, provide an estimated
cost for ONE person.

If a place or activity has no entry fee or cost, use 0.

The total entry fee for an option should be calculated as:

cost per person × number of travellers

The total entry fee should include ONLY the attraction/activity costs
included in that option.

Keep the suggested itinerary reasonably within the user's budget.

Do not suggest expensive attractions or activities unnecessarily when
suitable lower-cost alternatives exist.

If exact pricing information is uncertain, provide a realistic
estimated amount and treat it as an estimate.

Do not use an obviously unrealistic price simply to make an option fit
the budget.


===========================
IMPORTANT COST INSTRUCTION
===========================

The entry fee calculation is simple arithmetic.

For example:

Entry fee per person = ₹500
Number of travellers = 2

Total entry fee = ₹500 × 2 = ₹1000

Do NOT include food, hotel, transportation, shopping or other expenses
in this calculation.

For activities such as scuba diving, water sports or adventure
activities, use the realistic estimated activity cost per person when
calculating the total.

Example:

Scuba diving estimated cost per person = ₹2500
Number of travellers = 2

Total activity cost = ₹2500 × 2 = ₹5000

========================
PRICE VARIATION NOTICE
========================

If an activity or attraction has a price that may reasonably vary
depending on demand, weekdays, weekends, season, availability, or
other similar factors, mention this briefly at the END of the
activity field.

Use the following exact format:

"Price may vary depending on demand, weekdays, weekends, season, and availability."

Only include this notice when price variation is reasonably likely.
Do not add this notice to every place unnecessarily.

Do not create a new JSON field for this notice.
Keep the existing JSON structure unchanged.



========================
OPTIONAL SUGGESTIONS
========================

After the main itinerary, provide a small section called
"optional_suggestions".

If the starting and ending destinations are different, provide a few
notable attractions or destinations that the traveller could consider
between the two destinations IF they are flexible with their travel
route.

These are ONLY suggestions.

They must NOT be included in the main itinerary.

Do not assume that the traveller will visit these places.

Optional suggestions do not need to follow the 5–65 km main-itinerary
distance preference because they are only additional possibilities for
a flexible travel route.

If the starting and ending destinations are the same, provide a few
additional notable attractions within or around that destination that
were not already included in the main itinerary.

Keep optional suggestions concise.


========================
IMPORTANT LIMITATIONS
========================

Do not provide:

- Latitude
- Longitude
- Google Maps links
- User ID
- Trip ID
- Database IDs
- Preference IDs
- Database-specific information
- Long historical descriptions
- Long explanations

Google Maps functionality will be handled separately by the application.

========================
OUTPUT FORMAT
========================

Return ONLY valid JSON.

Do NOT use Markdown.

Do NOT use ```json.

Do NOT provide explanations before or after the JSON.

Use exactly this general structure:

{{
    "trip_summary": {{
        "starting_destination": "{starting_destination}",
        "ending_destination": "{ending_destination}",
        "start_date": "{start_date}",
        "end_date": "{end_date}",
        "number_of_travellers": {no_of_travellers},
        "budget": {budget},
        "preferences": {preferences}
    }},

    "days": [
        {{
            "day_number": 1,

            "options": [
                {{
                    "option_number": 1,
                    "option_name": "Option name",

                    "places": [
                        {{
                            "place_name": "Place name",
                            "city": "City name",
                            "state": "State Name",
                            "country": "country name",
                            "activity": "Activity",
                            "approximate_time": "2 hours",
                            "entry_fee_per_person": 500
                        }}
                    ],

                    "estimated_duration": "6 hours",
                    "total_entry_fee": 1000
                }},

                {{
                    "option_number": 2,
                    "option_name": "Option name",

                    "places": [
                        {{
                            "place_name": "Place name",
                            "city": "City name",
                            "state": "State Name",
                            "country": "country name",
                            "activity": "Activity",
                            "approximate_time": "2 hours",
                            "entry_fee_per_person": 300
                        }}
                    ],

                    "estimated_duration": "5 hours",
                    "total_entry_fee": 600
                }},

                {{
                    "option_number": 3,
                    "option_name": "Option name",

                    "places": [
                        {{
                            "place_name": "Place name",
                            "city": "City name",
                            "state": "State Name",
                            "country": "country name",
                            "activity": "Activity",
                            "approximate_time": "3 hours",
                            "entry_fee_per_person": 0
                        }}
                    ],

                    "estimated_duration": "5 hours",
                    "total_entry_fee": 0
                }}
            ]
        }}
    ],

    "optional_suggestions": [
        {{
            "recommended_day": "Day 1",
            "place_name": "Suggested place",
            "city": "City name",
            "state": "State Name",
            "country": "country name",
            "reason": "Short reason why the traveller may consider it",
            "approximate_time": "2 hours",
            "entry_fee_per_person": 300
        }}
    ]
}}
"""

    models_to_try = [
        "gemini-3.5-flash-lite",
        "gemini-3.6-flash",
        "gemini-3.8-flash",
    ]

    MAX_ATTEMPTS = 3

    last_error = None
    last_error_type = None

    for model in models_to_try:

        logger.info("Attempting itinerary generation using model: %s", model)

        # try each model up to 3 times.
        for attempt in range(1, MAX_ATTEMPTS + 1):

            response_text = None

            try:
                response = client.models.generate_content(
                    model=model,
                    contents=prompt,
                )

                response_text = response.text

                if not response_text or not response_text.strip():
                    raise ValueError("Gemini returned an empty response.")

                # Ensure the response is valid JSON before returning.
                itinerary = json.loads(response_text)

                # Basic structure validation.
                validate_itinerary(itinerary)

                logger.info(
                    "Itinerary generated successfully using model: %s",
                    model,
                )

                return itinerary

            except json.JSONDecodeError as e:

                last_error = e
                last_error_type = "invalid_json"

                logger.warning(
                    "Invalid JSON from model %s on attempt %s/%s. "
                    "Line: %s, Column: %s, Error: %s",
                    model,
                    attempt,
                    MAX_ATTEMPTS,
                    e.lineno,
                    e.colno,
                    e.msg,
                )

                # Log only a small section around the invalid JSON.
                if response_text:
                    lines = response_text.splitlines()

                    start = max(0, e.lineno - 3)
                    end = min(len(lines), e.lineno + 2)

                    for i in range(start, end):
                        logger.debug("Response line %s: %s", i + 1, lines[i])

                # Invalid output: retry this model, then try the next one.

            except ValueError as e:

                last_error = e
                last_error_type = "invalid_response"

                logger.warning(
                    "Invalid response from model %s on attempt %s/%s: %s",
                    model,
                    attempt,
                    MAX_ATTEMPTS,
                    e,
                )

                # Retry this model, then try the next one.

            except Exception as e:

                last_error = e

                error_message = str(e).lower()

                error_code = getattr(e, "code", None) or getattr(e, "status_code", None)

                # Identify model-specific availability/configuration errors.
                model_unavailable = any(
                    keyword in error_message
                    for keyword in (
                        "model not found",
                        "model is not found",
                        "is not supported for generatecontent",
                    )
                )

                if model_unavailable:

                    last_error_type = "model_unavailable"

                    logger.warning(
                        "Model %s is unavailable. Moving to the next model. "
                        "Error: %s",
                        model,
                        e,
                    )

                    break

                # Identify temporary API/network failures.
                temporary_error = error_code in (408, 429, 500, 502, 503, 504) or any(
                    keyword in error_message
                    for keyword in (
                        "timeout",
                        "timed out",
                        "connection",
                        "resource_exhausted",
                        "service unavailable",
                        "internal server error",
                        "overloaded",
                        "temporarily unavailable",
                    )
                )

                if temporary_error:

                    last_error_type = "temporary_failure"

                    logger.warning(
                        "Temporary Gemini failure using %s "
                        "(attempt %s/%s). Error code: %s. Error: %s",
                        model,
                        attempt,
                        MAX_ATTEMPTS,
                        error_code,
                        e,
                    )

                else:

                    last_error_type = "permanent_failure"

                    logger.exception(
                        "Non-retryable Gemini error using model %s",
                        model,
                    )

                    raise HTTPException(
                        status_code=status.HTTP_502_BAD_GATEWAY,
                        detail=(
                            "The itinerary service could not process "
                            "your request. Please try again later."
                        ),
                    ) from e

            # Retry delay: 2 seconds, then 4 seconds.
            if attempt < MAX_ATTEMPTS:

                delay = 2**attempt

                logger.info(
                    "Retrying model %s in %s seconds.",
                    model,
                    delay,
                )

                time.sleep(delay)

        logger.warning(
            "Model %s exhausted its attempts. Moving to the next model.",
            model,
        )

    # All configured models have failed.
    logger.error(
        "All Gemini models failed. Last error type: %s. Last error: %s",
        last_error_type,
        last_error,
    )

    # Return an error appropriate to the final failure.
    if last_error_type == "temporary_failure":

        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "The AI itinerary service is temporarily unavailable. "
                "Please try again in a few minutes."
            ),
        ) from last_error

    if last_error_type in ("invalid_json", "invalid_response"):

        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=(
                "The AI itinerary service returned an invalid response. "
                "Please try generating your itinerary again."
            ),
        ) from last_error

    raise HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail=(
            "The AI itinerary service is currently unavailable. "
            "Please try again later."
        ),
    ) from last_error
