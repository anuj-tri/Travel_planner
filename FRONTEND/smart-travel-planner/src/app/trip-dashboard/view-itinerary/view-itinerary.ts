import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-view-itinerary',
  imports: [CommonModule],
  templateUrl: './view-itinerary.html',
  styleUrl: './view-itinerary.css',
})
export class ViewItinerary implements OnInit {
  // trip details
  tripDetails: any = null;

  // saved itinerary

  savedItinerary: any[] = [];

  selectedDayIndex: number = 0;

  selectedDay: any = null;

  tripStatus: string = '';

  //loading/ errro

  isLoading: boolean = false;

  message: string = '';

  //trip id received from url

  tripId: number = 0;

  //Goofle maps
  map: google.maps.Map | null = null;
  markers: google.maps.Marker[] = [];

  constructor(
    private http: HttpClient,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  //page load

  ngOnInit(): void {
    this.tripId = Number(this.route.snapshot.paramMap.get('tripId'));

    console.log('View Itinerary trip ID:', this.tripId);

    if (!this.tripId) {
      console.error('Invalid Trip ID');

      this.message = 'Invalid trip ID.';
      return;
    }

    this.loadTripDetails();
    this.loadSavedItinerary();
  }

  //get trip detais for header
  loadTripDetails(): void {
    console.log('------loading trip details-----');

    const token = localStorage.getItem('access_token');

    console.log('Access token exists:', !!token);

    if (!token) {
      console.error('no access token found');

      this.message = 'Please login again.';

      return;
    }

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });

    const url = `http://127.0.0.1:8000/trips`;

    console.log('Calling trip details API:', url);

