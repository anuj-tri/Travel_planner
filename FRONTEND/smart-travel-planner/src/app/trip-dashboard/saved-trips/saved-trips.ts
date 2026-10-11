import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
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

    const token = localStorage.getItem('access_token');

    console.log('Token exists:', !!token);

    if (!token) {
      console.error('NO ACCESS TOKEN FOUND');

      this.isLoading = false;
      this.message = 'Please login again.';
      return;
    }

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });

    console.log('Calling backend...');
    console.log('URL: http://localhost:8000/trips');

    this.http.get<any[]>('http://localhost:8000/trips', { headers }).subscribe({
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
    console.log('Delete trip:', tripId);

    const confirmDelete = confirm('Are you sure you want to delete this trip?');

    if (!confirmDelete) {
      return;
    }

    const token = localStorage.getItem('access_token');
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    });

    this.http
      .delete(`http://localhost:8000/trips/${tripId}`, {
        headers: headers,
      })
      .subscribe({
        //Success
        next: (response) => {
          console.log('Trip deleted successfully:', response);

          // remove deleted trip from screen
          this.savedTrip = this.savedTrip.filter((trip) => trip.trip_id !== tripId);

          console.log('Updated savedTrip:', this.savedTrip);

          //Force Angular to update the UI
          this.cdr.detectChanges();
        },
        //error

        error: (error) => {
          console.error('Error fetching saved trips:', error);
          console.error('Status:', error.status);
          console.log('Status Text:', error.statusText);
          console.log('URL:', error.url);
          console.error('Backend error details:', error.error);

          this.isLoading = false;
          this.message = 'Failed to load saved trips.';
        },
      });
  }
}
