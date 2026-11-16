import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, ActivatedRoute } from '@angular/router';
import { Encryption } from '../../services/encryption';

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

  isValidating = true;
  isLinkValid = false;
  isSubmitting = false;

  showNewPassword = false;
  showConfirmPassword = false;

  constructor(
    private http: HttpClient,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    private encryption: Encryption,
  ) {
    //Get the password reset token from URL
    this.route.queryParams.subscribe((params) => {
      this.token = params['token'] || '';

      if (!this.token) {
        this.isValidating = false;
        this.isLinkValid = false;
        return;
      }
      this.validateResetToken();
    });
  }
  validateResetToken(): void {
    this.isValidating = true;
    this.isLinkValid = false;

    this.http
      .post<{ valid: boolean }>('/auth/validate-reset-token', { token: this.token })
      .subscribe({
        next: (response) => {
          this.isLinkValid = response.valid === true;
          this.isValidating = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.isLinkValid = false;
          this.isValidating = false;
          this.cdr.detectChanges();
        },
      });
  }

  async resetPassword(): Promise<void> {
    //prevent multiple submissions
    if (this.isSubmitting) {
      return;
    }

    //clear the previous messages
    this.message = '';
    this.errorMessage = '';

    if (this.isValidating || !this.isLinkValid) {
      return;
    }

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

    this.isSubmitting = true;

    try {
      //Encrypt both password afileds using RSA-OAEP

      const encryptedPassword = await this.encryption.encryptPassword(this.newPassword);

      const encryptedConfirmPassword = await this.encryption.encryptPassword(this.confirmPassword);

      //clear plaintext passwords from component properties
      this.newPassword = '';
      this.confirmPassword = '';

      const resetPasswordData = {
        token: this.token,
        new_password: encryptedPassword,
        confirm_password: encryptedConfirmPassword,
      };

      this.http.post('/auth/reset-password', resetPasswordData).subscribe({
        next: (response: any) => {
          this.isSubmitting = false;

          console.log('password reset successful:', response);

          this.message = 'Password reset successful.';

          this.cdr.detectChanges();

          setTimeout(() => {
            this.router.navigate(['/login']);
          }, 1500);
        },

        error: (error) => {
          this.isSubmitting = false;

          console.error('Password reset failed:', error);
          console.log('Status:', error.status);
          console.log('Error body:', error.error);

          if (error.error?.detail) {
            this.errorMessage = error.error.detail;
          } else {
            this.errorMessage = 'Something went wrong. Please Try again.';
          }

          this.cdr.detectChanges();
        },
      });
    } catch (error) {
      //handel encryption failures
      this.isSubmitting = false;

      this.newPassword = '';
      this.confirmPassword = '';

      console.error('Reset password encryption error:', error);

      this.errorMessage = 'Unable to secure your password. Please try again.';

      this.cdr.detectChanges();
    }
  }
  goToLogin() {
    this.router.navigate(['/login']);
  }
  goToForgotPassword(): void {
    this.router.navigate(['/forgot-password']);
  }
}
