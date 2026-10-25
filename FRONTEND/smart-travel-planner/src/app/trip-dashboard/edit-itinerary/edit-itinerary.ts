import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
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
      this.message = 'No itinerary is avaialble to save.';
      return;
    }

    if (!this.modifiedTrip) {
      this.message = 'Modified trip details are missing. Please edit the treip again.';
      return;
    }


    const allDaysSelected = this.selectedOptions.every(
      (option) => option !== null,
    );

    if(!allDaysSelected) {
      this.message = 'Please select an option for every day.';
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
      this.message = 'Could you find one of your selected options.';
      return;
    }

    const token = localStorage.getItem('access_token');

    if (!token) {
      this.message = 'Your Session has expired.Please log in again.';
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

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    this.isSaving = true;
    this.message = 'Saving your updated trip...';

    console.log('Update request body:', requestBody);

    this.http.put(`http://127.0.0.1:8000/trips/${this.tripId}/save-modified-trip`,
      requestBody,
      { headers },
    )
    .pipe(
      finalize(() => {
        this.isSaving = false;
      }),
    )
    .subscribe ({
      next: (response: any) => {
        this.message = 'Your new trip has been saved successfully!';
        console.log('Trip update response:', response);

        setTimeout(() => {
          this.router.navigate(['/trip-dashboard/modify-trip']);
        }, 1000);
      },
      error: (error) =>{
        console.error('Error updating trip:', error);

      this.message = error.error?.detail || 'Could not update your trip. Please try again.';
      },
    });
  }
}
