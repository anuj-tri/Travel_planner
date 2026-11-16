import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '../auth.service';
import { Encryption } from '../../services/encryption';

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

  showPassword = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private encryption: Encryption
  ) {}

  async login() {
    this.message = '';
    this.errorMessage = '';

    if (!this.email || !this.password) {
      this.errorMessage = 'Please enter your email and password';
      return;
    }

    try{
      //encrpyt passwor using RSA public key
      const encryptedPassword =
        await this.encryption.encryptPassword(this.password);
      this.password = '';

    const loginData = {
      email: this.email,
      password: encryptedPassword,
    };

    this.authService.login(loginData).subscribe({
      next: () => {
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
          typeof detail ==='string' &&
          /email.*(not registered|not found|does not exist)/i.test(detail)
        ) {
          this.errorMessage ='Email is not registered';
        } else if (
          typeof detail === 'string'
          &&/(incorrect password|invalid password|wrong password)/i.test(detail)
        ){
          this.errorMessage= 'Inccorect password.';
        } else {
          this.errorMessage = 'Invalid email or passsword.';
        }
        this.cdr.detectChanges();
      },
    });
  } catch(error) {
    console.error("Password encryption:", error);
    this.errorMessage = "Unable to secure your password. Please try again.";
    this.cdr.detectChanges();
  }
}

  goToSignup() {
    this.router.navigate(['/signup']);
  }

  goToForgotPassword() {
    this.router.navigate(['/forgot-password']);
  }
}
