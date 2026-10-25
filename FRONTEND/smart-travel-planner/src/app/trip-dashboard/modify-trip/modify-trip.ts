import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-modify-trip',
  imports: [CommonModule],
  templateUrl: './modify-trip.html',
  styleUrl: './modify-trip.css',
})
export class ModifyTrip implements OnInit {
  savedTrip: any[] = [];

  isLoading: boolean = false;

  message: string = '';

  constructor(
    private http: HttpClient,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadTrips();
  }

  loadTrips(): void {
    console.log(' ==== MODIFY TRIP: STARTS ====');
    this.isLoading = true;
    this.message = '';

    const token = localStorage.getItem('access_token');

    if (!token) {
      this.isLoading = false;
      this.message = 'Please login again.';

      this.cdr.detectChanges();
      return;
    }

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });

    this.http.get<any[]>('http://127.0.0.1:8000/trips', { headers }).subscribe({
      next: (response: any[]) => {
        console.log('Trip received:', response);

        this.savedTrip = response.filter((trip: any) =>
          ['upcoming', 'ongoing', 'missed'].includes(trip.status),
        );

        console.log('Trips available for modification:', this.savedTrip);

        this.isLoading = false;
        this.cdr.detectChanges();
      },

      error: (error) => {
        console.error('Backend error details:', error.error);

        this.isLoading = false;

        this.message = error.error?.detail ?? 'Failed to load trips. Please try again.';

        this.cdr.detectChanges();
      },
      complete: () => {
        console.log('---modify trip: request complete---');
      },
    });
  }

  modifyTrip(tripId: number): void {
    console.log('Selected trip fpor modification:', tripId);

    if (!tripId) {
      this.message = 'Invalid trip ID.';
      this.cdr.detectChanges();
      return;
    }

    this.router.navigate(['/trip-dashboard/edit-your-trip', tripId]);
  }
}
