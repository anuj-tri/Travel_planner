import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

@Component({
  selector: 'app-forgot-password',
  imports: [CommonModule, FormsModule],
  templateUrl: './forgot-password.html',
  styleUrl: './forgot-password.css',
})
export class ForgotPassword {
  email: string = '';

  message: string = '';
  errorMessage: string = '';
  isSubmitting: boolean = false;

  constructor(
    private http: HttpClient,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  sendResetLink() {

    //prevent duplicate submission
    if (this.isSubmitting) {
      return;
    }
    this.message = ''; // Clear the previous messages
    this.errorMessage = '';

    if (!this.email) {
      //  Check if the mail is empty
      this.errorMessage = 'Please enter your email address.';
      return;
    }
    this.isSubmitting = true;

    const forgotPasswordData = {
      email: this.email,
    };

    this.http
      .post(
        //Send this request to fats api
        '/auth/forgot-password',
        forgotPasswordData,
      )
      .subscribe({
        next: (response: any) => {
          console.log('Reset link request successful:', response);

          this.message = 'Reset link has been sent to your email.';
          this.isSubmitting = false;
          this.cdr.detectChanges();
        },

        error: (error) => {
          console.error('Forgot password failed:', error);
          console.log('Status:', error.status);
          console.log('Error body:', error.error);

          if(error.status === 404){
            this.errorMessage = 'Please enter a registered email address.';
          } else {
            this.errorMessage = 'Unable to send the reset link. Please try again.';
          }
          this.message =''
          this.isSubmitting = false;
          this.cdr.detectChanges();
        },
      });
  }

  goToLogin() {
    this.router.navigate(['/login']);
  }
}
