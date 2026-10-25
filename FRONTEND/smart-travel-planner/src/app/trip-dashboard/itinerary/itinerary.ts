import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
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

  constructor(
    private http: HttpClient,
    private router: Router,
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

  //save Itinerary

  saveItinerary(): void {
    if (this.isSaving) {
      return;
    }
    const allDaySelected = this.selectedOptions.every(
      (option) => option !== null,
    );

    if (!allDaySelected) {
      alert('Please select an option for every day.');

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

    //get access token

    const token = localStorage.getItem('access_token');

    console.log('Access token exists:', !!token);

    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    });

    //Start saving

    this.isSaving = true;

    this.http
      .post(
        `http://localhost:8000/trips/${this.tripId}/save-itinerary`,

        {
          itineraries: itineraries,
        },

        {
          headers: headers,
        },
      )
      .subscribe({
        //suceess
        next: (response: any) => {
          console.log('Save itinerary response:', response);

          this.isSaving = false;
          this.message = 'Itinerary saved Successfully!';

          // redirecting to saved trips after showing message

          setTimeout(() => {
            this.router.navigate(['/trip-dashboard/saved-trips']);
          }, 1500);
        },

        //error

        error: (error) => {
          console.error('Error saving intinerary:', error);

          console.error('Backend error details:', error.error);

          this.isSaving = false;

          this.message = 'Failed to save itinerary.';
        },
      });
  }
}
