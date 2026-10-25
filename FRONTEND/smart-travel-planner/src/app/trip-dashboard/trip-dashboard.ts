import { Component,OnInit,ChangeDetectorRef } from '@angular/core';
import { Router,RouterLink,RouterLinkActive,RouterOutlet} from "@angular/router";
import { HttpClient, HttpHeaders } from '@angular/common/http';
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
    const token = this.authService.getAccessToken();

    if(!token) {
      console.log('Access token not found');
      return;
    }

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`
    });

    this.http.get<any>('http://127.0.0.1:8000/auth/me', { headers }).subscribe({
      next: (resposne) => {
        this.firstName = resposne.first_name;
        this.lastName = resposne.last_name;

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
