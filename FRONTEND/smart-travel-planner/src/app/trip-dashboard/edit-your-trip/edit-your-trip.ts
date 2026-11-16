import { Component, OnInit, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';

interface TripEditDetails {
  trip_id: number;
  starting_destination: string;
  ending_destination: string;
  start_date: string;
  end_date: string;
  no_of_travellers: number;
  budget: number;
  status: string;
  edit_mode: 'full_edit' | 'restricted_edit'
  preference_ids: number[];
}

interface TripFormSnapshot {
  startingDestination: string;
  endingDestination: string;
  startDate: string;
  endDate: string;
  travellers: number;
  budget: number;
  selectedPreferences: string[]
}

interface PreviewItineraryResponse {
  trip_id: number;
  itinerary: any;
}

@Component({
  selector: 'app-edit-your-trip',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './edit-your-trip.html',
  styleUrl: './edit-your-trip.css',
})
export class EditYourTrip implements OnInit, OnDestroy {

  tripId!: number;

  //form fields
  startingDestination = '';
  endingDestination = '';
  startDate = '';
  endDate = '';
  travellers = 1;
  budget = 2000;

  //prefrence displayed in the HTML
  preferences: string[] = [
    'ADVENTURE',
    'SPIRITUAL',
    'BEACHES',
    'HIKING',
    'TREKKING',
    'HISTORICAL',
    'COUPLE TRIP',
    'NATURE',
    'INDOOR ACTIVITY',
    'WILDLIFE',
    'SHOPPING',
    'CULTURAL EXPERIENCE',
    'NIGHTLIFE',
    'PHOTOGRAPHY',
    'RELAXATION',
    'FAMILY FRIENDLY',
    'STREET FOOD',
    'FINE DINING',
    'CAFE & RESTAURANT',
    'RESTAURANTS'
  ];

  selectedPreferences: string[] = [];

  // Prefrence name -> id
  preferenceIdMap: { [key: string]: number } = {
    'ADVENTURE': 1,
    'SPIRITUAL': 2,
    'BEACHES': 3,
    'HIKING':4,
    'TREKKING': 5,
    'HISTORICAL': 6,
    'COUPLE TRIP': 7,
    'NATURE': 8,
    'INDOOR ACTIVITY': 9,
    'WILDLIFE': 10,
    'SHOPPING': 11,
    'CULTURAL EXPERIENCE': 12,
    'NIGHTLIFE': 13,
    'PHOTOGRAPHY': 14,
    'RELAXATION': 15,
    'FAMILY FRIENDLY': 16,
    'STREET FOOD': 17,
    'FINE DINING': 18,
    'CAFE & RESTAURANT': 19,
    'RESTAURANTS': 20
  };

  isLoading = true;
  isGenerating = false;
  errorMessage = '';
  generateMessage = '';
  tripStatus = '';
  editMode: 'full_edit' | 'restricted_edit' | '' = '';

  fieldErrors: { [key: string]: string} ={};

  minDate: string = this.getLocalDate();

  //progress bar properties
  generationProgress = 0;
  elapsedSeconds =0;
  progressLabel = 'Getting things ready...';
  timeRemainingMessage = "estimated time remaining: about 45 seconds";

  private progressInterval : ReturnType<typeof setInterval> | null = null;
  private navigationTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly estimatedDuration = 45;

  //original from values, used to dtect chnages
  private originalSnapshot: TripFormSnapshot | null = null;

  constructor (
    private route: ActivatedRoute,
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const id = Number(params.get('tripId'));

      if (!Number.isInteger(id) || id <= 0){
        this.errorMessage = 'Invalid trip ID.';
        this.isLoading = false;
        return;
      }

      this.tripId = id;
      this.loadTripDetails();
    });
  }

  ngOnDestroy(): void {
    this.stopGenerationProgress();

    if (this.navigationTimeout !== null) {
      clearTimeout(this.navigationTimeout);
      this.navigationTimeout = null;
    }
  }
  private getLocalDate(): string {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

// Load the existing trip from the backend
loadTripDetails(): void {
  this.isLoading = true;
  this.errorMessage ='';

    this.http.get<TripEditDetails>(
      `/trips/${this.tripId}/edit-details`,
      { withCredentials: true}
    ).subscribe({
      next: (response) => {
        this.tripStatus = response.status;

        //validate the editing mode received from backend
        if (
          response.edit_mode !== 'full_edit' &&
          response.edit_mode !== 'restricted_edit'
        ) {
          this.errorMessage = "Invalid trip editing mode received from server.";
          this.isLoading = false;
          return;
        }
        this.editMode = response.edit_mode;
        this.startingDestination = response.starting_destination;
        this.endingDestination = response.ending_destination;
        this.startDate = response.start_date;
        this.endDate = response.end_date;
        this.travellers = response.no_of_travellers;
        this.budget = response.budget;

        //convert prefrence ids into names
        const idToName: { [id: number]: string} = {};

        for (const name in this.preferenceIdMap) {
          idToName[this.preferenceIdMap[name]] = name;
        }

        this.selectedPreferences = response.preference_ids
          .map(id => idToName[id])
          .filter((name): name is string => Boolean(name));

        // save the original values AFTER pre-filling the form
        this.saveOriginalSnapshot();

        this.isLoading = false;
        this.cdr.detectChanges();


        console.log('Trip details loaded:', response);
        console.log('Selected prefrences:', this.selectedPreferences);
      },

      error: (error) => {
        console.error('Failed to load trip details:', error);

      this.errorMessage =
        error.error?.detail ?? 'Unable to load trip details.';

      this.isLoading = false;
      this.cdr.markForCheck();
      }
    });
  }

  //save the initial form state
  private saveOriginalSnapshot(): void {
    this.originalSnapshot = {
      startingDestination: this.startingDestination.trim(),
      endingDestination: this.endingDestination.trim(),
      startDate: this.startDate,
      endDate: this.endDate,
      travellers: Number(this.travellers),
      budget: Number(this.budget),
      selectedPreferences: [...this.selectedPreferences].sort()
    };
  }

  //true only when the form differs from its original values
  get hasChanges(): boolean {
    if(!this.originalSnapshot) {
      return false;
    }
    const current: TripFormSnapshot = {
      startingDestination: this.startingDestination.trim(),
      endingDestination: this.endingDestination.trim(),
      startDate: this.startDate,
      endDate: this.endDate,
      travellers: Number(this.travellers),
      budget: Number(this.budget),
      selectedPreferences: [...this.selectedPreferences].sort()
    };

    return (current.startingDestination !==
      this.originalSnapshot.startingDestination ||
      current.endingDestination !== this.originalSnapshot.endingDestination ||
      current.startDate !== this.originalSnapshot.startDate ||
      current.endDate !== this.originalSnapshot.endDate ||
      current.travellers !== this.originalSnapshot.travellers ||
      current.budget !== this.originalSnapshot.budget ||
      JSON.stringify(current.selectedPreferences) !== JSON.stringify(this.originalSnapshot.selectedPreferences)
    );
  }

  // swap the starting and ending destination

  swapDestinations(): void {
    if (this.editMode === 'restricted_edit'){
      return;
    }
    const temp = this.startingDestination;
    this.startingDestination = this.endingDestination;
    this.endingDestination = temp;
  }

  // Select of deselect a prefrence
  togglePreference(preference: string): void {
    const index = this.selectedPreferences.indexOf(preference);

    if (index !== -1) {
      this.selectedPreferences.splice(index, 1);
    } else {
      this.selectedPreferences.push(preference);
    }
  }
  //check whether a prefrence is selected
  isPreferenceSelected(preference: string): boolean {
    return this.selectedPreferences.includes(preference);
  }


  private validateForm(): boolean {
    this.fieldErrors = {};
    this.errorMessage = '';

    // Starting destination
    if (!this.startingDestination.trim()) {
      this.fieldErrors['startingDestination'] =
        'Please enter the starting destination.';
    }

    // Ending destination
    if (!this.endingDestination.trim()) {
      this.fieldErrors['endingDestination'] =
        'Please enter the ending destination.';
    }

    // Start date validation
    if (!this.startDate) {
      this.fieldErrors['startDate'] =
        'Please select the start date.';
    } else if (
      this.editMode === 'full_edit' &&
      this.startDate < this.minDate
    ) {
      this.fieldErrors['startDate'] =
        'Start date must be today or a future date.';
    }

    // End date validation
    if (!this.endDate) {
      this.fieldErrors['endDate'] =
        'Please select the end date.';
    } else if (this.editMode === 'restricted_edit') {

      const tomorrowString = this.getTomorrowDate();

      if (this.endDate < tomorrowString) {
        this.fieldErrors['endDate'] =
          'End date must be tomorrow or a later date.';
      }

    } else if (
      this.editMode === 'full_edit' &&
      this.startDate &&
      this.endDate < this.startDate
    ) {
      this.fieldErrors['endDate'] =
        'End date must be on or after the start date.';
    }

    // Number of travellers
    if (
      !Number.isInteger(Number(this.travellers)) ||
      Number(this.travellers) < 1
    ) {
      this.fieldErrors['travellers'] =
        'Enter a valid number of travellers greater than zero.';
    }

    // Budget
    if (
      !Number.isFinite(Number(this.budget)) ||
      Number(this.budget) < 2500
    ) {
      this.fieldErrors['budget'] =
        'Enter a valid budget of at least ₹2500.';
    }

    return Object.keys(this.fieldErrors).length === 0;
  }

  clearFieldError(field: string): void {
    delete this.fieldErrors[field];
    this.errorMessage = '';
  }

  getTomorrowDate(): string {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const year = tomorrow.getFullYear();
    const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const day = String(tomorrow.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  goBackToModifyTrip(): void {
    this.router.navigate(['/trip-dashboard/modify-trip']);
  }

  //start the simulated progress while the preview API is processing

  private startGenerationProgress(): void {
    this.stopGenerationProgress();

    this.generationProgress = 5;
    this.elapsedSeconds = 0;
    this.progressLabel = 'Updating your trip details...';
    this.timeRemainingMessage = 'Estimated time remaining: about 45 seconds';

    this.progressInterval = setInterval (() => {
      this.elapsedSeconds++;

      //do not reach 100% until the api scucced
      if (this.generationProgress < 90) {
        this.generationProgress = Math.min (
          90,
          this.generationProgress +
            (this.generationProgress < 60 ? 2 : 1)
        );
      }

      if (this.elapsedSeconds <5 ) {
        this.progressLabel = 'Updating your trip details...';
      } else if (this.elapsedSeconds < 20) {
        this.progressLabel = 'AI is regenrating you itinerar...';
      } else {
        this.progressLabel = 'Finding places and finalizing your plan...';
      }

      const remaining = Math.max(
        1,
        this.estimatedDuration - this.elapsedSeconds
      );

      this.timeRemainingMessage =
        this.elapsedSeconds < this.estimatedDuration
          ? `Estimated time remaining: about ${remaining} seconds`
          : 'Taking longer that expected. Place keep this page open...';

        // Supports Anugular changes detection, including zoneless setup
      this.cdr.markForCheck();
    }, 1000);
  }

  private stopGenerationProgress(): void {
    if (this.progressInterval !== null) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }

  private completeGenerationProgress(): void {
    this.stopGenerationProgress();

    this.generationProgress = 100;
    this.progressLabel = 'Your updated itinerary is ready!';
    this.timeRemainingMessage = 'Opening your itinerary preview...';

    this.cdr.markForCheck();
  }

  private resetGenerationProgress (): void {
    this.stopGenerationProgress();

    this.generationProgress = 0 ;
    this.progressLabel = 'Generation failed';
    this.timeRemainingMessage = ' Please try again.';
    this.generateMessage = '';

    this.cdr.markForCheck();
  }

  //temporary handler until the preview-itinerary API is implimented
  generateTrip(): void {
    if (this.isGenerating) {
      return;
    }

    if (!this.validateForm()) {
      this.generateMessage= '';
      return;
    }

    if (!this.hasChanges) {
      this.generateMessage = '';
      this.errorMessage = 'Please change at least one trip details before generating.';
      return;
    }

    this.isGenerating = true;
    this.errorMessage = '';
    this.generateMessage = 'Please wait while we update your trip and build your personalised itinerary.';
    this.startGenerationProgress();

    const preferenceIds = this.selectedPreferences
      .map(preference => this.preferenceIdMap[preference])
      .filter((id): id is number => id !== undefined);


    const requestBody= {
      starting_destination: this.startingDestination.trim(),
      ending_destination: this.endingDestination.trim(),
      start_date: this.startDate,
      end_date: this.endDate,
      no_of_travellers: Number(this.travellers),
      budget: Number(this.budget),
      preference_ids: preferenceIds
    };

    this.http.post<PreviewItineraryResponse>(`/trips/${this.tripId}/preview-itinerary`,
      requestBody,
      { withCredentials: true }
    ).subscribe({
      next: (response) => {
        console.log('Modified itinerary response:', response);
        this.completeGenerationProgress();
        this.navigationTimeout = setTimeout(() => {
          this.navigationTimeout = null;
          this.isGenerating = false;
          this.cdr.markForCheck();
          this.router.navigate(
            ['/trip-dashboard/edit-itinerary', this.tripId],
            {
              state: {
                itinerary: response.itinerary,
                modifiedTrip: requestBody
              }
            }
          ).then((navigated) => {
            if (!navigated) {
              this.errorMessage =
                'Itinerary generated, but the preview page could not be opened.';
              this.cdr.markForCheck();
            }
          }).catch((error) => {
            console.error('Navigation error:', error);

            this.errorMessage =
              'Itinerary generated, but the preview page could not be opened.';

            this.cdr.markForCheck();
          });
        }, 800);
      },


      error: (error) => {
        console.error('Preview itinerary API error:', error);

        this.resetGenerationProgress();
        this.isGenerating = false;

        const detail = error.error?.detail;

        if(typeof detail === 'string'){
          this.errorMessage = detail;
        } else if (Array.isArray(detail)) {
          this.errorMessage = detail
            .map((item: any) => item.msg || 'Invalid input')
            .join('. ');
        }else {
          this.errorMessage ='Unable to generate the modified itinerary. Please check your details and try again.';
        }
        this.cdr.markForCheck();
      }
    });
  }
}
