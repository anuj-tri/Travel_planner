import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

@Component({
  selector: 'app-itinerary',
  imports: [CommonModule],
  templateUrl: './itinerary.html',
  styleUrl: './itinerary.css',
})
export class Itinerary {
  tripId: number = 0;
  itineraryData: any = null;

  currentDayIndex: number = 0; //current day being displayed

  selectedOptions: (number | null)[] = []; // it will store the selscted option for each days like: [1,2,3]
  message: string = '';
  isSaving: boolean = false;

  showPopup: boolean = false;
  popupTitle: string = '';
  popupMessage: string = '';

  constructor(
    private http: HttpClient,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {
    const navigate = window.history.state;

    this.tripId = navigate.tripId;
    this.itineraryData = navigate.itinerary;

    console.log('Trip ID received:', this.tripId);
    console.log('Itinerary received:', this.itineraryData);

    //creating empty selesction for evry day
    if (this.itineraryData?.days?.length) {
      this.selectedOptions = new Array(this.itineraryData.days.length).fill(null);
    }

    console.log('Selected options:', this.selectedOptions);
  }

  // option selection validation

  selectOption(optionNumber: number): void {
    // if the same option cliclked again unselect it
    if (this.selectedOptions[this.currentDayIndex] === optionNumber) {
      this.selectedOptions[this.currentDayIndex] = null;

      console.log(`Day ${this.currentDayIndex + 1}: Option ${optionNumber} unselected`);
    } else {
      this.selectedOptions[this.currentDayIndex] = optionNumber; // select the new option

      console.log(`Day ${this.currentDayIndex + 1}: Option ${optionNumber} selected`);
    }
    console.log('ALl selsctions:', this.selectedOptions);
  }

  //Check whether option is selected

  isOptionSelected(optionNumber: number): boolean {
    return this.selectedOptions[this.currentDayIndex] === optionNumber;
  }

  //next day

  nextDay(): void {
    // Move to next day
    if (this.currentDayIndex < this.itineraryData.days.length - 1) {
      this.currentDayIndex++;

      console.log('Moved to Day:', this.currentDayIndex + 1);
    }
  }

  // Previous day

  previousDay(): void {
    if (this.currentDayIndex > 0) {
      this.currentDayIndex--;

      console.log('Moved to Day:', this.currentDayIndex + 1);
    }
  }


  // going to specific day

  goToDay(dayIndex: number): void {
    this.currentDayIndex = dayIndex;

    console.log('opened day:', this.currentDayIndex + 1);
  }

  // Price warning function    added in the end
  getActivityText(activity: string): string {
    const warning =
      'Price may vary depending on demand, weekdays, weekends, season, and availability.';

    if (!activity) {
      return '';
    }

    return activity.replace(warning, '').trim();
  }

  hasPriceWarning(activity: string): boolean {
    const warning =
      'Price may vary depending on demand, weekdays, weekends, season, and availability.';

    return !!activity && activity.includes(warning);
  }

  // Display error popup
  showErrorPopup(title: string, message: string): void {
    this.popupTitle = title;
    this.popupMessage = message;
    this.showPopup = true;

    this.cdr.detectChanges();
  }

  // Close popup and unlock Save button
  closePopup(): void {
    this.showPopup = false;

    this.isSaving = false;

    this.cdr.detectChanges();
  }

  //save Itinerary
  saveItinerary(): void {
    if (this.isSaving) {
      return;
    }
    const unselectedDays = this.selectedOptions
      .map((option, index) =>
        option === null
          ? this.itineraryData.days[index].day_number
          : null,
    )
    .filter((dayNumber) => dayNumber !== null);

    if (unselectedDays.length > 0) {
      const dayList = unselectedDays
        .map((dayNumber) => `Day ${dayNumber}`)
        .join(', ')
      this.message=`You have not selected an option for these days: ${dayList}.`;
      return;
    }

    console.log('Trip ID:', this.tripId);
    console.log('Selected Options:', this.selectedOptions);

    // Create Request Data

    const itineraries = this.itineraryData.days.map((day: any, index: number) => {
      const selectedOptionNumber = this.selectedOptions[index];

      //Find the actual selected options
      const selectedOption = day.options.find(
        (option: any) => option.option_number === selectedOptionNumber,
      );

      return {
        day_number: day.day_number,

        itinerary_data: selectedOption,
      };
    });

    console.log('Data being saved to backend:', itineraries);
    this.message= '';
    //Start saving
    this.isSaving = true;

    this.http
      .post(
        `/trips/${this.tripId}/save-itinerary`,
        {
          itineraries: itineraries,
        },
        {
          withCredentials: true,
        },
      )
      .subscribe({

        // SUCCESS
        next: (response: any) => {
          console.log('Save itinerary response:', response);

          this.isSaving = false;
          this.message = 'Itinerary saved successfully!';

          this.cdr.detectChanges();

          // Redirect after showing success message
          setTimeout(() => {
            this.router.navigate(['/trip-dashboard/saved-trips']);
          }, 1500);
        },

        // ERROR
        error: (error) => {
          console.error('Error saving itinerary:', error);
          console.error('Backend error details:', error.error);

          this.isSaving = false;

          const detail = error.error?.detail;

          // CASE 1: 422 - PLACE NOT FOUND
          if (
            error.status === 422 &&
            detail?.code === 'PLACE_NOT_FOUND'
          ) {
            const dayNumber = detail.day_number;
            const placeName = detail.place_name;

            this.showErrorPopup(
              'Unable to Save Itinerary',
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
              'Google Places service is temporarily unavailable. ' +
              'Please wait 4–5 minutes and try saving your itinerary again.'
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
              'Unable to Save Itinerary',
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
              'Unable to Save Itinerary',
              "We couldn't save your itinerary right now. Please try again."
            );
          }

          this.cdr.detectChanges();
        }

      });
  }
}
