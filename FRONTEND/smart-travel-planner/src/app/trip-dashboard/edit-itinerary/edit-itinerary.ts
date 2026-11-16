import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { finalize } from 'rxjs';


@Component({
  selector: 'app-edit-itinerary',
  imports: [CommonModule],
  templateUrl: './edit-itinerary.html',
  styleUrl: './edit-itinerary.css',
})
export class EditItinerary {
  tripId: number = 0;
  itineraryData: any = null;
  modifiedTrip: any = null;

  currentDayIndex: number = 0;
  selectedOptions: (number | null)[] = [];

  message: string = '';
  isSaving: boolean = false;

  // Error popup properties
  showPopup: boolean = false;
  popupTitle: string = '';
  popupMessage: string = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private http: HttpClient,
  ) {
    this.tripId = Number(
      this.route.snapshot.paramMap.get('tripId'),
    );

    const navigationState = window.history.state;

    this.itineraryData = navigationState.itinerary ?? null;
    this.modifiedTrip = navigationState.modifiedTrip ?? null;

    console.log('Trip ID received:', this.tripId);
    console.log('New itinerary received:', this.itineraryData);
    console.log('Modified trip details:', this.modifiedTrip);

    if (this.itineraryData?.days?.length){
      this.selectedOptions = new Array(
        this.itineraryData.days.length,
      ).fill(null);
    }
    console.log('Initial selections:', this.selectedOptions);
  }

  // Display error popup
  showErrorPopup(title: string, message: string): void {

    this.popupTitle = title;
    this.popupMessage = message;
    this.showPopup = true;

    // Immediately update the page to display popup
    this.cdr.detectChanges();
  }

  // Close error popup
  closePopup(): void {

    this.showPopup = false;

    // Immediately update the page to remove popup
    this.cdr.detectChanges();
  }

  selectOption(optionNumber: number): void {
    if (this.selectedOptions[this.currentDayIndex] === optionNumber){
      this.selectedOptions[this.currentDayIndex] = null;
    } else  {
      this.selectedOptions[this.currentDayIndex] = optionNumber;
    }
  }

  isOptionSelected(optionNumber: number): boolean {
    return this.selectedOptions[this.currentDayIndex] === optionNumber;
  }

  nextDay(): void {
    if(
      this.itineraryData?.days?.length &&
      this.currentDayIndex < this.itineraryData.days.length -1
    ) {
      this.currentDayIndex++;
    }
  }

  previousDay(): void{
    if (this.currentDayIndex > 0){
      this.currentDayIndex--;
    }
  }
  goToDay(dayIndex: number): void {
    if (
      this.itineraryData?.days?.length && dayIndex >= 0 && dayIndex < this.itineraryData.days.length
    ){
      this.currentDayIndex = dayIndex;
    }
  }

  getActivityText(activity: string): string {
    const warning ='Price may vary depending on demand, weekdays, weekends, season, and availability.';

    if(!activity){
      return '';
    }
    return activity.replace(warning, '').trim();
  }

  hasPriceWarning(activity: string): boolean {
    const warning =
      'Price may vary depending on demand, weekdays, weekends, season, and availability.';

    return !!activity && activity.includes(warning);
  }
  goBackToEditTrip(): void {
  this.router.navigate(
    ['/trip-dashboard/edit-your-trip', this.tripId],
    {
      state: {
        modifiedTrip: this.modifiedTrip,
        itinerary: this.itineraryData,
        selectedOptions: this.selectedOptions,
      },
    },
  );
  }
  saveUpdatedTrip(): void {
    if(this.isSaving) {
      return;
    }
    if (!this.itineraryData?.days?.length) {
      this.message = 'No itinerary is available to save.';
      return;
    }

    if (!this.modifiedTrip) {
      this.message = 'Modified trip details are missing. Please edit the trip again.';
      return;
    }


    const unselectedDays = this.selectedOptions
      .map((option, index) =>
        option === null
          ? this.itineraryData.days[index].day_number
          : null,
      )
      .filter((dayNumber) => dayNumber !== null);

    if(unselectedDays.length > 0) {
      const dayList = unselectedDays
        .map((dayNumber) => `Day ${dayNumber}`)
        .join(', ')

      this.message = `You have not selected an option for these days: ${dayList}.`;
      return;
    }

    const selectedItineraries = this.itineraryData.days.map(
      (day: any, index: number) => {
        const selectedOptionNumber = this.selectedOptions[index];

        const selectedOption = day.options.find(
          (option: any) =>
            option.option_number === selectedOptionNumber,
        );

        return{
          day_number: day.day_number,
          itinerary_data: selectedOption,
        };
      },
    );

    if (
      selectedItineraries.some(
        (day: any) => !day.itinerary_data,
      )
    ) {
      this.message = 'Could not find one of your selected options.';
      return;
    }

    const requestBody = {
      starting_destination: this.modifiedTrip.starting_destination,
      ending_destination: this.modifiedTrip.ending_destination,
      start_date: this.modifiedTrip.start_date,
      end_date: this.modifiedTrip.end_date,
      no_of_travellers: this.modifiedTrip.no_of_travellers,
      budget: this.modifiedTrip.budget,
      preference_ids: this.modifiedTrip.preference_ids,
      itineraries: selectedItineraries,
    };

    if (!Array.isArray(requestBody.preference_ids)) {
      this.message = 'Trip preferences are missing. Please edit the trip again.';
      return;
    }

    this.isSaving = true;
    this.message = 'Saving your updated trip...';

    this.cdr.detectChanges();

    console.log('Update request body:', requestBody);

    this.http.put(`/trips/${this.tripId}/save-modified-trip`,
      requestBody,
      { withCredentials: true },
    )
    .pipe(
      finalize(() => {
        this.isSaving = false;
        this.cdr.detectChanges();
      }),
    )
    .subscribe ({
      next: () => {
        this.message = 'Your new trip has been saved successfully!';
        this.cdr.detectChanges();

        setTimeout(() => {
          this.router.navigate(['/trip-dashboard/saved-trips']);
        }, 1000);
      },

      // ERROR
      error: (error) => {

        console.error('Error updating trip:', error);
        console.error('Backend error details:', error.error);

        const detail = error.error?.detail;

        // CASE 1: 422 - PLACE NOT FOUND
        if (
          error.status === 422 &&
          detail?.code === 'PLACE_NOT_FOUND'
        ) {

          const dayNumber = detail.day_number;
          const placeName = detail.place_name;

          this.showErrorPopup(
            'Unable to Save Updated Trip',
            `We couldn't find or verify "${placeName}" for Day ${dayNumber}. ` +
            `Please select a different itinerary option for Day ${dayNumber} and try saving again.`
          );
        }

        // CASE 2: 503 - GOOGLE PLACES API FAILURE
        else if (
          error.status === 503 &&
          detail?.code === 'GOOGLE_API_FAILURE'
        ) {

          this.showErrorPopup(
            'Google Places Service Unavailable',
            detail.message ||
              'Google Places service is temporarily unavailable. Please wait 4–5 minutes and try saving your updated trip again.'
          );
        }

        // CASE 3: OTHER 422 ERRORS
        else if (error.status === 422) {

          const errorMessage =
            typeof detail === 'string'
              ? detail
              : detail?.message ||
                "We couldn't verify one or more places. Please try again.";

          this.showErrorPopup(
            'Unable to Save Updated Trip',
            errorMessage
          );
        }

        // CASE 4: CONNECTION FAILURE
        else if (error.status === 0) {

          this.showErrorPopup(
            'Connection Error',
            'Unable to connect to the server. Please check your internet connection and try again.'
          );
        }

        // CASE 5: OTHER ERRORS
        else {
          this.showErrorPopup(
            'Unable to Save Updated Trip',
            "We couldn't update your trip right now. Please try again."
          );
        }
        this.cdr.detectChanges();
      },
    });
  }
}