    this.http.get<any[]>(url, { headers }).subscribe({
      next: (response: any) => {
        console.log('----All trip response----');
        console.log('Response:', response);

        //find the trip that was selected from saved trips

        const trip = response.find((item: any) => item.trip_id === this.tripId);

        if (trip) {
          this.tripDetails = trip;

          ((this.tripStatus = trip.status ?? ''),
            console.log('Selected trip details:', this.tripDetails));
          console.log('Trip satatus:', this.tripStatus);
        } else {
          console.error('Trip not found for ID:', this.tripId);

          this.message = 'Trip details not found.';
        }

        //refresh angular ui

        this.cdr.detectChanges();
      },

      error: (error) => {
        console.error('error fetching trip details:', error);

        console.error('Backend error:', error.error);

        this.message = 'Failed to load trip details.';

        this.cdr.detectChanges();
      },

      complete: () => {
        console.log('----trip details request complete----');
      },
    });
  }

  markTripCompleted(): void {
    if (this.tripStatus !== 'missed') {
      return;
    }

    const confirmed = confirm(
      'Are you sure you want to maek this trip as completd? This action cannnot be undone.',
    );

    if (!confirmed) {
      return;
    }

    const token = localStorage.getItem('access_token');

    if (!token) {
      this.message = 'please login again.';
      return;
    }

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });

    const url = `http://127.0.0.1.8000/trips/${this.tripId}/complete`;

    this.http.patch<any>(url, {}, { headers }).subscribe({
      next: (response) => {
        console.log('Trip marked as completed:', response);

        this.tripStatus = response.status;

        if (this.tripDetails) {
          this.tripDetails.status = response.status;
        }
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Failed to mark trip as completed:', error);

        this.message = error.error?.details ?? 'Failed to mark trip as completd. Please try again.';

        this.cdr.detectChanges();
      },
    });
  }

  //get saved itinerary

  loadSavedItinerary(): void {
    console.log('----View saved itinerary---');

    this.isLoading = true;
    this.message = '';

    const token = localStorage.getItem('access_token');

    console.log('Access token exists:', !!token);

    if (!token) {
      console.error('No access token found');

      this.isLoading = false;
      this.message = 'please login again.';

      return;
    }

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });

    const url = `http://127.0.0.1:8000/trips/${this.tripId}/View-saved-itinerary`;

    console.log('Calling backend:', url);

    this.http.get<any[]>(url, { headers }).subscribe({
      next: (response: any[]) => {
        console.log('----itinerary response----');
        console.log('Response:', response);

        this.savedItinerary = response;

        console.log('Number of days:', this.savedItinerary.length);

        // select first day automatically

        if (this.savedItinerary.length > 0) {
          this.selectedDayIndex = 0;

          this.selectedDay = this.savedItinerary[0];
        }
        this.isLoading = false;

        // force angular Ui refresh
        this.cdr.detectChanges();

        console.log('Selected Day:', this.selectedDay);

        //initilaize google map after the html is required
        setTimeout(() => {
          this.initializeMap();
        }, 0);
      },

      error: (error) => {
        console.error('Error fetching saved itinerary:', error);

        console.error('Backend error:', error.error);

        this.isLoading = false;

        this.message = 'Failed to load saved itinerary.';

        this.cdr.detectChanges();
      },

      complete: () => {
        console.log('----request complete----');
      },
    });
  }

  //maps start friom here
  async initializeMap(): Promise<void> {
    const mapElement = document.getElementById('saved-itinerary-map');

    if (!mapElement) {
      console.error('Map container not found.');
      return;
    }

    setOptions({
      key: environment.googleMapsApiKey,
      v: 'weekly',
    });

    await importLibrary('maps');

    this.map = new google.maps.Map(mapElement, {
      center: {
        lat: 20.5937,
        lng: 78.9629,
      },
      zoom: 5,
    });

    console.log('Google Map initialized.');

    this.updateMap();
  }

  updateMap(): void {
    // this make sure map exists

    if (!this.map) {
      return;
    }

    //Make sure day is selected

    if (!this.selectedDay) {
      return;
    }

    // get place for the selected day
    const places = this.selectedDay.itinerary_data?.places;

    if (!places || places.length === 0) {
      console.log('No place found for selected day.');
      return;
    }

    console.log('Updating map for Day:', this.selectedDay.day_number);
    console.log('Places:', places);

    //Remove old markers
    this.markers.forEach((marker) => {
      marker.setMap(null);
    });

    this.markers = [];

    // Create bounds so google maps can show all places
    const bounds = new google.maps.LatLngBounds();

    //create marker for every place
    places.forEach((place: any, index: number) => {
      if (place.latitude === undefined || place.longitude === undefined) {
        console.warn('Coordinates missing for:', place.place_name);
        return;
      }

      const position = {
        lat: Number(place.latitude),
        lng: Number(place.longitude),
      };

      const marker = new google.maps.Marker({
        position: position,
        map: this.map,
        title: place.place_name,
        label: `${index + 1}`,
      });

      this.markers.push(marker);

      bounds.extend(position);
    });

    //Adjust map yo show all markers

    if (this.markers.length > 0) {
      this.map.fitBounds(bounds);
    }

    console.log('map updated with', this.markers.length, 'markers.');
  }

  //select day

  selectDay(index: number): void {
    console.log('Chnaging day from', this.selectedDayIndex, 'to', index);

    //prevent invalid index

    if (index < 0 || index >= this.savedItinerary.length) {
      return;
    }

    this.selectedDayIndex = index;
    this.selectedDay = this.savedItinerary[index];

    console.log('Selected Day:', this.selectedDay);

    //udate map for the newly slescted map
    this.updateMap();

    //force angular to refresh the page

    this.cdr.detectChanges();
  }

  // get day dates
  getDayDate(dayNumber: number): string {
    if (!this.tripDetails) {
      return '';
    }

    const startDate = new Date(this.tripDetails.start_date);

    startDate.setDate(startDate.getDate() + dayNumber - 1);

    return startDate.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
    });
  }

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

  //back to saved trip page
  goBack(): void {
    this.router.navigate(['/trip-dashboard/saved-trips']);
  }
}
