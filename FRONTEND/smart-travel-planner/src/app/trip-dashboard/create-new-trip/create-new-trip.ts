import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { Component, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Router } from '@angular/router';

@Component({
  selector: 'app-create-new-trip',
  imports: [CommonModule, FormsModule],
  templateUrl: './create-new-trip.html',
  styleUrl: './create-new-trip.css',
})
export class CreateNewTrip implements OnDestroy{
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
    'ADVENTURE': 1,
    'SPIRITUAL': 2,
    'BEACHES': 3,
    'HIKING': 4,
    'TREKKING': 5,
    'HISTORICAL': 6,
    'COUPLE TRIP': 7,
    'NATURE': 8,
    'INDOOR ACTIVITY': 9,
    'WILDLIFE': 10,
    'SHOPPING': 11,
    'CULTURAL EXPERIENCE': 12,
    'NIGHTLIFE': 13,
    'PHOTOGRAPHY': 14,
    'RELAXATION': 15,
    'FAMILY FRIENDLY': 16,
    'STREET FOOD': 17,
    'FINE DINING': 18,
    'CAFE & RESTAURANT': 19,
    'RESTAURANTS': 20,
  };

  //error message
  errorMessage: string = '';

  //generating message  and //error occured while genrating message
  generateMessage: string = '';
  isGenerating: boolean = false;

  // progress bar properties.
  generationProgress: number = 0;
  elapsedSeconds: number = 0;
  timeRemainingMessage: string = 'Estimated time: 15-25 seconds';
  progressLabel: string ='Getting things ready...';

  private progressInterval: ReturnType<typeof setInterval> | null = null;
  private readonly estimatedDuration = 45;


  minDate: string = '';

  constructor(
    private http: HttpClient,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {
    this.setMinimumDate();
  }

  ngOnDestroy(): void {
    this.stopGenerationProgress();
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

    this.errorMessage = '';
    this.isGenerating = true;
    this.generateMessage = 'Please wait while we build your personalised itinerary.';
    this.startGenerationProgress();

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


    console.log('Trip Data:', tripData);


    this.http.post('/trips', tripData, { withCredentials: true }).subscribe({
      next: (response: any) => {
        //Create trip api success.
        console.log('Create Trip Response:', response);

        const tripId = response.trip_id;

        console.log('Trip ID:', tripId);

        //Gernerate Itinerary API
        this.http
          .post(`/trips/${tripId}/generate-itinerary`, {}, { withCredentials: true })
          .subscribe({
            //Generate itinerary success
            next: (intineraryResponse: any) => {
              console.log('Generated Itinerary:', intineraryResponse);

             this.completeGenerationProgress();

            // Keep the progress visible briefly before navigating.
            setTimeout(() => {
              this.isGenerating = false;

              this.router.navigate(['/trip-dashboard/itinerary'], {
                state: {
                  tripId: response.trip_id,
                  itinerary: intineraryResponse.itinerary,
                },
              });
            }, 800);
            },

            //Generate itinerary error
            error: (error) => {
              console.error('Generate ITinerary Error:', error);
              console.error('Backend validation details:', error.error?.detail);

              this.stopGenerationProgress();
              this.isGenerating = false;
              this.generationProgress = 0;
              this.errorMessage = '';
              if (error.status === 429 || error.status === 503) {
                this.errorMessage =
                  'Our AI service is experiencing high demand. Please try again in a minute.';
              } else if (error.status === 502 || error.status === 504) {
                this.errorMessage =
                  'The AI service is taking too long to respond. Please try again in a minute.';
              } else {
                this.errorMessage =
                  'Unable to generate your itinerary. Please try again.';
              }
              this.generateMessage = '';
              this.cdr.detectChanges();
            },
          });
      },

      //Create trip error

      error: (error) => {
        console.error('Create Trip Error:', error);
        console.error('Backend validation details:', error.error?.detail);

        //Unlock button if Create Trip API fails
        this.stopGenerationProgress();

        this.isGenerating = false;
        this.generationProgress =0 ;
        this.errorMessage = 'Unable to create trip. Please try again.';
        this.generateMessage = '';
        this.cdr.detectChanges();
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
  private startGenerationProgress(): void {
    this.stopGenerationProgress();

    this.generationProgress = 5;
    this.elapsedSeconds =0 ;
    this.progressLabel ='Creating your Trip...';
    this.timeRemainingMessage = 'Estimated time remaining : about 45 seconds';

    this.progressInterval = setInterval(() => {
      this.elapsedSeconds += 0.5;


      if(this.generationProgress < 90) {
        this.generationProgress = Math.min(
          90,
          this.generationProgress + (this.generationProgress <60 ? 2 : 1)
        );
      }

      //update the current stage.
      if(this.elapsedSeconds < 5) {
        this.progressLabel = 'Creating your trip...';
      } else if(this.elapsedSeconds <20) {
        this.progressLabel = 'AI is planing your itinerary...';
      } else {
        this.progressLabel = 'Finding places and finalizing your plan...';
      }

      const remaining = Math.max(
        1,
        Math.ceil(this.estimatedDuration - this.elapsedSeconds)
      );

      this.timeRemainingMessage =
        this.elapsedSeconds < this.estimatedDuration
          ? `Estimated time remaining: about ${remaining} seconds`
          : 'Taking longer than expected. Please keep this page open...';

      this.cdr.markForCheck();
    }, 500);

  }

  private stopGenerationProgress(): void {
    if (this.progressInterval !== null) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }

  private completeGenerationProgress(): void {
    this.stopGenerationProgress();
    this.generationProgress = 100;
    this.progressLabel = 'Your itinerary is ready!';
    this.timeRemainingMessage = 'Taking you to your itinerary...';
  }
}
