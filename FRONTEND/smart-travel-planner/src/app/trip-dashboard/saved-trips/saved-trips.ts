import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

@Component({
  selector: 'app-saved-trips',
  imports: [CommonModule],
  templateUrl: './saved-trips.html',
  styleUrl: './saved-trips.css',
})
export class SavedTrips implements OnInit {
  // Saved trips will be stored here
  savedTrip: any[] = [];

  //Loading state
  isLoading: boolean = false;

  //message for errors
  message: string = '';
  // Custom delete confirmation dialog
  showDeleteDialog: boolean = false;
  tripIdToDelete: number | null = null;

  constructor(
    private http: HttpClient,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  //this runs automatically when the page oprns
  ngOnInit(): void {
    this.loadSavedTrips();
  }

  //get saved trips from backend
  loadSavedTrips(): void {
    console.log('===== SAVED TRIPS START =====');

    this.isLoading = true;
    this.message = '';

    console.log('Calling backend...');

    this.http.get<any[]>('/trips', { withCredentials: true }).subscribe({
      next: (response: any[]) => {
        console.log('===== SUCCESS =====');
        console.log('Response:', response);
        console.log('Number of trips:', response.length);

        this.savedTrip = response;
        this.isLoading = false;

        console.log('savedTrip:', this.savedTrip);
        console.log('isLoading:', this.isLoading);

        // Force Angular to update the HTML
        this.cdr.detectChanges();
      },

      error: (error) => {
        console.error('Error fetching saved trips:', error);
        console.error('Backend error details:', error.error);

        this.isLoading = false;
        this.message = 'Failed to load saved trips.';

        this.cdr.detectChanges();
      },

      complete: () => {
        console.log('===== REQUEST COMPLETE =====');
      },
    });
  }

  // View saved itinerary
  viewItinerary(tripId: number): void {
    console.log('View itinerary for trip:', tripId);

    this.router.navigate(['/trip-dashboard/view-itinerary', tripId]);
  }

  //Delete Trip
  deleteTrip(tripId: number): void {
    this.tripIdToDelete = tripId;
    this.showDeleteDialog = true;
  }

  //close the dialog without deleting the trip
  cancelDelete(): void {
    this.showDeleteDialog = false;
    this.tripIdToDelete = null;
  }

  //Delete the trip after the user confirms
  confirmDelete(): void {
    if (this.tripIdToDelete === null){
      return;
    }

    const tripId = this.tripIdToDelete;

    this.http
      .delete(`/trips/${tripId}`,{
        withCredentials: true,
      })
      .subscribe({
        next: (response) => {
          console.log('Trip deleted successfully:', response);

          this.savedTrip = this.savedTrip.filter(
            (trip) => trip.trip_id !== tripId,
          );
          this.showDeleteDialog = false;
          this.tripIdToDelete = null;
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error deleting trip:', error);
          this.message = 'Failed to delete trip.';
          this.cancelDelete();
          this.cdr.detectChanges();
        },
      });
  }
}
