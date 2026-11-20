import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
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

  //loading/ error
  isLoading: boolean = false;

  message: string = '';

  //custom makr-as-completed confirmation dialog
  showCompleteDialog: boolean = false;

  //trip id received from url
  tripId: number = 0;

  //Google maps
  map: google.maps.Map | null = null;
  markers: google.maps.Marker[] = [];

  //keep the original place index linked to its marker.
  //This handles places that do not have coordinates.
  markerByPlaceIndex = new Map<number, google.maps.Marker>();

  activeInfoWindow: google.maps.InfoWindow | null = null;
  selectedPlaceIndex: number | null = null;

  // Stores the road route polylines currently displayed on the map.
  routePolylines: google.maps.Polyline[] = [];

  // Prevents an older route request from drawing after the user switches days.
  private routeRequestId = 0;

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

    const url = `/trips`;

    console.log('Calling trip details API:', url);

    this.http.get<any[]>(url, { withCredentials: true }).subscribe({
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

    this.showCompleteDialog = true;
    this.cdr.detectChanges();
  }

  // Close the dialog without completing the trip
  cancelCompleteTrip(): void {
    this.showCompleteDialog = false;
    this.cdr.detectChanges();
  }

  // Complete the trip after the user confirms
  confirmCompleteTrip(): void {
    if (this.tripStatus !== 'missed') {
      this.cancelCompleteTrip();
      return;
    }

    const url = `/trips/${this.tripId}/complete`;

    this.http.patch<any>(url, {}, { withCredentials: true }).subscribe({
      next: (response) => {
        console.log('Trip marked as completed:', response);

        this.tripStatus = response.status;

        if (this.tripDetails) {
          this.tripDetails.status = response.status;
        }

        this.showCompleteDialog = false;
        this.message = '';

        this.cdr.detectChanges();
      },

      error: (error) => {
        console.error('Failed to mark trip as completed:', error);

        this.message = error.error?.detail ?? 'Failed to mark trip as completed. Please try again.';

        this.showCompleteDialog = false;

        this.cdr.detectChanges();
      },
    });
  }

  //get saved itinerary

  loadSavedItinerary(): void {
    console.log('----View saved itinerary---');

    this.isLoading = true;
    this.message = '';

    const url = `/trips/${this.tripId}/View-saved-itinerary`;

    console.log('Calling backend:', url);

    this.http.get<any[]>(url, { withCredentials: true }).subscribe({
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

  //maps start from here
  async initializeMap(): Promise<void> {
    try {
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
    } catch (error) {
      console.error('Failed to initialize Google Maps:', error);
    }
  }

  updateMap(): void {
    // this make sure map exists

    if (!this.map || !this.selectedDay) return;

    const places = this.selectedDay.itinerary_data?.places;

    //remove marker from the previously selected day.
    this.markerByPlaceIndex.forEach((marker) => marker.setMap(null));
    this.markers = [];
    this.markerByPlaceIndex.clear();

    // Remove the previous day's driving route.
    this.routeRequestId++;

    this.routePolylines.forEach((polyline) => {
      polyline.setMap(null);
    });

    this.routePolylines = [];

    //close any previously opened infowondow.
    this.activeInfoWindow?.close();
    this.activeInfoWindow = null;

    //resety selected place  when the day chnages.
    this.selectedPlaceIndex = null;

    if (!places || places.length === 0) {
      console.log('No place found for selected day.');
      return;
    }

    // Create bounds so google maps can show all places
    const bounds = new google.maps.LatLngBounds();

    //create marker for every place
    places.forEach((place: any, index: number) => {
      if (place.latitude == null || place.longitude == null) {
        console.warn('Coordinates missing for:', place.place_name);
        return;
      }

      const position = {
        lat: Number(place.latitude),
        lng: Number(place.longitude),
      };

      if (!Number.isFinite(position.lat) || !Number.isFinite(position.lng)) {
        console.warn('Invalid coordinates for:', place.place_name);
        return;
      }

      const marker = new google.maps.Marker({
        position,
        map: this.map,
        title: place.place_name,
        label: `${index + 1}`,
      });

      this.markers.push(marker);

      //store the marker using the original itinerary place index.
      this.markerByPlaceIndex.set(index, marker);

      bounds.extend(position);
    });

    //Adjust map yo show all markers
    if (this.markers.length > 0) {
      this.map.fitBounds(bounds);
    }

    console.log('Map updated with', this.markers.length, 'markers.');

    // Draw the driving route for the selected day.
    void this.drawDrivingRoute(places);
  }

  // Draw the actual driving route for the selected day's itinerary.
  async drawDrivingRoute(places: any[]): Promise<void> {
    try {
      const currentRequestId = this.routeRequestId;
      // Keep only places with valid coordinates, preserving their order.
      const validPlaces = places.filter((place: any) => {
        const lat = Number(place.latitude);
        const lng = Number(place.longitude);

        return (
          place.latitude != null &&
          place.longitude != null &&
          Number.isFinite(lat) &&
          Number.isFinite(lng)
        );
      });

      // A route requires at least an origin and destination.
      if (validPlaces.length < 2) {
        console.log('Not enough valid places to calculate a route.');
        return;
      }

      // Google Routes API supports a maximum of 25 intermediate waypoints.
      if (validPlaces.length > 27) {
        console.warn('Too many places for a single driving route.');
        return;
      }

      // Import Google's Routes library.
      const { Route } = (await importLibrary(
        'routes'
      )) as google.maps.RoutesLibrary;

      const origin = {
        lat: Number(validPlaces[0].latitude),
        lng: Number(validPlaces[0].longitude),
      };

      const destination = {
        lat: Number(validPlaces[validPlaces.length - 1].latitude),
        lng: Number(validPlaces[validPlaces.length - 1].longitude),
      };

      const intermediates = validPlaces.slice(1, -1).map((place: any) => ({
        location: {
          lat: Number(place.latitude),
          lng: Number(place.longitude),
        },
      }));

      // Calculate the actual driving route.
      const { routes } = await Route.computeRoutes({
        origin,
        destination,
        intermediates,
        travelMode: 'DRIVING',
        optimizeWaypointOrder: false,
        fields: ['path'],
      });

      // Ignore the response if the user has switched to another day.
      if (this.routeRequestId !== currentRequestId || !this.map) {
        return;
      }

      if (!routes || routes.length === 0) {
        console.warn('No driving route found for this day.');
        return;
      }

      // Create the road-following route polyline.
      const polylines = routes[0].createPolylines();

      polylines.forEach((polyline) => {
        polyline.setOptions({
          strokeColor: '#2563eb',
          strokeOpacity: 0.9,
          strokeWeight: 5,
        });

        polyline.setMap(this.map);
      });

      this.routePolylines = polylines;

      console.log('Driving route displayed successfully.');
    } catch (error) {
      console.error('Failed to calculate driving route:', error);
    }
  }

  focusPlaceOnMap(placeIndex: number): void {
    if (!this.map || !this.selectedDay) return;

    const marker = this.markerByPlaceIndex.get(placeIndex);

    if (!marker) {
      console.warn('No map marker available for itinerary place index:', placeIndex);
      return;
    }

    const position = marker.getPosition();

    if (!position) return;

    // Remember which place card is selected.
    this.selectedPlaceIndex = placeIndex;

    // Move the map to the selected marker and zoom in.
    this.map.panTo(position);
    this.map.setZoom(15);

    // Close the previously opened InfoWindow.
    this.activeInfoWindow?.close();

    const places = this.selectedDay.itinerary_data?.places;
    const place = places?.[placeIndex];

    if (!place) return;

    const infoContent = document.createElement('div');
    infoContent.textContent = place.place_name;

    // Display the selected place name.
    this.activeInfoWindow = new google.maps.InfoWindow({
      content: infoContent,
    });

    this.activeInfoWindow.open({
      map: this.map,
      anchor: marker,
    });

    this.cdr.detectChanges();
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
