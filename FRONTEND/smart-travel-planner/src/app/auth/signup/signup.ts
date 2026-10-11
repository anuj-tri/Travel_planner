import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

@Component({
  selector: 'app-signup',
  imports: [CommonModule, FormsModule],
  templateUrl: './signup.html',
  styleUrl: './signup.css',
})
export class Signup {
  // Form values
  firstName: string = '';
  lastName: string = '';
  email: string = '';
  password: string = '';
  confirmPassword: string = '';

  // Messages
  message: string = '';
  errorMessage: string = '';

  constructor(
    private http: HttpClient,
    private router: Router,
  ) {}

  signup() {
    // Clear previous messages
    this.message = '';
    this.errorMessage = '';

    // Check passwords
    if (this.password !== this.confirmPassword) {
      this.errorMessage = 'Passwords do not match.';
      return;
    }

    // Data that will be sent to FastAPI
    const signupData = {
      first_name: this.firstName,
      last_name: this.lastName,
      email: this.email,
      password: this.password,
      confirm_password: this.confirmPassword,
    };

    // Send POST request to FastAPI
    this.http.post('http://localhost:8000/auth/signup', signupData).subscribe({
      next: (response: any) => {
        console.log('Signup successful:', response);

        alert('Sigup successful!');

        this.router.navigate(['/login']);
      },

      error: (error) => {
        console.error('Signup failed:', error);
        console.log('Status:', error.status);
        console.log('URL:', error.url);
        console.log('Error body:', error.error);

        if (error.error?.detail) {
          this.errorMessage = error.error.detail;
        } else {
          this.errorMessage = 'Something went wrong. Please try again.';
        }
      },
    });
  }
  goToLogin() {
    this.router.navigate(['/login']);
  }
}
