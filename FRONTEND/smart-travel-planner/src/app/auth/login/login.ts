import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  email: string = '';
  password: string = '';

  message: string = '';
  errorMessage: string = '';

  constructor(
    private http: HttpClient,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  login() {
    this.message = '';
    this.errorMessage = '';

    if (!this.email || !this.password) {
      this.errorMessage = 'Please enter your email and password';
      return;
    }

    const loginData = {
      email: this.email,
      password: this.password,
    };

    this.http.post('http://localhost:8000/auth/login', loginData).subscribe({
      next: (response: any) => {
        console.log('Login Succesful:', response);

        localStorage.setItem('access_token', response.access_token);

        alert('login Successful');

        this.router.navigate(['/trip-dashboard/create-new-trip']);
      },

      error: (error) => {
        console.error('login failed:', error);
        console.log('Status:', error.status);
        console.log('URL:', error.url);
        console.log('Error body:', error.error);

        this.errorMessage = 'Invalid email or password.';
        this.cdr.detectChanges();
      },
    });
  }

  goToSignup() {
    this.router.navigate(['/signup']);
  }

  goToForgotPassword() {
    this.router.navigate(['/forgot-password']);
  }
}
