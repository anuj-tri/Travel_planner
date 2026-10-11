import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-reset-password',
  imports: [CommonModule, FormsModule],
  templateUrl: './reset-password.html',
  styleUrl: './reset-password.css',
})
export class ResetPassword {
  newPassword: string = '';
  confirmPassword: string = '';

  token: string = '';

  message: string = '';
  errorMessage: string = '';

  constructor(
    private http: HttpClient,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
  ) {
    //Get the jwt token from URL
    this.route.queryParams.subscribe((params) => {
      this.token = params['token'] || '';
    });
  }

  resetPassword() {
    //clear the previous messages
    this.message = '';
    this.errorMessage = '';

    if (!this.newPassword && !this.confirmPassword) {
      this.errorMessage = 'Please enter your new password and confirm your password.';
      this.cdr.detectChanges();
      return;
    }

    if (!this.newPassword) {
      this.errorMessage = 'Please enter your new password.';
      this.cdr.detectChanges();
      return;
    }

    if (!this.confirmPassword) {
      this.errorMessage = 'Please confirm your password.';
      this.cdr.detectChanges();
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.errorMessage = 'Passwords do not match.';
      this.cdr.detectChanges();
      return;
    }

    if (!this.token) {
      this.errorMessage = 'Invalid or missing reset token.';
      this.cdr.detectChanges();
      return;
    }

    const resetPasswordData = {
      token: this.token,
      new_password: this.newPassword,
      confirm_password: this.confirmPassword,
    };

    this.http.post('http://localhost:8000/auth/reset-password', resetPasswordData).subscribe({
      next: (response: any) => {
        console.log('password reset successful:', response);

        this.message = 'Password reset successful.';

        this.cdr.detectChanges();

        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 1500);
      },

      error: (error) => {
        console.error('Password reset failed:', error);
        console.log('Status:', error.status);
        console.log('Error body', error.error);

        if (error.error?.detail) {
          this.errorMessage = error.error.detail;
        } else {
          this.errorMessage = 'Something went wrong. Please Try again.';
        }

        this.cdr.detectChanges();
      },
    });
  }
  goToLogin() {
    this.router.navigate(['/login']);
  }
}
