import os
from dotenv import load_dotenv
from google import genai

import json

load_dotenv()


GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

client = genai.Client(api_key=GEMINI_API_KEY)


def generate_itinerary(
    starting_destination,
    ending_destination,
    start_date,
    end_date,
    no_of_travellers,
    budget,
    preferences,
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

2. Generate EXACTLY 3 different itinerary options for EACH day.

3. The 3 options for the same day should be meaningfully different.
   Do not simply rearrange the same places.

4. The itinerary should primarily focus on the user's starting and
   ending destinations.

5. If the starting and ending destinations are the same, treat the trip
   as a destination-based trip and focus on attractions within and
   around that destination.

6. If the starting and ending destinations are different, create the
   main itinerary around the provided starting and ending destinations.

7. IMPORTANT LOCATION RULE:
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

8. The itinerary must be geographically practical.

   Before including a place, consider:
   - distance from the starting destination
   - distance from the ending destination
   - distance from other places selected for that day
   - realistic travel time between places
   - total time available that day

   Places that are geographically far away or require an unrealistic
   detour must NOT be included in the main itinerary.

9. Do NOT automatically add intermediate cities to the main itinerary
   simply because they are geographically between the starting and
   ending destinations.

10. If the starting and ending destinations are the same, keep the
    itinerary focused on that destination and nearby attractions.
    Do not select attractions from distant cities.

11. The trip duration must be considered when planning the itinerary.
    Do not suggest an unrealistic number of places for a single day.

12. Consider the user's selected preferences when choosing places and
    activities.

13. Avoid unnecessary repetition of the same attraction across options
    and days.

14. Each day's 3 options must represent different budget levels:

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

15. The budget difference between the three options should be
    meaningful.

    Do not make all three options almost identical in total cost.

16. Consider the user's TOTAL trip budget across ALL days.

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

17. The three options are independent choices for each day.

    Consider the combined cost if the same option level is selected
    across all days.

18. Also account for mixed selections across days.

    For example:

    Day 1 → Option 2
    Day 2 → Option 1
    Day 3 → Option 3

    Such a combination should still remain reasonably appropriate for
    the user's total budget.

19. NEVER force an expensive activity into an option merely to make that
    option expensive.

    The activities and attractions must still be relevant to the user's
    preferences and destination.

20. Activities involving special experiences must have realistic
    estimated prices.

    For example, if an option includes scuba diving, do not assume an
    unrealistically low entry fee merely because a generic activity
    price is available.

    Scuba diving, adventure activities, water sports and similar
    activities may have significantly higher costs depending on the
    package and location.

    Use a realistic estimated cost per person when such an activity is
    included.

21. When an activity has a variable or package-based price, provide a
    reasonable estimated price per person rather than an obviously
    unrealistic price.

22. Weekend and high-demand activities may cost more than normal.
    Consider this when estimating prices for activities such as scuba
    diving, adventure activities, water sports and similar experiences.

23. Do not recommend an expensive activity when a suitable lower-cost
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
            "recommended_day": "Day 1"
            "place_name": "Suggested place",
            "reason": "Short reason why the traveller may consider it",
            "approximate_time": "2 hours",
            "entry_fee_per_person": 300
        }}
    ]
}}
"""

    response = client.models.generate_content(
        model="gemini-3.5-flash-lite", contents=prompt
    )
    return json.loads(response.text)
