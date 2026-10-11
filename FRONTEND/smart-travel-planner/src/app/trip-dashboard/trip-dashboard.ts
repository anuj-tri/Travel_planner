import { Component,OnInit } from '@angular/core';
import {RouterLink,RouterOutlet} from "@angular/router";
import { HttpClient, HttpHeaders } from '@angular/common/http';




@Component({
  selector: 'app-trip-dashboard',
  imports: [RouterLink,RouterOutlet],
  templateUrl: './trip-dashboard.html',
  styleUrl: './trip-dashboard.css',
})
export class TripDashboard implements OnInit{

  firstName: string = '';
  lastName: string = '';

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.getCurrentUser();
  }

  getCurrentUser(): void {
    const token = localStorage.getItem('access_token');

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
      },
      error: (error) => {
        console.error('Failed to get current user:', error);
      }

    });
  }

}
