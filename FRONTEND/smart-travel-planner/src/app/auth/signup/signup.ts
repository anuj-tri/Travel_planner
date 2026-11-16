import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Encryption } from '../../services/encryption';


@Component({
  selector: 'app-signup',
  imports: [CommonModule, FormsModule],
  templateUrl: './signup.html',
  styleUrl: './signup.css',
})
export class Signup {
  firstName = '';
  lastName = '';
  email = '';
  password = '';
  confirmPassword = '';

  message = '';
  errorMessage = '';

  firstNameError = '';
  lastNameError = '';
  emailError = '';
  passwordError = '';
  confirmPasswordError = '';

  showPassword = false;
  showConfirmPassword = false;
  showEmailExistsPopup = false;

  isSubmitting = false;
  private redirectTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private http: HttpClient,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private encryption: Encryption
  ) {}

  validateForm(): boolean {
    this.firstNameError = '';
    this.lastNameError = '';
    this.emailError = '';
    this.passwordError = '';
    this.confirmPasswordError = '';

    this.firstName = this.firstName.trim();
    this.lastName = this.lastName.trim();
    this.email = this.email.trim();

    // First name
    if (!this.firstName) {
      this.firstNameError = 'Please enter your first name.';
    } else if (!/^[A-Za-z]+(?:[ '-][A-Za-z]+)*$/.test(this.firstName)) {
      this.firstNameError =
        'Use letters only. Spaces, hyphens and apostrophes are allowed between names.';
    }

    // Last name
    if (!this.lastName) {
      this.lastNameError = 'Please enter your last name.';
    } else if (!/^[A-Za-z]+(?:[ '-][A-Za-z]+)*$/.test(this.lastName)) {
      this.lastNameError =
        'Use letters only. Spaces, hyphens and apostrophes are allowed between names.';
    }

    // Email
    if (!this.email) {
      this.emailError = 'Please enter your email address.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email)) {
      this.emailError = 'Please enter a valid email address.';
    }

    // Password
    if (!this.password) {
      this.passwordError = 'Please enter a password.';
    } else if (this.password.length < 8) {
      this.passwordError = 'Password must contain at least 8 characters.';
    }

    // Confirm password
    if (!this.confirmPassword) {
      this.confirmPasswordError = 'Please confirm your password.';
    } else if (this.password !== this.confirmPassword) {
      this.confirmPasswordError = 'Passwords do not match.';
    }

    return !(
      this.firstNameError ||
      this.lastNameError ||
      this.emailError ||
      this.passwordError ||
      this.confirmPasswordError
    );
  }

  clearServerError(): void {
    this.errorMessage = '';
    this.message = '';
    this.emailError = '';
    this.showEmailExistsPopup = false;
  }

  async signup(): Promise<void> {

    if (this.isSubmitting) {
      return;
    }

    this.message = '';
    this.errorMessage = '';

    if (!this.validateForm()) {
      return;
    }

    this.isSubmitting = true;

    try {

      //encrypt password and confirm password using RSA-OAEP
      const encryptedPassword =
        await this.encryption.encryptPassword(this.password);

      const encryptedConfirmPassword=
        await this.encryption.encryptPassword(this.confirmPassword);

      this.password= '';
      this.confirmPassword= '';

    const signupData = {
      first_name: this.firstName,
      last_name: this.lastName,
      email: this.email,
      password: encryptedPassword,
      confirm_password: encryptedConfirmPassword,
    };

    this.http.post('/auth/signup', signupData).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.message = '✓ Signed up successfully!';

        this.cdr.detectChanges();

        this.redirectTimer = setTimeout(() => {
          this.router.navigate(['/login']);
        }, 2500);
      },

      error: (error) => {
        this.isSubmitting = false;

        const detail = error.error?.detail;

        // Check if email is already registered
        if (
          error.status === 400 &&
          typeof detail === 'string' &&
          detail.toLowerCase().includes('already exists')
        ) {
          this.emailError = detail;
          this.showEmailExistsPopup = true;
        }
        // Handle other string errors
        else if (typeof detail === 'string') {
          this.errorMessage = detail;
        }

        // Handle validation errors returned as an array
        else if (Array.isArray(detail)) {
          this.errorMessage = detail
            .map((item: any) => item.msg || 'Invalid input.')
            .join(' ');
        }
        // Handle unexpected errors
        else {
          this.errorMessage = 'Something went wrong. Please try again.';
        }

        this.cdr.detectChanges();
      },
    });
  } catch (error) {
    //handel encryption failures
    this.isSubmitting = false;
    console.error('Singup encryption error:', error);

    this.errorMessage=
      'Unable to secure your password. Please try again.';

      this.cdr.detectChanges();
    }
  }


  goToLogin(): void {
    this.router.navigate(['/login']);
  }
  goToForgotPassword(): void {
    this.router.navigate(['/forgot-password']);
  }
  useAnotherEmail(): void {
    this.showEmailExistsPopup = false;

    // Clear only the email field
    this.email = '';
    this.emailError = '';

    // Clear any previous server messages
    this.errorMessage = '';
    this.message = '';

    // Make sure signup is enabled
    this.isSubmitting = false;
  }

}
