import { Component,OnInit,ChangeDetectorRef } from '@angular/core';
import { Router,RouterLink,RouterLinkActive,RouterOutlet} from "@angular/router";
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../auth/auth.service';




@Component({
  selector: 'app-trip-dashboard',
  imports: [RouterLink,RouterOutlet, RouterLinkActive],
  templateUrl: './trip-dashboard.html',
  styleUrl: './trip-dashboard.css',
})
export class TripDashboard implements OnInit{

  firstName: string = '';
  lastName: string = '';

  constructor(
    private cdr: ChangeDetectorRef,
    private http: HttpClient,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.getCurrentUser();
  }

  getCurrentUser(): void {

    this.http.get<any>('/auth/me', { withCredentials: true }).subscribe({
      next: (response) => {
        this.firstName = response.first_name;
        this.lastName = response.last_name;

        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Failed to get current user:', error);
      }

    });
  }

  logout(): void {
    this.authService.logout().subscribe({
      next: () => {
        this.router.navigate(['/login']);
      },
      error: (error) => {
        console.error('Logout failed:', error);

        //this will clear local token even if the backend request fails.
        this.authService.clearTokens();
        this.router.navigate(['/login']);
      }
    });
  }
}
