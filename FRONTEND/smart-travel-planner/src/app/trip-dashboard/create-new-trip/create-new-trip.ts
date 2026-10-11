import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Router } from '@angular/router';
import { Itinerary } from '../itinerary/itinerary';

@Component({
  selector: 'app-create-new-trip',
  imports: [CommonModule, FormsModule],
  templateUrl: './create-new-trip.html',
  styleUrl: './create-new-trip.css',
})
export class CreateNewTrip {
  //trip details

  startingDestination: string = '';
  endingDestination: string = '';

  startDate: string = '';
  endDate: string = '';

  travellers: number = 1;
  budget: number | null = null;

  //prefrences
  preferences: string[] = [
    'ADVENTURE',
    'SPIRITUAL',
    'BEACHES',
    'HIKING',
    'TREKKING',
    'HISTORICAL',
    'COUPLE TRIP',
    'NATURE',
    'INDOOR ACTIVITY',
    'WILDLIFE',
    'SHOPPING',
    'CULTURAL EXPERIENCE',
    'NIGHTLIFE',
    'PHOTOGRAPHY',
    'RELAXATION',
    'FAMILY FRIENDLY',
    'STREET FOOD',
    'FINE DINING',
    'CAFE & RESTAURANT',
    'RESTAURANTS',
  ];

  selectedPreferences: string[] = [];

  preferenceIdMap: { [key: string]: number } = {
    ADVENTURE: 1,
    SPIRITUAL: 2,
    BEACHES: 3,
    HIKING: 4,
    TREKKING: 5,
    HISTORICAL: 6,
    'COUPLE TRIP': 7,
    NATURE: 8,
    'INDOOR ACTIVITY': 9,
    WILDLIFE: 10,
    SHOPPING: 11,
    'CULTURAL EXPERIENCE': 12,
    NIGHTLIFE: 13,
    PHOTOGRAPHY: 14,
    RELAXATION: 15,
    'FAMILY FRIENDLY': 16,
    'STREET FOOD': 17,
    'FINE DINING': 18,
    'CAFE & RESTAURANT': 19,
    RESTAURANTS: 20,
  };

  //error message

  errorMessage: string = '';

  //generating message  and //error occured while genrating message
  generateMessage: string = '';
  isGenerating: boolean = false;

  minDate: string = '';

  constructor(
    private http: HttpClient,
    private router: Router,
  ) {
    this.setMinimumDate();
  }

  //set tommorow Date as a minimum date

  setMinimumDate(): void {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const year = tomorrow.getFullYear();
    const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const day = String(tomorrow.getDate()).padStart(2, '0');

    this.minDate = `${year}-${month}-${day}`;
  }

  //Selesct / unslesct prefrences

  togglePreference(preference: string): void {
    if (this.selectedPreferences.includes(preference)) {
      this.selectedPreferences = this.selectedPreferences.filter((item) => item !== preference);
    } else {
      this.selectedPreferences.push(preference);
    }
  }

  // check whether the prefrences is slescted

  isPreferenceSelected(preference: string): boolean {
    return this.selectedPreferences.includes(preference);
  }

  //validate trip details

  validateTrip(): boolean {
    this.errorMessage = '';

    // destination validation

    if (!this.startingDestination.trim()) {
      this.errorMessage = 'Please enter the starting destination';
      return false;
    }

    if (!this.endingDestination.trim()) {
      this.errorMessage = 'Please enter the ending destination';
      return false;
    }

    //Start date validation

    if (!this.startDate) {
      this.errorMessage = 'Please select the start date.';
      return false;
    }

    if (!this.endDate) {
      this.errorMessage = 'Please select the end date.';
      return false;
    }

    //both dates must be tommorow or latter

    if (this.startDate < this.minDate) {
      this.errorMessage = 'Start date must be tomorow or a future date.';
      return false;
    }

    if (this.endDate < this.minDate) {
      this.errorMessage = 'End date must be tomorrow or a future date.';
      return false;
    }

    //end date cannot be before satrt date

    if (this.endDate < this.startDate) {
      this.errorMessage = 'End date cannot be before the start date.';
      return false;
    }

    // tRveller validation

    if (this.travellers < 1) {
      this.errorMessage = 'There must be at least one travellers.';
      return false;
    }

    // Budget validation

    if (this.budget === null || this.budget <= 2499.99999) {
      this.errorMessage = 'The Minimum budget is ₹2,500.';
      return false;
    }

    return true;
  }

  //Generate trip
  generateTrip(): void {
    // Prevent multiple clicks
    if (this.isGenerating) {
      return;
    }

    if (!this.validateTrip()) {
      return;
    }

    this.isGenerating = true;
    this.generateMessage = 'Your trip is being generate... Please wait.';

    const preferenceIds = this.selectedPreferences.map(
      (preference) => this.preferenceIdMap[preference],
    );

    const tripData = {
      starting_destination: this.startingDestination,
      ending_destination: this.endingDestination,
      start_date: this.startDate,
      end_date: this.endDate,
      no_of_travellers: this.travellers,
      budget: this.budget,
      preference_ids: preferenceIds,
    };
    const token = localStorage.getItem('access_token');
    const headers = {
      Authorization: `Bearer ${token}`,
    };

    console.log('Trip Data:', tripData);
    console.log('Access Token exists:', !!token);

    this.http.post('http://127.0.0.1:8000/trips', tripData, { headers }).subscribe({
      next: (response: any) => {
        //Create trip api success.
        console.log('Create Trip Response:', response);

        const tripId = response.trip_id;

        console.log('Trip ID:', tripId);

        //Gernerate Itinerary API
        this.http
          .post(`http://127.0.0.1:8000/trips/${tripId}/generate-itinerary`, {}, { headers })
          .subscribe({
            //Generate itinerary success
            next: (intineraryResponse: any) => {
              console.log('Generated Itinerary:', intineraryResponse);

              this.isGenerating = false;

              this.router.navigate(['/trip-dashboard/itinerary'], {
                state: {
                  tripId: response.trip_id,
                  itinerary: intineraryResponse.itinerary,
                },
              });
            },

            //Generate itinerary error
            error: (error) => {
              console.error('Generate ITinerary Error:', error);
              console.error('Backend validation details:', error.error?.detail);

              this.isGenerating = false;
              this.generateMessage = 'Unable to generate your itinerary. Please try again.';
            },
          });
      },

      //Create trip error

      error: (error) => {
        console.error('Create Trip Error:', error);
        console.error('Backend validation details:', error.error?.detail);

        //Unlock button if Create Trip API fails

        this.isGenerating = false;

        this.generateMessage = 'Unable to create trip. Please try again.';
      },
    });

    console.log('Satrting Destination:', this.startingDestination);
    console.log('Ending Destination:', this.endingDestination);
    console.log('Start Date:', this.startDate);
    console.log('End Date:', this.endDate);
    console.log('Travellers:', this.travellers);
    console.log('Budget:', this.budget);
    console.log('Preferences:', this.selectedPreferences);
  }
}
