import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
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

  selectedStatus: string = 'all';
  statusFilters = [
    { label: 'All Trips', value: 'all' },
    { label: 'Upcoming', value: 'upcoming' },
    { label: 'Ongoing', value: 'ongoing' },
    { label: 'Missed', value: 'missed' },
  ];

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

  get filteredTrips(): any[] {
    if (this.selectedStatus === 'all') {
      return this.savedTrip;
    }

    return this.savedTrip.filter(
      (trip: any) => trip.status === this.selectedStatus,
    );
  }

  loadTrips(): void {
    console.log(' ==== MODIFY TRIP: STARTS ====');
    this.isLoading = true;
    this.message = '';

    this.http.get<any[]>('/trips', { withCredentials: true }).subscribe({
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
    console.log('Selected trip for modification:', tripId);

    if (!tripId) {
      this.message = 'Invalid trip ID.';
      this.cdr.detectChanges();
      return;
    }

    this.router.navigate(['/trip-dashboard/edit-your-trip', tripId]);
  }
}
