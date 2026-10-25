import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '../auth.service';

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
    private authService: AuthService,
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

    this.authService.login(loginData).subscribe({
      next: (response) => {
        console.log('Login Successful');

        this.router.navigate(['/trip-dashboard/create-new-trip']);
      },

      error: (error) => {
        console.error('Login failed:', error);

        const detail =
          error?.error?.detail ??
          error?.error?.message ??
          '';

        if (
          typeof detail ==='string' && /email.*(not registered|not found|does not exist)/i.test(detail)
        ) {
          this.errorMessage ='Email is not registered';
        } else if (
          typeof detail === 'string' &&/(incorrect password|invalid password|wrong password)/i.test(detail)
        ){
          this.errorMessage= 'Inccorect password.';
        } else {
          this.errorMessage = 'Invalid email or passsword.';
        }
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
